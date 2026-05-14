/**
 * Nova Salud – Express Server Entry Point
 *
 * Bootstraps the Express application with:
 *  - Security middleware (helmet, CORS)
 *  - Rate limiting
 *  - JSON body parsing
 *  - Request logging with unique requestId (Winston)
 *  - Auth routes (/api/auth/*)
 *  - User routes (/api/users/*)
 *  - Health check endpoint
 *  - 404 handler
 *  - Global error handler
 *
 * Requirements: NFR-2.1, NFR-2.6, FR-6.1, FR-6.2, FR-5.5, NFR-4.2
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { logger } from './config/logger';
import { checkDatabaseHealth, closePool } from './config/database';
import { requestLogger } from './middleware/requestLogger';
import { globalErrorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';
import supplierRoutes from './routes/supplierRoutes';
import transactionRoutes from './routes/transactionRoutes';
import alertRoutes from './routes/alertRoutes';
import reportRoutes from './routes/reportRoutes';
import auditRoutes from './routes/auditRoutes';
import { validateContentType, sanitizeInput } from './middleware/securityMiddleware';
import { startStockMonitoringJob } from './services/stockService';

// ----------------------------------------------------------------
// App setup
// ----------------------------------------------------------------

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ----------------------------------------------------------------
// Security headers (NFR-2.6)
// ----------------------------------------------------------------

app.use(helmet());

// ----------------------------------------------------------------
// CORS
// ----------------------------------------------------------------

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  }),
);

// ----------------------------------------------------------------
// Rate limiting (NFR-2.1)
// ----------------------------------------------------------------

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
});

// Stricter limiter for auth endpoints to mitigate brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
    },
  },
});

app.use(globalLimiter);

// ----------------------------------------------------------------
// Body parsing
// ----------------------------------------------------------------

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ----------------------------------------------------------------
// Security middleware
// ----------------------------------------------------------------

app.use(validateContentType);
app.use(sanitizeInput);

// ----------------------------------------------------------------
// Request logging – assigns req.id and logs every request/response
// ----------------------------------------------------------------

app.use(requestLogger);

// ----------------------------------------------------------------
// Health check
// ----------------------------------------------------------------

app.get('/health', async (_req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseHealth();
  const status = dbHealthy ? 'ok' : 'degraded';
  res.status(dbHealthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'ok' : 'unavailable',
    },
  });
});

// ----------------------------------------------------------------
// Routes
// ----------------------------------------------------------------

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);

// ----------------------------------------------------------------
// 404 handler – must come after all routes
// ----------------------------------------------------------------

app.use(notFoundHandler);

// ----------------------------------------------------------------
// Global error handler – must be last (4-argument signature)
// ----------------------------------------------------------------

app.use(globalErrorHandler);

// ----------------------------------------------------------------
// Start server
// ----------------------------------------------------------------

const server = app.listen(PORT, () => {
  logger.info(`Nova Salud backend running on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    port: PORT,
  });

  // Start scheduled stock monitoring job
  startStockMonitoringJob();
});

// ----------------------------------------------------------------
// Graceful shutdown
// ----------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Shutting down gracefully…`);
  server.close(async () => {
    await closePool();
    logger.info('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export default app;
