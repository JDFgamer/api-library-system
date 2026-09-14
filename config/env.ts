import dotenv from 'dotenv';
dotenv.config();

export interface Env {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BCRYPT_ROUNDS: number;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  MERCADOPAGO_ACCESS_TOKEN?: string;
  EMAIL_HOST?: string;
  EMAIL_PORT: number;
  EMAIL_USER?: string;
  EMAIL_PASS?: string;
  EMAIL_FROM: string;
  FRONTEND_POS_URL: string;
  FRONTEND_ADMIN_URL: string;
  FRONTEND_BOT_URL: string;
  AI_LLM_BASE_URL: string;
  AI_LLM_API_KEY?: string;
  AI_LLM_MODEL: string;
  AI_LLM_TIMEOUT_MS: number;
  AI_LLM_FALLBACK_BASE_URL?: string;
  AI_LLM_FALLBACK_API_KEY?: string;
  AI_LLM_FALLBACK_MODEL?: string;
  AI_MAX_TOOL_CALLS: number;
}

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT) ?? 3000,
  MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/librarysystem',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS) ?? 12,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: Number(process.env.EMAIL_PORT) ?? 587,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM ?? 'Library System <noreply@librarysystem.com>',
  FRONTEND_POS_URL: process.env.FRONTEND_POS_URL ?? 'http://localhost:5173',
  FRONTEND_ADMIN_URL: process.env.FRONTEND_ADMIN_URL ?? 'http://localhost:5174',
  FRONTEND_BOT_URL: process.env.FRONTEND_BOT_URL ?? 'http://localhost:5175',
  AI_LLM_BASE_URL: process.env.AI_LLM_BASE_URL ?? 'https://api.z.ai/api/paas/v4/',
  AI_LLM_API_KEY: process.env.AI_LLM_API_KEY,
  AI_LLM_MODEL: process.env.AI_LLM_MODEL ?? 'glm-4.7-flashx',
  AI_LLM_TIMEOUT_MS: Number(process.env.AI_LLM_TIMEOUT_MS) || 15000,
  AI_LLM_FALLBACK_BASE_URL: process.env.AI_LLM_FALLBACK_BASE_URL,
  AI_LLM_FALLBACK_API_KEY: process.env.AI_LLM_FALLBACK_API_KEY,
  AI_LLM_FALLBACK_MODEL: process.env.AI_LLM_FALLBACK_MODEL,
  AI_MAX_TOOL_CALLS: Number(process.env.AI_MAX_TOOL_CALLS) ?? 3,
};
