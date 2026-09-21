import type { Request, Response } from 'express';
import type { Express } from 'express';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { closeMongoDBConnection } from './config/db.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';

const app = createApp();

let dbConnected = false;

type ConnectDatabase = () => Promise<unknown>;

function createServerlessHandler(
  expressApp: Express = app,
  connectDatabase: ConnectDatabase = async () => mongoose.connect(env.MONGODB_URI),
): (req: Request, res: Response) => Promise<void> {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Health checks must remain available while a serverless instance is cold
      // or its database is temporarily unavailable.
      if (req.path !== '/health' && !dbConnected) {
        await connectDatabase();
        dbConnected = true;
        logger.info('📊 MongoDB connected via handler');
      }

      const requestHandler = expressApp as unknown as (request: Request, response: Response) => void;
      requestHandler(req, res);
    } catch (error: unknown) {
      logger.error('Error in server handler', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Error interno del servidor',
      });
    }
  };
}

const handler = createServerlessHandler();

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
export { app, closeMongoDBConnection, createServerlessHandler };
export { handler as apiHandler };
