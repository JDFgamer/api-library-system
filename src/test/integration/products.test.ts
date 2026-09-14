import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { testUtils } from '../setup.js';
import app from '../test-server.js';

const testApp = request(app);

describe('Products Integration Tests', () => {
  let testSchoolId: string;
  let adminToken: string;
  let productId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
    testSchoolId = testUtils.createSchoolId();
    adminToken = await testUtils.generateTestToken({
      sub: testUtils.createUserId(),
      role: 'admin',
      schoolId: testSchoolId,
      posId: testUtils.createProductId(),
    });
  });

  afterAll(async () => {
    // Cleanup
  });

  beforeEach(async () => {
    // Clear collections if using real DB
  });

  describe('POST /products', () => {
    it('should return 401 for missing token', async () => {
      const res = await testApp
        .post('/products')
        .send({
          name: 'Test Product',
          type: 'product',
          price: 1000,
          stock: 10,
        })
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });

    it('should return 403 for non-admin user', async () => {
      const sellerToken = await testUtils.generateTestToken({
        sub: testUtils.createUserId(),
        role: 'seller',
        schoolId: testSchoolId,
        posId: testUtils.createProductId(),
      });

      const res = await testApp
        .post('/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Test Product',
          type: 'product',
          price: 1000,
          stock: 10,
        })
        .expect(403);

      expect(res.body).toHaveProperty('error', 'AUTHORIZATION_ERROR');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await testApp
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 400 for invalid product type', async () => {
      const res = await testApp
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          type: 'invalid',
          price: 1000,
          stock: 10,
        })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 400 for negative price', async () => {
      const res = await testApp
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          type: 'product',
          price: -100,
          stock: 10,
        })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 400 for negative stock', async () => {
      const res = await testApp
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          type: 'product',
          price: 1000,
          stock: -5,
        })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 400 for negative cost', async () => {
      const res = await testApp
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          type: 'product',
          price: 1000,
          cost: -10,
          stock: 10,
        })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should create product with cost', async () => {
      const res = await testApp
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          type: 'product',
          price: 1000,
          cost: 100,
          stock: 10,
        })
        .expect(201);

      expect(res.body).toHaveProperty('cost', 100);
    });
  });

  describe('GET /products', () => {
    it('should return 401 for missing token', async () => {
      const res = await testApp
        .get('/products')
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });

    it('should return 200 with valid token', async () => {
      const res = await testApp
        .get('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('totalPages');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('should support search query parameter', async () => {
      const res = await testApp
        .get('/products?search=cafe')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
    });

    it('should support type filter', async () => {
      const res = await testApp
        .get('/products?type=service')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
    });

    it('should support pagination', async () => {
      const res = await testApp
        .get('/products?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 5);
    });

    it('should support sorting', async () => {
      const res = await testApp
        .get('/products?sortBy=price&sortOrder=desc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
    });
  });

  describe('GET /products/:id', () => {
    it('should return 401 for missing token', async () => {
      const res = await testApp
        .get('/products/invalid-id')
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });

    it('should return 400 for invalid ID format', async () => {
      const res = await testApp
        .get('/products/not-a-valid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 404 for non-existent product', async () => {
      const res = await testApp
        .get(`/products/${testUtils.createProductId()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(res.body).toHaveProperty('error', 'NOT_FOUND');
    });
  });

  describe('PATCH /products/:id', () => {
    it('should return 401 for missing token', async () => {
      const res = await testApp
        .patch(`/products/${testUtils.createProductId()}`)
        .send({ name: 'Updated' })
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });

    it('should return 403 for non-admin user', async () => {
      const sellerToken = await testUtils.generateTestToken({
        sub: testUtils.createUserId(),
        role: 'seller',
        schoolId: testSchoolId,
        posId: testUtils.createProductId(),
      });

      const res = await testApp
        .patch(`/products/${testUtils.createProductId()}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ name: 'Updated' })
        .expect(403);

      expect(res.body).toHaveProperty('error', 'AUTHORIZATION_ERROR');
    });

    it('should return 400 for invalid ID format', async () => {
      const res = await testApp
        .patch('/products/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });

  describe('DELETE /products/:id', () => {
    it('should return 401 for missing token', async () => {
      const res = await testApp
        .delete(`/products/${testUtils.createProductId()}`)
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });

    it('should return 403 for non-admin user', async () => {
      const sellerToken = await testUtils.generateTestToken({
        sub: testUtils.createUserId(),
        role: 'seller',
        schoolId: testSchoolId,
        posId: testUtils.createProductId(),
      });

      const res = await testApp
        .delete(`/products/${testUtils.createProductId()}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);

      expect(res.body).toHaveProperty('error', 'AUTHORIZATION_ERROR');
    });

    it('should return 400 for invalid ID format', async () => {
      const res = await testApp
        .delete('/products/invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });

  describe('PATCH /products/:id/stock', () => {
    it('should return 401 for missing token', async () => {
      const res = await testApp
        .patch(`/products/${testUtils.createProductId()}/stock`)
        .send({ quantity: 5, operation: 'add' })
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });

    it('should return 400 for missing quantity', async () => {
      const res = await testApp
        .patch(`/products/${testUtils.createProductId()}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ operation: 'add' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 400 for invalid operation', async () => {
      const res = await testApp
        .patch(`/products/${testUtils.createProductId()}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 5, operation: 'invalid' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 400 for negative quantity', async () => {
      const res = await testApp
        .patch(`/products/${testUtils.createProductId()}/stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: -5, operation: 'add' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });
});