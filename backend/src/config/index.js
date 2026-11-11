import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

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
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0'),
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '2', 10),
    disputeConfidenceThreshold: parseFloat(process.env.AI_DISPUTE_CONFIDENCE_THRESHOLD || '0.95'),
  },

  // Platform
  platform: {
    feePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '7'),
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'INR',
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
    // Mock endpoint that plays a device (never active in production)
    mock: process.env.DEVICE_MOCK === 'true' && process.env.NODE_ENV !== 'production',
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
