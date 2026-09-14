import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_SECRET = TEST_JWT_SECRET;

// Global test utilities
export const testUtils = {
  // Create a valid ObjectId string
  createObjectId: () => new mongoose.Types.ObjectId().toString(),

  // Create a test school ID
  createSchoolId: () => new mongoose.Types.ObjectId().toString(),

  // Create a test user ID
  createUserId: () => new mongoose.Types.ObjectId().toString(),

  // Create a test product ID
  createProductId: () => new mongoose.Types.ObjectId().toString(),

  // Create a test sale ID
  createSaleId: () => new mongoose.Types.ObjectId().toString(),

  // Create a test client ID
  createClientId: () => new mongoose.Types.ObjectId().toString(),

  // Create a test cash shift ID
  createCashShiftId: () => new mongoose.Types.ObjectId().toString(),

  // Generate a valid JWT token for testing
  generateTestToken: (payload: Partial<{
    sub: string;
    role: string;
    schoolId: string;
    posId: string;
  }> = {}) => {
    const defaultPayload = {
      sub: payload.sub || new mongoose.Types.ObjectId().toString(),
      role: payload.role || 'seller',
      schoolId: payload.schoolId || new mongoose.Types.ObjectId().toString(),
      posId: payload.posId || new mongoose.Types.ObjectId().toString(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    return jwt.sign(defaultPayload, TEST_JWT_SECRET);
  },

  // Create auth header
  createAuthHeader: (token: string) => ({
    Authorization: `Bearer ${token}`,
  }),

  // Wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.log = vi.fn();
  console.info = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});