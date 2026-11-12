import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { config, getSiteUrl } from '../config/index.js';
import { aiService } from './ai.service.js';
import { chargerService, rankChargers } from './charger.service.js';
import { bookingService } from './booking.service.js';
import { disputeService } from './dispute.service.js';
import { kyaService } from './kya.service.js';
import { walletService } from './wallet.service.js';
import { invoiceService } from './invoice.service.js';
import { evaluateTool, normalizeSettings, DECISIONS, TOOL_ACTIONS, toolAllowedForRoles } from './agentPolicy.js';
import { MandateError, ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';

/**
 * Agent tool definitions for OpenAI-style function calling.
 * Every name here has an entry in TOOL_ACTIONS (agentPolicy.js), which decides who may run it.
 */
const placeCache = new Map(); // query -> { at, places }
const PLACE_CACHE_MS = 24 * 60 * 60 * 1000;
let lastLookupAt = 0; // Nominatim asks for at most one request a second

/**
 * Turn a place name ("Yeshwantpur, Bengaluru") into real coordinates with OpenStreetMap Nominatim.
 * Returns up to 3 matches: { name, latitude, longitude, type }. Results are cached for a day.
 * fetchImpl is injectable for tests.
 */
export async function geocodePlace(query, fetchImpl = fetch) {
  const q = String(query || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  if (q.length < 2) throw new ValidationError('Give a place name to look up');
  const key = q.toLowerCase();
  const hit = placeCache.get(key);
  if (hit && Date.now() - hit.at < PLACE_CACHE_MS) return hit.places;

  const g = config.ai.geocoding;
  const wait = lastLookupAt + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastLookupAt = Date.now();

  const url = new URL(g.url);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '3');
  if (g.countries) url.searchParams.set('countrycodes', g.countries);

  const res = await fetchImpl(url, {
    headers: { 'User-Agent': g.userAgent, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Place lookup failed (${res.status})`);
  const rows = await res.json();
  const places = (Array.isArray(rows) ? rows : []).map((r) => ({
    name: r.display_name,
    latitude: Math.round(parseFloat(r.lat) * 1e6) / 1e6,
    longitude: Math.round(parseFloat(r.lon) * 1e6) / 1e6,
    type: r.type,
  })).filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

  placeCache.set(key, { at: Date.now(), places });
  return places;
}

const agentTools = [
  {
    type: 'function',
    function: {
      name: 'find_place',
      description: 'Look up the real coordinates of a place name, area or address (for example "Yeshwantpur, Bengaluru"). Call this FIRST whenever the user names a place, then pass the returned latitude and longitude to search_chargers or recommend_chargers. If several places match and it is unclear which one is meant, ask the user. Never guess coordinates.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Place name, area or address, with the city if known' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_chargers',
      description: 'Search for available EV chargers near a location. Use the user\'s shared location, or the coordinates from find_place when they name a place.',
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
  {
    type: 'function',
    function: {
      name: 'get_wallet',
      description: 'Show the user wallet: balance, money held for bookings, pending host earnings and recent ledger rows',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_my_bookings',
      description: 'List the user bookings (as a driver, or as a host for their chargers)',
      parameters: {
        type: 'object',
        properties: {
          as: { type: 'string', enum: ['driver', 'host'], description: 'Which side to list. Defaults to driver.' },
          status: { type: 'string', description: 'Optional status filter, for example authorized or completed' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_disputes',
      description: 'List the disputes the user is part of, with their status',
      parameters: {
        type: 'object',
        properties: { status: { type: 'string', description: 'Optional status filter' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_invoices',
      description: 'List invoices the user sent or received, with their payment status',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_device_status',
      description: 'Show how the charger device reported a booking: session status, outcome, energy and device events',
      parameters: {
        type: 'object',
        properties: { booking_id: { type: 'string', description: 'UUID of the booking' } },
        required: ['booking_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description: 'Cancel one of the user bookings. A cancellation fee may apply depending on how close the start time is; the rest returns to the wallet. ONLY call this when the user asks for it.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: { type: 'string', description: 'UUID of the booking' },
          reason: { type: 'string', description: 'Why the user is cancelling' },
        },
        required: ['booking_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'top_up_wallet',
      description: 'Create a PayPal link to add money to the wallet. The agent cannot pay: the user must open the link and approve it on PayPal.',
      parameters: {
        type: 'object',
        properties: { amount: { type: 'number', description: 'Amount to add, between 1 and 100000, at most 2 decimals' } },
        required: ['amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recommend_chargers',
      description: 'Recommend the best nearby chargers, ranked by power, distance, rating and price. Use this when the user asks which charger is best, fastest, nearest or cheapest. Explain the top picks in plain words using the returned numbers only.',
      parameters: {
        type: 'object',
        properties: {
          latitude: { type: 'number', description: 'Latitude coordinate' },
          longitude: { type: 'number', description: 'Longitude coordinate' },
          radius_km: { type: 'number', description: 'Search radius in kilometers', default: 10 },
          priority: {
            type: 'string',
            enum: ['balanced', 'fastest', 'nearest', 'cheapest', 'best_rated'],
            description: 'What matters most to the user. Use balanced if they did not say.',
          },
          connector_type: { type: 'string', enum: ['Type2', 'CCS2', 'CHAdeMO', 'Type1', 'GBT'] },
          min_kw: { type: 'number', description: 'Minimum charging power in kW' },
          max_price: { type: 'number', description: 'Maximum price per hour' },
        },
        required: ['latitude', 'longitude'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_damage_invoice',
      description: 'HOST ONLY. Create and send a PayPal damage invoice to the driver of a finished booking. The owner must approve every time. ONLY call this when the host asks for it.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: { type: 'string', description: 'UUID of the finished booking on the host charger' },
          amount: { type: 'number', description: 'Amount to bill, greater than 0' },
          description: { type: 'string', description: 'What was damaged or what the bill is for, at least 10 characters' },
        },
        required: ['booking_id', 'amount', 'description'],
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
/** Safety net: remove any "[... internal ...]" note the model copied into its reply. */
export function stripInternalNotes(text) {
  return String(text ?? '')
    .replace(/\n*\[(?:Tool data|Known chargers|User location|Current date)[^\n]*(?:\]|$)/gi, '')
    .trim();
}

/**
 * Remember which chargers (and which package ids) a tool returned. The page sends these back
 * with the next message, because earlier tool results are not replayed and booking needs the ids.
 */
export function collectRefs(refs, value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 4) return;
  if (Array.isArray(value)) {
    value.forEach((v) => collectRefs(refs, v, depth + 1));
    return;
  }
  const id = value.chargerId || (Array.isArray(value.packages) ? value.id : null);
  if (id && value.name) {
    const prev = refs.get(id);
    const packages = Array.isArray(value.packages)
      ? value.packages.map((p) => ({ id: p.id, minutes: p.durationMin, price: Number(p.price) }))
      : prev?.packages;
    refs.set(id, { chargerId: id, name: value.name, ...(packages ? { packages } : {}) });
  }
  Object.values(value).forEach((v) => collectRefs(refs, v, depth + 1));
}

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

/**
 * What we know about a driver from their past bookings, as plain facts the model can use
 * to tailor recommendations. Built fresh from the database on each chat, nothing is stored.
 * Only the driver's own data is read. Returns null when there is no history yet.
 */
export function summarizeDriverHistory(bookings) {
  if (bookings.length === 0) return null;
  const used = bookings.filter((b) => b.status === 'completed');
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length;

  const top = (values, n = 2) => {
    const counts = new Map();
    for (const v of values.filter(Boolean)) counts.set(v, (counts.get(v) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([v]) => v);
  };
  const sum = (list, f) => list.reduce((t, b) => t + Number(f(b) || 0), 0);
  const round = (n, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

  const spent = sum(used, (b) => b.totalAmount);
  const minutes = sum(used, (b) => (new Date(b.scheduledEnd) - new Date(b.scheduledStart)) / 60000);
  const kwh = sum(used, (b) => b.session?.energyKwh);
  const dayPart = (h) => (h < 6 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night');

  return {
    completedSessions: used.length,
    cancelledBookings: cancelled,
    totalSpent: round(spent),
    avgSpendPerSession: used.length ? round(spent / used.length) : null,
    avgSessionMinutes: used.length ? Math.round(minutes / used.length) : null,
    totalEnergyKwh: kwh > 0 ? round(kwh, 1) : null,
    favouriteConnectors: top(used.map((b) => b.charger.connectorType)),
    favouritePowerTiers: top(used.map((b) => b.charger.kwTier)),
    favouriteAreas: top(used.map((b) => b.charger.city)),
    usualTimeOfDay: top(used.map((b) => dayPart(new Date(b.scheduledStart).getHours())), 1)[0] || null,
    recentChargers: [...new Set(used.slice(0, 3).map((b) => b.charger.name))],
    currency: bookings[0].currency,
  };
}

async function loadDriverProfile(userId) {
  const bookings = await prisma.booking.findMany({
    where: { driverId: userId, status: { in: ['completed', 'cancelled'] } },
    orderBy: { scheduledStart: 'desc' },
    take: 30,
    select: {
      status: true, totalAmount: true, scheduledStart: true, scheduledEnd: true, currency: true,
      charger: { select: { name: true, city: true, connectorType: true, kwTier: true } },
      session: { select: { energyKwh: true } },
    },
  });
  return summarizeDriverHistory(bookings);
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
    case 'find_place': {
      const places = await geocodePlace(args.query);
      return {
        value: places.length
          ? { places }
          : { places: [], note: 'No match. Ask the user for a more exact place name or the city.' },
      };
    }

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
        frontendUrl: getSiteUrl(),
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

    case 'get_wallet': {
      const { wallet, transactions } = await walletService.getWallet(userId, { limit: 10 });
      return { value: { wallet, recent: transactions } };
    }

    case 'list_my_bookings': {
      const role = args.as === 'host' ? 'host' : 'driver';
      const result = await bookingService.getUserBookings(userId, role, { status: args.status, limit: 10 });
      return { value: result.bookings };
    }

    case 'list_disputes': {
      const result = await disputeService.getUserDisputes(userId, { status: args.status, limit: 10 });
      return { value: result.disputes };
    }

    case 'list_invoices':
      return { value: (await invoiceService.listForUser(userId)).slice(0, 10) };

    case 'check_device_status': {
      const booking = await prisma.booking.findUnique({
        where: { id: args.booking_id },
        select: {
          id: true, status: true, driverId: true, charger: { select: { hostId: true, name: true } },
          session: { select: { status: true, outcome: true, energyKwh: true, proofSource: true } },
        },
      });
      if (!booking) throw new NotFoundError('Booking');
      if (booking.driverId !== userId && booking.charger.hostId !== userId) {
        throw new ForbiddenError('You are not part of this booking');
      }
      const events = await prisma.deviceEvent.findMany({
        where: { bookingId: booking.id },
        orderBy: { counter: 'asc' },
        select: { type: true, counter: true, createdAt: true },
      });
      return {
        value: { bookingId: booking.id, chargerName: booking.charger.name, bookingStatus: booking.status, session: booking.session, events },
        bookingId: booking.id,
      };
    }

    case 'cancel_booking': {
      const result = await bookingService.cancelBooking(args.booking_id, userId, args.reason || 'Cancelled by the user\'s agent');
      return { value: result, bookingId: args.booking_id };
    }

    case 'top_up_wallet': {
      const amount = Number(args.amount);
      if (!Number.isFinite(amount) || amount < 1 || amount > 100000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
        throw new ValidationError('Top-up must be between 1 and 100000, with at most 2 decimals');
      }
      const order = await walletService.startTopUp(userId, amount);
      return { value: { ...order, note: 'Open approveUrl and approve on PayPal. Nothing is charged until you do.' } };
    }

    case 'recommend_chargers': {
      const found = await chargerService.searchChargers({
        latitude: args.latitude,
        longitude: args.longitude,
        radius: args.radius_km || 10,
        connectorType: args.connector_type,
        minKw: args.min_kw,
        maxPrice: args.max_price,
        limit: 50,
      });
      const priority = args.priority || 'balanced';
      const picks = rankChargers(found.chargers, priority, 3);
      return { value: { priority, consideredCount: found.chargers.length, picks } };
    }

    case 'create_damage_invoice': {
      if (!args.description || args.description.trim().length < 10) {
        throw new ValidationError('An invoice description needs at least 10 characters');
      }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sentToday = await prisma.invoice.count({ where: { issuerId: userId, createdAt: { gte: since } } });
      if (sentToday >= config.agent.maxInvoicesPerDay) {
        throw new ForbiddenError(`Daily invoice limit reached (${config.agent.maxInvoicesPerDay})`);
      }
      const invoice = await invoiceService.createDamageInvoice(userId, {
        bookingId: args.booking_id,
        amount: args.amount,
        description: args.description.trim(),
      });
      return { value: invoice, bookingId: args.booking_id };
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
    case 'create_damage_invoice':
      return `Send a PayPal invoice of ${Number(args.amount).toFixed(2)} for booking ${args.booking_id}: ${args.description}`;
    case 'cancel_booking':
      return `Cancel booking ${args.booking_id}. A cancellation fee may apply; the rest returns to your wallet`;
    case 'top_up_wallet':
      return `Create a PayPal link to add ${Number(args.amount).toFixed(2)} ${config.platform.defaultCurrency} to your wallet (you still approve on PayPal)`;
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
  async chat(userId, { message, mandateToken, context }, stream = {}) {
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

    // Earlier turns of this chat come from the page; keep only the last 20 plain-text turns
    const history = (context?.history || []).slice(-20).map((m) => ({ role: m.role, content: m.content }));
    const messages = [...history, { role: 'user', content: message }];
    const last = messages.length - 1;
    // Known ids go in front of the newest user message, as data for the model only
    if (context?.refs?.length) {
      messages[last].content = `[Known chargers, internal ids: ${JSON.stringify(context.refs)}]\n\n${messages[last].content}`;
    }
    // The model has no clock: tell it the real date, in the user's time zone when the page sent one
    {
      let nowNote = `${new Date().toISOString()} (UTC)`;
      const tz = context?.timeZone;
      if (tz) {
        try {
          const local = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz, dateStyle: 'full', timeStyle: 'short',
          }).format(new Date());
          nowNote = `${local} in the user's time zone ${tz}; UTC now is ${new Date().toISOString()}`;
        } catch { /* unknown zone: keep UTC */ }
      }
      messages[last].content = `[Current date and time: ${nowNote}. Convert "today", "1pm" and similar to ISO times in UTC for tools.]\n\n${messages[last].content}`;
    }
    if (context?.currentLocation) {
      messages[last].content = `[User location: ${context.currentLocation.latitude}, ${context.currentLocation.longitude}]\n\n${messages[last].content}`;
    }

    const pendingApprovals = [];
    const refs = new Map(); // chargers (and their package ids) seen by tools in this turn

    // A driver only gets driver tools, a host only host tools; a user with both roles gets both
    const roleRows = await prisma.userRoleMapping.findMany({ where: { userId }, select: { role: true } });
    const roles = roleRows.map((r) => r.role);
    const toolsForUser = agentTools.filter((t) => toolAllowedForRoles(t.function.name, roles)
      && (t.function.name !== 'find_place' || config.ai.geocoding.enabled));

    const executeToolCall = async (toolName, args) => {
      const startTime = Date.now();

      if (!toolAllowedForRoles(toolName, roles)) {
        throw new ForbiddenError(`Not allowed: "${toolName}" is not available for your account type`);
      }

      // Work out how much money this call would commit
      let amount = 0;
      if (toolName === 'create_booking') {
        const start = new Date(args.scheduled_start);
        if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 5 * 60 * 1000) {
          throw new ValidationError(
            `scheduled_start must be a future time. It is now ${new Date().toISOString()} (UTC). Use the current date from the message.`
          );
        }
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
        // The same request asked twice should reuse the open approval, not stack up new ones
        const open = await prisma.agentApproval.findMany({
          where: { userId, action: toolName, status: 'pending', expiresAt: { gt: new Date() } },
        });
        const same = open.find((a) => JSON.stringify(a.args) === JSON.stringify(args));
        const approval = same || await prisma.agentApproval.create({
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
        collectRefs(refs, outcome.value);
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

    // Past bookings help the model tailor its picks; only drivers have any
    const profile = roles.includes('driver') ? await loadDriverProfile(userId) : null;

    const response = await aiService.chatWithConcierge(messages, toolsForUser, executeToolCall, { ...stream, profile });

    const first = pendingApprovals[0];
    let finalMessage = stripInternalNotes(response.message);
    if (first) {
      // Typing "yes" in the chat does not approve anything; point to the real button
      finalMessage += '\n\n**To confirm, press Approve in the yellow "Actions waiting for your approval" box at the top of this page.** Typing "yes" here does not confirm it.';
    }
    return {
      message: finalMessage,
      toolsUsed: response.toolsUsed,
      requiresApproval: pendingApprovals.length > 0,
      approvalId: first?.id,
      action: first?.action,
      actionDescription: first?.description,
      actionData: first ? { approvalId: first.id } : undefined,
      pendingApprovals,
      refs: [...refs.values()].slice(0, 8),
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
