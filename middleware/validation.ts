import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

type ValidatedRequest = {
  body?: unknown;
  query?: unknown;
  params?: unknown;
};

function getValidatedInput<T extends ValidatedRequest>(res: Response): T | undefined {
  return res.locals.validatedInput as T | undefined;
}

export function validate(schema: ZodType) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed && typeof parsed === 'object') {
        res.locals.validatedInput = parsed;
        if ('body' in parsed) {
          req.body = (parsed as ValidatedRequest).body;
        }
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.');
          if (!details[path]) {
            details[path] = [];
          }
          details[path].push(issue.message);
        }
        throw new ValidationError('Datos de entrada inválidos', details);
      }
      throw error;
    }
  };
}

export { getValidatedInput };
