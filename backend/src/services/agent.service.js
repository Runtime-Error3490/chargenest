import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { aiService } from './ai.service.js';
import { chargerService } from './charger.service.js';
import { bookingService } from './booking.service.js';
import { disputeService } from './dispute.service.js';
import { kyaService } from './kya.service.js';
import { evaluateTool, normalizeSettings, DECISIONS, TOOL_ACTIONS } from './agentPolicy.js';
import { MandateError, ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';

/**
 * Agent tool definitions for OpenAI-style function calling.
 * Every name here has an entry in TOOL_ACTIONS (agentPolicy.js), which decides who may run it.
 */
const agentTools = [
  {
    type: 'function',
    function: {
      name: 'search_chargers',
      description: 'Search for available EV chargers near a location',
      parameters: {
        type: 'object',
        properties: {
          latitude: { type: 'number', description: 'Latitude coordinate' },
          longitude: { type: 'number', description: 'Longitude coordinate' },
          radius_km: { type: 'number', description: 'Search radius in kilometers', default: 10 },
          connector_type: {
            type: 'string',
            enum: ['Type2', 'CCS2', 'CHAdeMO', 'Type1', 'GBT'],
            description: 'Filter by connector type',
          },
          max_price: { type: 'number', description: 'Maximum price per hour in INR' },
        },
        required: ['latitude', 'longitude'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_charger_details',
      description: 'Get detailed information about a charger and its host',
      parameters: {
        type: 'object',
        properties: {
          charger_id: { type: 'string', description: 'UUID of the charger' },
        },
        required: ['charger_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimate_cost',
      description: 'Calculate the estimated cost for a charging session',
      parameters: {
        type: 'object',
        properties: {
          charger_id: { type: 'string', description: 'UUID of the charger' },
          package_id: { type: 'string', description: 'UUID of the time package' },
        },
        required: ['charger_id', 'package_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Book a charger. The amount is held from the user wallet. ONLY call this when the user explicitly confirms they want to book.',
      parameters: {
        type: 'object',
        properties: {
          charger_id: { type: 'string', description: 'UUID of the charger' },
          package_id: { type: 'string', description: 'UUID of the time package' },
          scheduled_start: { type: 'string', format: 'date-time', description: 'ISO datetime for booking start' },
        },
        required: ['charger_id', 'package_id', 'scheduled_start'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'raise_dispute',
      description: 'Raise a dispute on a booking, for example for damage or a session problem. ONLY call this when the user asks for it.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: { type: 'string', description: 'UUID of the booking' },
          reason: { type: 'string', description: 'Short reason, at least 10 characters' },
          description: { type: 'string', description: 'Details of what happened' },
        },
        required: ['booking_id', 'reason'],
      },
    },
  },
];

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Verify and validate mandate (optional per-request spending / distance / connector caps)
 */
async function verifyMandate(mandateToken, action = null) {
  // Verify JWT
  let decoded;
  try {
    decoded = jwt.verify(mandateToken, config.jwt.secret);
  } catch (error) {
    throw new MandateError('MANDATE_INVALID', 'Invalid mandate token');
  }

  // Get mandate from database
  const mandate = await prisma.mandate.findUnique({
    where: { id: decoded.mandate_id },
    include: { agent: true },
  });

  if (!mandate) {
    throw new MandateError('MANDATE_INVALID', 'Mandate not found');
  }

  if (mandate.status === 'revoked') {
    throw new MandateError('MANDATE_REVOKED', 'Mandate has been revoked');
  }

  if (mandate.status === 'expired' || new Date(mandate.expiresAt) < new Date()) {
    throw new MandateError('MANDATE_EXPIRED', 'Mandate has expired');
  }

  // If action provided, validate against constraints
  if (action) {
    const remaining = parseFloat(mandate.maxAmount) - parseFloat(mandate.amountUsed);

    if (action.amount && action.amount > remaining) {
      throw new MandateError('MANDATE_EXCEEDED',
        `Amount ${action.amount} exceeds remaining mandate cap ${remaining}`);
    }

    if (action.distanceKm && mandate.maxDistanceKm && action.distanceKm > parseFloat(mandate.maxDistanceKm)) {
      throw new MandateError('MANDATE_EXCEEDED',
        `Distance ${action.distanceKm}km exceeds mandate limit ${mandate.maxDistanceKm}km`);
    }

    if (action.connectorType && mandate.connectorTypes.length > 0) {
      if (!mandate.connectorTypes.includes(action.connectorType)) {
        throw new MandateError('MANDATE_EXCEEDED',
          `Connector type ${action.connectorType} not allowed by mandate`);
      }
    }
  }

  return mandate;
}

/**
 * Log an agent action to the audit trail, signed under the agent's KYA identity
 */
async function logAgentAction(agent, mandate, action, inputs, outputs, { success = true, error = null, durationMs = null, decision, level, bookingId = null } = {}) {
  const attestation = kyaService.attest(agent, { action, args: inputs, decision, level });
  await prisma.auditLog.create({
    data: {
      agentId: agent.id,
      mandateId: mandate?.id ?? null,
      userId: agent.userId,
      action,
      inputs,
      outputs: success ? outputs : null,
      bookingId,
      success,
      errorMessage: error,
      durationMs,
      decision,
      ...attestation,
    },
  });
}

function settingsOf(agent) {
  return normalizeSettings({
    level: agent.autonomyLevel,
    permissions: agent.permissions,
    spendingLimit: parseFloat(agent.spendingLimit),
  });
}

/**
 * What a booking costs the driver (package price plus platform fee)
 */
async function quoteBooking(chargerId, packageId) {
  const charger = await prisma.charger.findUnique({
    where: { id: chargerId },
    include: { packages: { where: { id: packageId } } },
  });
  if (!charger || !charger.packages[0]) {
    throw new NotFoundError('Charger or package');
  }
  const base = parseFloat(charger.packages[0].price);
  const total = Math.round(base * (1 + config.platform.feePercent / 100) * 100) / 100;
  return { charger, package: charger.packages[0], total };
}

async function spentThisMonth(userId) {
  const sum = await prisma.booking.aggregate({
    where: {
      driverId: userId,
      bookedByAgent: true,
      status: { not: 'cancelled' },
      createdAt: { gte: new Date(Date.now() - MONTH_MS) },
    },
    _sum: { totalAmount: true },
  });
  return parseFloat(sum._sum.totalAmount || 0);
}

/**
 * Run a tool. Callers have already passed the permission check.
 */
async function runTool(agent, userId, toolName, args, mandate = null) {
  switch (toolName) {
    case 'search_chargers': {
      const result = await chargerService.searchChargers({
        latitude: args.latitude,
        longitude: args.longitude,
        radius: args.radius_km || 10,
        connectorType: args.connector_type,
        maxPrice: args.max_price,
        limit: 5,
      });
      return { value: result.chargers };
    }

    case 'get_charger_details':
      return { value: await chargerService.getChargerById(args.charger_id, userId) };

    case 'estimate_cost': {
      const pkg = await prisma.timePackage.findUnique({
        where: { id: args.package_id },
        include: { charger: { select: { name: true } } },
      });
      if (!pkg) throw new NotFoundError('Package');

      const baseAmount = parseFloat(pkg.price);
      const platformFee = Math.round(baseAmount * config.platform.feePercent) / 100;

      return {
        value: {
          chargerName: pkg.charger.name,
          packageName: pkg.name,
          durationMin: pkg.durationMin,
          baseAmount,
          platformFee,
          totalAmount: baseAmount + platformFee,
          currency: pkg.currency,
        },
      };
    }

    case 'create_booking': {
      const quote = await quoteBooking(args.charger_id, args.package_id);
      const result = await bookingService.createBooking({
        driverId: userId,
        chargerId: args.charger_id,
        packageId: args.package_id,
        scheduledStart: args.scheduled_start,
        mandateId: mandate?.id ?? null,
        bookedByAgent: true,
        fundingSource: 'wallet',
        frontendUrl: config.frontendUrl,
      });

      if (mandate) {
        await prisma.mandate.update({
          where: { id: mandate.id },
          data: { amountUsed: { increment: quote.total }, bookingsCount: { increment: 1 } },
        });
      }

      return {
        value: {
          bookingCreated: true,
          bookingId: result.booking.id,
          amount: result.booking.totalAmount,
          heldFromWallet: true,
          status: result.booking.status,
        },
        bookingId: result.booking.id,
      };
    }

    case 'raise_dispute': {
      if (!args.reason || args.reason.trim().length < 10) {
        throw new ValidationError('A dispute reason needs at least 10 characters');
      }
      const result = await disputeService.raiseDispute(userId, {
        bookingId: args.booking_id,
        reason: args.reason.trim(),
        description: args.description,
        raisedByAgentId: agent.id,
      });
      return { value: result, bookingId: args.booking_id };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Short plain-language line shown on the approval card
 */
function describeAction(toolName, args, amount) {
  switch (toolName) {
    case 'create_booking':
      return `Book charger ${args.charger_id} at ${args.scheduled_start} and hold ${amount?.toFixed(2)} ${config.platform.defaultCurrency} from your wallet`;
    case 'raise_dispute':
      return `Raise a dispute on booking ${args.booking_id}: ${args.reason}`;
    default:
      return `${toolName} ${JSON.stringify(args)}`;
  }
}

export const agentService = {
  /**
   * Get the user's agent, creating its KYA identity on first use
   */
  async createAgent(userId) {
    return kyaService.registerAgent(userId);
  },

  /**
   * KYA identity card (public key, owner, verification checks)
   */
  async getIdentity(userId) {
    return kyaService.getAgentCard(userId);
  },

  /**
   * The owner's permission settings for the agent
   */
  async getSettings(userId) {
    const agent = await kyaService.registerAgent(userId);
    return {
      ...settingsOf(agent),
      agentId: agent.id,
      spentThisMonth: await spentThisMonth(userId),
    };
  },

  async updateSettings(userId, body) {
    const agent = await kyaService.registerAgent(userId);
    const next = normalizeSettings(body, settingsOf(agent));

    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        autonomyLevel: next.level,
        permissions: next.permissions,
        spendingLimit: next.spendingLimit,
      },
    });

    return { ...next, agentId: agent.id, spentThisMonth: await spentThisMonth(userId) };
  },

  /**
   * Create a spending mandate (optional extra caps on top of the agent settings)
   */
  async createMandate(userId, {
    maxAmount = config.platform.defaultMandateCap,
    maxDistanceKm = config.platform.defaultMandateDistanceKm,
    connectorTypes = [],
    expiresInHours = config.platform.defaultMandateExpiryHours,
  }) {
    const agent = await kyaService.registerAgent(userId);
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const mandate = await prisma.mandate.create({
      data: {
        agentId: agent.id,
        userId,
        maxAmount,
        maxDistanceKm,
        connectorTypes,
        token: '', // Will update with signed token
        expiresAt,
      },
    });

    const token = jwt.sign(
      {
        mandate_id: mandate.id,
        agent_id: agent.id,
        user_id: userId,
        constraints: {
          max_amount: maxAmount,
          max_distance_km: maxDistanceKm,
          connector_types: connectorTypes,
        },
      },
      config.jwt.secret,
      { expiresIn: `${expiresInHours}h` }
    );

    const updated = await prisma.mandate.update({
      where: { id: mandate.id },
      data: { token },
    });

    return {
      mandate: {
        id: updated.id,
        agentId: agent.id,
        maxAmount: parseFloat(updated.maxAmount),
        maxDistanceKm: updated.maxDistanceKm ? parseFloat(updated.maxDistanceKm) : null,
        connectorTypes: updated.connectorTypes,
        expiresAt: updated.expiresAt,
        status: updated.status,
        token: updated.token,
      },
    };
  },

  /**
   * Revoke a mandate
   */
  async revokeMandate(mandateId, userId) {
    const mandate = await prisma.mandate.findUnique({
      where: { id: mandateId },
    });

    if (!mandate) {
      throw new NotFoundError('Mandate');
    }

    if (mandate.userId !== userId) {
      throw new ValidationError('You do not own this mandate');
    }

    await prisma.mandate.update({
      where: { id: mandateId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    });

    return { revoked: true };
  },

  /**
   * Get user's mandates
   */
  async getUserMandates(userId, includeExpired = false) {
    const where = { userId };

    if (!includeExpired) {
      where.status = 'active';
      where.expiresAt = { gt: new Date() };
    }

    const mandates = await prisma.mandate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return mandates.map(m => ({
      id: m.id,
      maxAmount: parseFloat(m.maxAmount),
      amountUsed: parseFloat(m.amountUsed),
      amountRemaining: parseFloat(m.maxAmount) - parseFloat(m.amountUsed),
      maxDistanceKm: m.maxDistanceKm ? parseFloat(m.maxDistanceKm) : null,
      connectorTypes: m.connectorTypes,
      bookingsCount: m.bookingsCount,
      status: m.status,
      expiresAt: m.expiresAt,
      createdAt: m.createdAt,
    }));
  },

  /**
   * Get agent activity (audit log). Each entry says whether its KYA signature checks out.
   */
  async getAgentActivity(userId, { page = 1, limit = 20 }) {
    const where = { userId, agentId: { not: null } };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const activities = await Promise.all(logs.map(async (l) => ({
      id: l.id,
      action: l.action,
      description: l.errorMessage || `${l.action} (${l.decision || 'allow'})`,
      inputs: l.inputs,
      outputs: l.outputs,
      success: l.success,
      status: l.success ? 'success' : 'failed',
      decision: l.decision,
      approvalRequired: l.decision === 'confirm' || l.decision === 'approved_by_owner',
      kyaVerified: await kyaService.verifyAuditRecord(l),
      errorMessage: l.errorMessage,
      durationMs: l.durationMs,
      timestamp: l.createdAt,
      createdAt: l.createdAt,
    })));

    return { activities, pagination: { page, limit, total } };
  },

  /**
   * Actions waiting for the owner
   */
  async getPendingApprovals(userId) {
    await prisma.agentApproval.updateMany({
      where: { userId, status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });
    const approvals = await prisma.agentApproval.findMany({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    return approvals.map(a => ({
      id: a.id,
      action: a.action,
      description: a.summary,
      expiresAt: a.expiresAt,
      createdAt: a.createdAt,
    }));
  },

  async getApproval(userId, approvalId) {
    const approval = await prisma.agentApproval.findUnique({ where: { id: approvalId } });
    if (!approval || approval.userId !== userId) throw new NotFoundError('Approval');
    return {
      id: approval.id,
      action: approval.action,
      status: approval.status,
      description: approval.summary,
      message: approval.error || (approval.status === 'executed' ? 'Done. The action has been completed.' : undefined),
      result: approval.result,
    };
  },

  /**
   * The owner approves or denies a pending action. Approving runs it, after re-checking
   * that the agent is still allowed to do it (settings may have changed since).
   */
  async respondToApproval(userId, approvalId, approved) {
    const approval = await prisma.agentApproval.findUnique({ where: { id: approvalId } });
    if (!approval || approval.userId !== userId) throw new NotFoundError('Approval');
    if (approval.status !== 'pending') {
      throw new ValidationError(`This request is already ${approval.status}`);
    }
    if (approval.expiresAt < new Date()) {
      await prisma.agentApproval.update({ where: { id: approvalId }, data: { status: 'expired' } });
      throw new ValidationError('This request has expired. Ask the agent again.');
    }

    const agent = await kyaService.assertAgentOwnedBy(approval.agentId, userId);
    const settings = settingsOf(agent);

    if (!approved) {
      await prisma.agentApproval.update({
        where: { id: approvalId },
        data: { status: 'denied', decidedAt: new Date() },
      });
      await logAgentAction(agent, null, approval.action, approval.args, null, {
        success: false, error: 'Denied by owner', decision: 'denied_by_owner', level: settings.level,
      });
      return this.getApproval(userId, approvalId);
    }

    // Owner said yes, but a deny rule (agent off, action switched off) still wins
    const check = evaluateTool(settings, approval.action);
    if (check.decision === DECISIONS.DENY) {
      await prisma.agentApproval.update({
        where: { id: approvalId },
        data: { status: 'failed', error: check.reason, decidedAt: new Date() },
      });
      throw new ForbiddenError(check.reason);
    }
    await this.assertVerifiedForSpend(agent, approval.action);

    const startTime = Date.now();
    try {
      const outcome = await runTool(agent, userId, approval.action, approval.args);
      await prisma.agentApproval.update({
        where: { id: approvalId },
        data: { status: 'executed', result: outcome.value, decidedAt: new Date() },
      });
      await logAgentAction(agent, null, approval.action, approval.args, outcome.value, {
        decision: 'approved_by_owner', level: settings.level, durationMs: Date.now() - startTime, bookingId: outcome.bookingId,
      });
    } catch (error) {
      await prisma.agentApproval.update({
        where: { id: approvalId },
        data: { status: 'failed', error: error.message, decidedAt: new Date() },
      });
      await logAgentAction(agent, null, approval.action, approval.args, null, {
        success: false, error: error.message, decision: 'approved_by_owner', level: settings.level, durationMs: Date.now() - startTime,
      });
    }
    return this.getApproval(userId, approvalId);
  },

  /**
   * KYA gate: tools that spend money need a verified agent
   */
  async assertVerifiedForSpend(agent, toolName) {
    const spends = (TOOL_ACTIONS[toolName] || []).includes('make_payment');
    if (!spends) return;
    const { verified, checks } = await kyaService.verifyAgent(agent);
    if (!verified) {
      const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k).join(', ');
      throw new ForbiddenError(`Agent is not KYA verified (${failed}). Add the wallet deposit first.`);
    }
  },

  /**
   * Chat with the concierge. Each tool call the model makes goes through the owner's
   * permission settings before anything runs.
   */
  async chat(userId, { message, mandateToken, context }) {
    const agent = await kyaService.registerAgent(userId);
    const settings = settingsOf(agent);

    // Optional extra caps from a mandate, which must belong to this user and agent
    let mandate = null;
    if (mandateToken) {
      mandate = await verifyMandate(mandateToken);
      if (mandate.userId !== userId || mandate.agentId !== agent.id) {
        throw new MandateError('MANDATE_INVALID', 'Mandate does not belong to your agent');
      }
    }

    const messages = [{ role: 'user', content: message }];
    if (context?.currentLocation) {
      messages[0].content = `[User location: ${context.currentLocation.latitude}, ${context.currentLocation.longitude}]\n\n${message}`;
    }

    const pendingApprovals = [];

    const executeToolCall = async (toolName, args) => {
      const startTime = Date.now();

      // Work out how much money this call would commit
      let amount = 0;
      if (toolName === 'create_booking') {
        const quote = await quoteBooking(args.charger_id, args.package_id);
        amount = quote.total;
        if (mandate) {
          await verifyMandate(mandateToken, { amount, connectorType: quote.charger.connectorType });
        }
      }

      const verdict = evaluateTool(settings, toolName, {
        amount,
        spentThisPeriod: amount > 0 ? await spentThisMonth(userId) : 0,
      });

      if (verdict.decision === DECISIONS.DENY) {
        await logAgentAction(agent, mandate, toolName, args, null, {
          success: false, error: verdict.reason, decision: 'deny', level: settings.level, durationMs: Date.now() - startTime,
        });
        throw new ForbiddenError(`Not allowed: ${verdict.reason}`);
      }

      if (verdict.decision === DECISIONS.CONFIRM) {
        const summary = describeAction(toolName, args, amount);
        const approval = await prisma.agentApproval.create({
          data: {
            agentId: agent.id,
            userId,
            action: toolName,
            args,
            summary,
            expiresAt: new Date(Date.now() + config.agent.approvalExpiryMinutes * 60 * 1000),
          },
        });
        pendingApprovals.push({ id: approval.id, action: toolName, description: summary });
        await logAgentAction(agent, mandate, toolName, args, { approvalId: approval.id }, {
          decision: 'confirm', level: settings.level, durationMs: Date.now() - startTime,
        });
        return { requiresApproval: true, approvalId: approval.id, summary, reason: verdict.reason };
      }

      try {
        await this.assertVerifiedForSpend(agent, toolName);
        const outcome = await runTool(agent, userId, toolName, args, mandate);
        await logAgentAction(agent, mandate, toolName, args, outcome.value, {
          decision: 'allow', level: settings.level, durationMs: Date.now() - startTime, bookingId: outcome.bookingId,
        });
        return outcome.value;
      } catch (err) {
        await logAgentAction(agent, mandate, toolName, args, null, {
          success: false, error: err.message, decision: 'allow', level: settings.level, durationMs: Date.now() - startTime,
        });
        throw err;
      }
    };

    const response = await aiService.chatWithConcierge(messages, agentTools, executeToolCall);

    const first = pendingApprovals[0];
    return {
      message: response.message,
      toolsUsed: response.toolsUsed,
      requiresApproval: pendingApprovals.length > 0,
      approvalId: first?.id,
      action: first?.action,
      actionDescription: first?.description,
      actionData: first ? { approvalId: first.id } : undefined,
      pendingApprovals,
      agent: { id: agent.id, level: settings.level, provider: agent.provider, model: agent.model },
      durationMs: response.durationMs,
    };
  },

  /**
   * Header info for the chat page
   */
  async getStatus(userId) {
    const agent = await kyaService.registerAgent(userId);
    const settings = settingsOf(agent);
    return {
      isActive: settings.level > 0 && agent.status === 'active',
      mandateLevel: settings.level,
      agentId: agent.id,
      provider: agent.provider,
      model: agent.model,
    };
  },
};

export default agentService;
