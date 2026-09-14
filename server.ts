import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { closeMongoDBConnection } from './config/db.js';
import { logger } from './utils/logger.js';

import authRoutes from './routes/auth/index.js';
import usersRoutes from './routes/users/index.js';
import productsRoutes from './routes/products/index.js';
import clientsRoutes from './routes/clients/index.js';
import salesRoutes from './routes/sales/index.js';
import quotesRoutes from './routes/quotes/index.js';
import cashShiftsRoutes from './routes/cash-shifts/index.js';
import cashMovementsRoutes from './routes/cashMovements/index.js';
import creditsRoutes from './routes/credits/index.js';
import dashboardRoutes from './routes/dashboard/index.js';
import settingsRoutes from './routes/settings/index.js';
import schoolsRoutes from './routes/schools/index.js';
import adminsRoutes from './routes/admins/index.js';
import posRoutes from './routes/pos/index.js';
import aiRoutes from './routes/ai/index.js';

const app = express();

// Body parser (must be before CORS / routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
// In production, restrict to specific origins; in development, allow all for flexibility
const allowedOrigins = env.NODE_ENV === 'production'
  ? [env.FRONTEND_POS_URL, env.FRONTEND_ADMIN_URL, env.FRONTEND_BOT_URL]
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV });
});

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/products', productsRoutes);
app.use('/clients', clientsRoutes);
app.use('/sales', salesRoutes);
app.use('/quotes', quotesRoutes);
app.use('/cash-shifts', cashShiftsRoutes);
app.use('/cash-movements', cashMovementsRoutes);
app.use('/credits', creditsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/settings', settingsRoutes);
app.use('/schools', schoolsRoutes);
app.use('/admins', adminsRoutes);
app.use('/pos', posRoutes);
app.use('/ai', aiRoutes);

// Handle 404s
app.use(notFoundHandler);
app.use(errorHandler);

let dbConnected = false;

export default async function handler(req: import('express').Request, res: import('express').Response): Promise<void> {
  try {
    if (!dbConnected) {
      await mongoose.connect(env.MONGODB_URI);
      dbConnected = true;
      logger.info('📊 MongoDB connected via handler');
    }

    // Pass to Express router
    const expressApp = app as unknown as (req: import('express').Request, res: import('express').Response) => void;
    return expressApp(req, res);
  } catch (error: unknown) {
    logger.error('Error in server handler', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor',
    });
  }
}

// Start server if run directly (ESM compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = env.PORT;
  mongoose.connect(env.MONGODB_URI)
    .then(() => {
      logger.info('📊 MongoDB connected on startup');
      app.listen(port, () => {
        logger.info(`🚀 Server running on port ${port} (${env.NODE_ENV})`);
      });
    })
    .catch((error) => {
      logger.error('Failed to connect to MongoDB on startup', { error });
      process.exit(1);
    });
}

// Graceful shutdown
export { closeMongoDBConnection };
export { handler as apiHandler };