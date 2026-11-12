import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'node:async_hooks';

dotenv.config();

// ---------------------------------------------------------------------------
// Where the website lives, for PayPal return links and CORS.
//
// No setting is needed: it is worked out from the request that is being served, so it is right on
// Render, on a custom domain and on localhost. FRONTEND_URL is only an override (for example when the
// website and the API are on different addresses in production).
// ---------------------------------------------------------------------------
const requestContext = new AsyncLocalStorage();
const isLocalHost = (host = '') => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);

/** The address of the website for the request being served: FRONTEND_URL, else the browser's own origin. */
export function getSiteUrl() {
  const explicit = process.env.FRONTEND_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const ctx = requestContext.getStore();
  if (ctx) {
    // A browser sets Origin itself, so a visitor cannot make it point somewhere else.
    // In production it must be this server's own address; in development any localhost port is fine
    // (the Vite dev server runs on its own port).
    const originHost = ctx.origin ? new URL(ctx.origin).host : null;
    if (originHost && (originHost === ctx.host || (process.env.NODE_ENV !== 'production' && isLocalHost(originHost)))) {
      return ctx.origin.replace(/\/+$/, '');
    }
    return `${ctx.protocol}://${ctx.host}`;
  }
  return (process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/** Express middleware: remembers the request's address so getSiteUrl() works anywhere below it. */
export function siteUrlMiddleware(req, res, next) {
  requestContext.run({ origin: req.get('origin'), host: req.get('host'), protocol: req.protocol }, next);
}

/** CORS check: the website's own address always passes, plus FRONTEND_URL, plus localhost in development. */
export function isAllowedOrigin(origin, host) {
  if (!origin) return true;
  let originHost;
  try { originHost = new URL(origin).host; } catch { return false; }
  if (originHost === host) return true;
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL.replace(/\/+$/, '')) return true;
  return process.env.NODE_ENV !== 'production' && isLocalHost(originHost);
}

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  // Fallback when there is no request (background jobs). Normally use getSiteUrl() instead.
  frontendUrl: (process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173').replace(/\/+$/, ''),

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    expiry: process.env.JWT_EXPIRY || '24h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // TOTP (MFA)
  totp: {
    encryptionKey: process.env.TOTP_ENCRYPTION_KEY || 'dev-totp-key-32-chars-long!!!!',
    issuer: 'EVChargeMarketplace',
  },

  // PayPal
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    mode: process.env.PAYPAL_MODE || 'sandbox',
    apiUrl: process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com',
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
  },

  // AI provider layer. AI_PROVIDER picks one entry from `providers`; AI_MODEL overrides its default model.
  // openrouter, openai and ollama all speak the OpenAI chat API; `mock` needs no key (demos and tests).
  ai: {
    provider: (process.env.AI_PROVIDER || 'openrouter').toLowerCase(),
    providers: {
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
      },
      ollama: {
        apiKey: process.env.OLLAMA_API_KEY || 'ollama',
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        model: process.env.OLLAMA_MODEL || 'llama3.1',
      },
      mock: { model: 'mock' },
    },
    modelOverride: process.env.AI_MODEL,
    // Streamed replies (POST /agent/chat/stream). Set AI_STREAMING=false to turn the endpoint off.
    streaming: process.env.AI_STREAMING !== 'false',
    // Place-name lookup for the concierge (find_place tool). Free OpenStreetMap Nominatim by default.
    // GEOCODING_ENABLED=false removes the tool; GEOCODE_COUNTRIES limits matches (comma list, '' = worldwide).
    geocoding: {
      enabled: process.env.GEOCODING_ENABLED !== 'false',
      url: process.env.GEOCODE_URL || 'https://nominatim.openstreetmap.org/search',
      countries: process.env.GEOCODE_COUNTRIES ?? 'in',
      userAgent: process.env.GEOCODE_USER_AGENT || 'ChargeNest/1.0 (EV charger marketplace demo)',
    },
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0'),
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '2', 10),
    disputeConfidenceThreshold: parseFloat(process.env.AI_DISPUTE_CONFIDENCE_THRESHOLD || '0.95'),
  },

  // Platform
  platform: {
    feePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '7'),
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
    defaultMandateCap: parseFloat(process.env.DEFAULT_MANDATE_CAP || '1000'),
    defaultMandateDistanceKm: parseFloat(process.env.DEFAULT_MANDATE_DISTANCE_KM || '10'),
    defaultMandateExpiryHours: parseInt(process.env.DEFAULT_MANDATE_EXPIRY_HOURS || '24', 10),
  },

  // Wallet. The minimum balance doubles as the damage deposit: it must be in the wallet
  // before a user can book or list a charger, and withdrawals can never dip below it.
  wallet: {
    // Balance a user needs in the wallet before booking or listing
    minBalance: parseFloat(process.env.WALLET_MIN_BALANCE || '500'),
    // Part of the wallet that stays locked as the damage deposit. The rest can be spent on bookings.
    deposit: parseFloat(process.env.WALLET_DEPOSIT || '250'),
    // PayPal mock mode only: one-time demo credit for a wallet that has never been used (0 turns it off)
    mockCredit: parseFloat(process.env.WALLET_MOCK_CREDIT || '1000'),
  },

  // Payout to the host. With a delay, the host is credited that many hours after the session ends,
  // and a dispute raised in between freezes it. 0 credits at once.
  payout: {
    delayHours: parseFloat(process.env.PAYOUT_DELAY_HOURS || '0'),
  },

  // Charger hardware that proves sessions with signed events
  device: {
    // Mock endpoint that plays a device. Never active in production, unless DEMO_MODE=true is set on purpose
    // (a hosted demo with no real hardware): then anyone logged in can settle their own booking.
    mock: process.env.DEVICE_MOCK === 'true' && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true'),
    // A session shorter than this counts as failed (full refund)
    minSessionMinutes: parseFloat(process.env.MIN_SESSION_MINUTES || '5'),
    // Energy below this over a long enough session counts as a meter fault (full refund)
    minEnergyKwh: parseFloat(process.env.MIN_ENERGY_KWH || '0.05'),
    // Minutes after the booked end before an unfinished or never-unlocked session is closed automatically
    graceMinutes: parseFloat(process.env.DEVICE_GRACE_MINUTES || '10'),
    // Seconds between background runs (auto close and delayed payouts). 0 turns the runner off.
    jobIntervalSec: parseInt(process.env.JOB_INTERVAL_SEC || '60', 10),
  },

  // Know Your Agent: key used to encrypt each agent's signing key at rest
  kya: {
    keySecret: process.env.KYA_KEY_SECRET || process.env.JWT_SECRET || 'dev-kya-secret-change-in-production',
  },

  // Agent defaults (autonomy level 0-4, monthly auto-spend limit)
  agent: {
    defaultLevel: parseInt(process.env.AGENT_DEFAULT_LEVEL || '2', 10),
    defaultSpendingLimit: parseFloat(process.env.AGENT_DEFAULT_SPENDING_LIMIT || '5000'),
    approvalExpiryMinutes: parseInt(process.env.AGENT_APPROVAL_EXPIRY_MINUTES || '30', 10),
    maxInvoicesPerDay: parseInt(process.env.AGENT_MAX_INVOICES_PER_DAY || '5', 10),
  },

  // Cancellation policy (hours before booking)
  cancellation: {
    freeCancelHours: 24,
    tiers: [
      { hoursBeforeMin: 24, hoursBeforeMax: Infinity, penaltyPercent: 0 },
      { hoursBeforeMin: 12, hoursBeforeMax: 24, penaltyPercent: 25 },
      { hoursBeforeMin: 6, hoursBeforeMax: 12, penaltyPercent: 50 },
      { hoursBeforeMin: 0, hoursBeforeMax: 6, penaltyPercent: 100 },
    ],
    noShowPenaltyPercent: 100,
  },

  // Dispute
  dispute: {
    windowHours: 24, // Hours after session to raise dispute
  },
};

// Validate required config in production
export function validateConfig() {
  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DATABASE_URL',
  ];

  if (config.nodeEnv === 'production') {
    required.push(
      'PAYPAL_CLIENT_ID',
      'PAYPAL_CLIENT_SECRET',
      'TOTP_ENCRYPTION_KEY'
    );
    const provider = config.ai.providers[config.ai.provider];
    if (!provider) {
      throw new Error(`Unknown AI_PROVIDER: ${config.ai.provider}`);
    }
    if (config.ai.provider !== 'mock' && config.ai.provider !== 'ollama' && !provider.apiKey) {
      throw new Error(`Missing API key for AI provider "${config.ai.provider}"`);
    }
  }

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;
