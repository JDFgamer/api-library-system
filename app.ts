import express from 'express';
import cors from 'cors';
import type { Express } from 'express';
import type { Env } from './config/env.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

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

interface CreateAppDependencies {
  environment?: Pick<Env, 'NODE_ENV' | 'FRONTEND_POS_URL' | 'FRONTEND_ADMIN_URL' | 'FRONTEND_BOT_URL'>;
  now?: () => Date;
}

function allowedOriginsFor(environment: CreateAppDependencies['environment']): string[] {
  if (environment?.NODE_ENV === 'production') {
    return [
      environment.FRONTEND_POS_URL,
      environment.FRONTEND_ADMIN_URL,
      environment.FRONTEND_BOT_URL,
    ].filter((origin): origin is string => Boolean(origin));
  }

  return [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
  ];
}

function createApp(dependencies: CreateAppDependencies = {}): Express {
  const environment = dependencies.environment ?? env;
  const now = dependencies.now ?? (() => new Date());
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cors({
    origin: allowedOriginsFor(environment),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: now().toISOString(), env: environment.NODE_ENV });
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export { createApp };
export type { CreateAppDependencies };
