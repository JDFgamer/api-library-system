import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../../app.js';
import { createServerlessHandler } from '../../../../server.js';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { validate } from '../../../../middleware/validation.js';
import { listProductsSchema } from '../../../../Controllers/Products/types.js';

describe('D01 — base y contratos', () => {
  it('D01-T01: expone health desde createApp sin abrir un listener', async () => {
    const app = createApp({
      environment: {
        NODE_ENV: 'test',
        FRONTEND_POS_URL: 'http://pos.test',
        FRONTEND_ADMIN_URL: 'http://admin.test',
        FRONTEND_BOT_URL: 'http://bot.test',
      },
      now: () => new Date('2026-09-20T15:00:00.000Z'),
    });

    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      timestamp: '2026-09-20T15:00:00.000Z',
      env: 'test',
    });
  });

  it('D01-T01: el handler serverless sirve health sin conectar Mongo', async () => {
    const connectDatabase = vi.fn<() => Promise<void>>().mockResolvedValue();
    const target = express();
    target.use(createApp({ now: () => new Date('2026-09-20T15:00:00.000Z') }));
    const serverless = express();
    serverless.use((req, res, next) => {
      createServerlessHandler(target, connectDatabase)(req, res).catch(next);
    });

    const response = await request(serverless).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(connectDatabase).not.toHaveBeenCalled();
  });

  it('D01-T02: normaliza booleanos de query y rechaza page inválida', async () => {
    const app = express();
    app.get('/products', validate(listProductsSchema), (_req, res) => {
      res.json(res.locals.validatedInput.query);
    });
    app.use(errorHandler);

    const valid = await request(app).get('/products?page=2&limit=1&active=false').expect(200);
    expect(valid.body).toMatchObject({ page: 2, limit: 1, active: false });

    const invalid = await request(app).get('/products?page=0').expect(400);
    expect(invalid.body).toMatchObject({
      error: 'VALIDATION_ERROR',
      message: 'Datos de entrada inválidos',
      details: { 'query.page': expect.any(Array) },
    });
  });
});
