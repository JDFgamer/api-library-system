import type { z } from 'zod';

export interface ToolContext {
  schoolId: string;
  botSellerId: string;
  /** Sesión del widget: se guarda en el pedido para avisar cambios de estado. */
  sessionId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType;
}

export interface ToolResult {
  result: unknown;
}

export interface PublicProduct {
  id: string;
  name: string;
  price: number;
  available: boolean;
  availabilityNote?: string;
}

export interface DraftOrderResult {
  publicCode: string;
  total: number;
  items: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }>;
}

export interface SetCustomerInfoResult {
  publicCode: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentIntent: 'cash' | 'transfer' | null;
}

export interface ExecutableToolDefinition extends ToolDefinition {
  execute: (ctx: ToolContext, args: unknown) => Promise<ToolResult>;
}

export interface OpenAiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}
