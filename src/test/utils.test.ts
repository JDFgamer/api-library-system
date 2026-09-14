import { describe, it, expect, beforeAll } from 'vitest';
import { testUtils } from './setup.js';

// Set JWT_SECRET for tests
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
});

describe('Test Utilities', () => {
  it('should create valid ObjectIds', () => {
    const id1 = testUtils.createObjectId();
    const id2 = testUtils.createObjectId();
    
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-fA-F]{24}$/);
  });

  it('should create different types of IDs', () => {
    const schoolId = testUtils.createSchoolId();
    const userId = testUtils.createUserId();
    const productId = testUtils.createProductId();
    const saleId = testUtils.createSaleId();
    const clientId = testUtils.createClientId();
    const cashShiftId = testUtils.createCashShiftId();

    expect(schoolId).toMatch(/^[0-9a-fA-F]{24}$/);
    expect(userId).toMatch(/^[0-9a-fA-F]{24}$/);
    expect(productId).toMatch(/^[0-9a-fA-F]{24}$/);
    expect(saleId).toMatch(/^[0-9a-fA-F]{24}$/);
    expect(clientId).toMatch(/^[0-9a-fA-F]{24}$/);
    expect(cashShiftId).toMatch(/^[0-9a-fA-F]{24}$/);
  });

  it('should generate valid JWT tokens', async () => {
    const token = await testUtils.generateTestToken({
      sub: 'user-123',
      role: 'admin',
      schoolId: 'school-123',
      posId: 'pos-123',
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('should create auth header', async () => {
    const token = await testUtils.generateTestToken();
    const header = testUtils.createAuthHeader(token);

    expect(header).toEqual({ Authorization: `Bearer ${token}` });
  });

  it('should wait for specified time', async () => {
    const start = Date.now();
    await testUtils.wait(50);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});