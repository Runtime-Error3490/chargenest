import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { aiService } from './ai.service.js';
import { chargerService } from './charger.service.js';
import { bookingService } from './booking.service.js';
import { MandateError, ValidationError, NotFoundError } from '../utils/errors.js';

/**
 * Agent tool definitions for OpenAI function calling
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
            description: 'Filter by connector type'
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
      name: 'get_host_details',
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
      name: 'create_booking_hold',
      description: 'Create a booking with payment authorization. ONLY call this when user explicitly confirms they want to book.',
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
];

/**
 * Verify and validate mandate
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
 * Log agent action to audit trail
 */
async function logAgentAction(mandate, action, inputs, outputs, success = true, error = null, durationMs = null) {
  await prisma.auditLog.create({
    data: {
      agentId: mandate.agentId,
      mandateId: mandate.id,
      userId: mandate.userId,
      action,
      inputs,
      outputs: success ? outputs : null,
      success,
      errorMessage: error,
      durationMs,
    },
  });
}

export const agentService = {
  /**
   * Create a new agent for user
   */
  async createAgent(userId) {
    // Check if user already has an active agent
    const existing = await prisma.agent.findFirst({
      where: { userId, status: 'active' },
    });

    if (existing) {
      return existing;
    }

    return prisma.agent.create({
      data: {
        userId,
        name: 'Charging Concierge',
        model: config.ai.model,
        provider: 'openrouter',
      },
    });
  },

  /**
   * Create a spending mandate
   */
  async createMandate(userId, {
    maxAmount = config.platform.defaultMandateCap,
    maxDistanceKm = config.platform.defaultMandateDistanceKm,
    connectorTypes = [],
    expiresInHours = config.platform.defaultMandateExpiryHours,
  }) {
    // Get or create agent
    let agent = await prisma.agent.findFirst({
      where: { userId, status: 'active' },
    });

    if (!agent) {
      agent = await this.createAgent(userId);
    }

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    // Create mandate
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

    // Generate signed token
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

    // Update mandate with token
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
   * Get agent activity (audit log)
   */
  async getAgentActivity(userId, { page = 1, limit = 20 }) {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where: { userId } }),
    ]);

    return {
      activities: logs.map(l => ({
        id: l.id,
        action: l.action,
        inputs: l.inputs,
        outputs: l.outputs,
        success: l.success,
        errorMessage: l.errorMessage,
        durationMs: l.durationMs,
        createdAt: l.createdAt,
      })),
      pagination: { page, limit, total },
    };
  },

  /**
   * Chat with concierge agent
   */
  async chat(userId, { message, mandateToken, context }) {
    // Verify mandate
    const mandate = await verifyMandate(mandateToken);

    // Build conversation messages
    const messages = [
      {
        role: 'user',
        content: message,
      },
    ];

    // Add context if provided
    if (context?.currentLocation) {
      messages[0].content = `[User location: ${context.currentLocation.latitude}, ${context.currentLocation.longitude}]\n\n${message}`;
    }

    // Tool execution function
    const executeToolCall = async (toolName, args) => {
      const startTime = Date.now();
      let result;
      let error = null;

      try {
        switch (toolName) {
          case 'search_chargers':
            result = await chargerService.searchChargers({
              latitude: args.latitude,
              longitude: args.longitude,
              radius: args.radius_km || 10,
              connectorType: args.connector_type,
              maxPrice: args.max_price,
              limit: 5,
            });
            result = result.chargers;
            break;

          case 'get_host_details':
            result = await chargerService.getChargerById(args.charger_id, userId);
            break;

          case 'estimate_cost':
            const pkg = await prisma.timePackage.findUnique({
              where: { id: args.package_id },
              include: { charger: { select: { name: true } } },
            });
            if (!pkg) throw new Error('Package not found');
            
            const baseAmount = parseFloat(pkg.price);
            const platformFee = Math.round(baseAmount * config.platform.feePercent) / 100;
            
            result = {
              chargerName: pkg.charger.name,
              packageName: pkg.name,
              durationMin: pkg.durationMin,
              baseAmount,
              platformFee,
              totalAmount: baseAmount + platformFee,
              currency: pkg.currency,
            };
            break;

          case 'create_booking_hold':
            // Verify mandate constraints for booking
            const charger = await prisma.charger.findUnique({
              where: { id: args.charger_id },
              include: { packages: { where: { id: args.package_id } } },
            });
            
            if (!charger || !charger.packages[0]) {
              throw new Error('Charger or package not found');
            }

            const bookingPkg = charger.packages[0];
            const bookingAmount = parseFloat(bookingPkg.price) * (1 + config.platform.feePercent / 100);

            // Verify mandate allows this booking
            await verifyMandate(mandateToken, {
              amount: bookingAmount,
              connectorType: charger.connectorType,
            });

            // Create booking
            const bookingResult = await bookingService.createBooking({
              driverId: userId,
              chargerId: args.charger_id,
              packageId: args.package_id,
              scheduledStart: args.scheduled_start,
              mandateId: mandate.id,
              bookedByAgent: true,
              frontendUrl: config.frontendUrl,
            });

            // Update mandate usage
            await prisma.mandate.update({
              where: { id: mandate.id },
              data: {
                amountUsed: { increment: bookingAmount },
                bookingsCount: { increment: 1 },
              },
            });

            result = {
              bookingCreated: true,
              bookingId: bookingResult.booking.id,
              amount: bookingResult.booking.totalAmount,
              paypalOrderId: bookingResult.paypal.orderId,
              approveUrl: bookingResult.paypal.approveUrl,
            };
            break;

          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        // Log successful action
        await logAgentAction(
          mandate,
          toolName,
          args,
          result,
          true,
          null,
          Date.now() - startTime
        );

        return result;
      } catch (err) {
        error = err.message;
        
        // Log failed action
        await logAgentAction(
          mandate,
          toolName,
          args,
          null,
          false,
          error,
          Date.now() - startTime
        );

        throw err;
      }
    };

    // Call AI with tools
    const response = await aiService.chatWithConcierge(messages, agentTools, executeToolCall);

    // Get updated mandate info
    const updatedMandate = await prisma.mandate.findUnique({
      where: { id: mandate.id },
    });

    return {
      response: {
        message: response.message,
        toolsUsed: response.toolsUsed,
      },
      agent: {
        id: mandate.agentId,
        mandateId: mandate.id,
        mandateRemaining: parseFloat(updatedMandate.maxAmount) - parseFloat(updatedMandate.amountUsed),
      },
      durationMs: response.durationMs,
    };
  },
};

export default agentService;
