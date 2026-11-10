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

  // OpenRouter (AI)
  ai: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
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
      'OPENROUTER_API_KEY',
      'TOTP_ENCRYPTION_KEY'
    );
  }

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default config;
