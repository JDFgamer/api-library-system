import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { testUtils } from '../setup.js';
import app from '../test-server.js';

const testApp = request(app);

describe('Auth Integration Tests', () => {
  let testSchoolId: string;
  let adminToken: string;
  let sellerToken: string;
  let adminUserId: string;
  let sellerUserId: string;

  beforeAll(async () => {
    testSchoolId = testUtils.createSchoolId();
    adminUserId = testUtils.createUserId();
    sellerUserId = testUtils.createUserId();

    // Create test users in DB would go here
    // For now, we'll test with mocked auth
  });

  afterAll(async () => {
    // Cleanup
  });

  beforeEach(async () => {
    // Clear collections if using real DB
  });

  describe('POST /auth/login', () => {
    it('should return 400 for missing credentials', async () => {
      const res = await testApp
        .post('/auth/login')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await testApp
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong' })
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });

    it('should return 400 for missing email', async () => {
      const res = await testApp
        .post('/auth/login')
        .send({ password: 'password123' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 400 for missing password', async () => {
      const res = await testApp
        .post('/auth/login')
        .send({ email: 'test@test.com' })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });

  describe('POST /auth/register', () => {
    it('should return 400 for missing required fields', async () => {
      const res = await testApp
        .post('/auth/register')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 400 for invalid email format', async () => {
      const res = await testApp
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
          schoolId: testUtils.createSchoolId(),
        })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });

    it('should return 400 for short password', async () => {
      const res = await testApp
        .post('/auth/register')
        .send({
          email: 'test@test.com',
          password: '123',
          name: 'Test User',
          schoolId: testUtils.createSchoolId(),
        })
        .expect(400);

      expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 401 for missing refresh token', async () => {
      const res = await testApp
        .post('/auth/refresh')
        .send({})
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });

    it('should return 401 for invalid refresh token', async () => {
      const res = await testApp
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 for missing token', async () => {
      const res = await testApp
        .get('/auth/me')
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });

    it('should return 401 for invalid token', async () => {
      const res = await testApp
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body).toHaveProperty('error', 'AUTHENTICATION_ERROR');
    });
  });
});