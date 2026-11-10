// Loaded before every test file (node --import). Keeps tests offline and independent of backend/.env.
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.PAYPAL_CLIENT_ID = 'test-client-id';
process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';
process.env.PAYPAL_API_URL = 'https://paypal.test';
process.env.WALLET_MIN_BALANCE = '500';
process.env.WALLET_DEPOSIT = '250';
process.env.PLATFORM_FEE_PERCENT = '7';
process.env.KYA_KEY_SECRET = 'test-kya-secret';
