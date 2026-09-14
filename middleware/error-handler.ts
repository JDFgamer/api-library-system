import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  AppError,
  ValidationError,
} from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(issue.message);
    }
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Datos de entrada inválidos',
      details,
    });
    return;
  }

  if (error instanceof AppError) {
    const statusCode = error.statusCode;
    const response: Record<string, unknown> = {
      error: error.code,
      message: error.message,
    };
    if (error instanceof ValidationError && error.details) {
      response['details'] = error.details;
    }
    res.status(statusCode).json(response);
    return;
  }

  logger.error('Unhandled error', { error: error.message, stack: error.stack });
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno del servidor',
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint no encontrado',
  });
}