import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config, validateConfig } from './config/index.js';
import { prisma } from './utils/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import chargerRoutes, { UPLOAD_ROOT } from './routes/charger.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import sessionRoutes from './routes/session.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import disputeRoutes from './routes/dispute.routes.js';
import agentRoutes from './routes/agent.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import adminRoutes from './routes/admin.routes.js';
import deviceRoutes from './routes/device.routes.js';
import { startJobs } from './services/device.service.js';

// Validate configuration
validateConfig();

const app = express();

// Optional: serve the built frontend from this server (single-container deploy, e.g. Render).
// Set FRONTEND_DIST to the Vite build folder. Unset = API only (local dev behaviour).
const FRONTEND_DIST = process.env.FRONTEND_DIST ? path.resolve(process.env.FRONTEND_DIST) : null;
const serveFrontend = !!FRONTEND_DIST && fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

// Behind a proxy (Render, etc.): trust X-Forwarded-* so req.protocol is https
// (photo URLs) and rate limiting sees the real client IP.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

// ===========================================
// MIDDLEWARE
// ===========================================

// Security headers. The SPA loads PayPal, map tiles and fonts from other origins,
// so helmet's default CSP is turned off only when this server also serves the frontend.
app.use(helmet(serveFrontend ? { contentSecurityPolicy: false } : undefined));

// CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting (relaxed for development)
const limiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 1000, // 1000 requests per second
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints (1000 requests per second for development)
const authLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 1000, // 1000 requests per second
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts' } },
});
app.use('/api/auth/', authLimiter);

// Body parsing - raw for webhooks, JSON for everything else
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// ===========================================
// ROUTES
// ===========================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// Uploaded photos (public). Allow the frontend origin to embed them despite helmet's same-origin policy.
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(UPLOAD_ROOT, { maxAge: '7d', index: false }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chargers', chargerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/device', deviceRoutes);

// Frontend (only when FRONTEND_DIST is set): static files, then index.html for client-side routes.
// /api and /uploads misses still fall through to the JSON 404 below.
if (serveFrontend) {
  app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// ===========================================
// SERVER STARTUP
// ===========================================

const PORT = config.port;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    startJobs();

    app.listen(PORT, () => {
      console.log(`
🚀 EV Charging Marketplace API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Environment: ${config.nodeEnv}
🌐 URL: http://localhost:${PORT}
📊 Health: http://localhost:${PORT}/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export default app;
