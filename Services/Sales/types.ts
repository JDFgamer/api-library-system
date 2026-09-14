import type { SaleLean, SaleType, PaymentMethod } from '../../models/Sale/index.js';
import type { CreditMovementLean } from '../../models/CreditMovement/index.js';
import type { ClientSession } from 'mongoose';

export type ReturnMethod = 'cash' | 'transfer' | 'credit';

export interface CreateReturnParams {
  schoolId: string;
  sellerId: string;
  cashShiftId: string;
  items: Array<{ product: string; quantity: number }>;
  clientId?: string;
  method: ReturnMethod;
}

export interface SalePreviewResult {
  items: Array<{
    product: string;
    name: string;
    type: 'product' | 'service';
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    subtotal: number;
    availableStock?: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  amountReceived?: number;
  change?: number;
  paymentMethod: PaymentMethod;
  creditBalanceAfter?: number;
}

export interface SaleResult {
  sale: SaleLean;
  creditMovement?: CreditMovementLean;
}

export interface SaleItemInfo {
  product: string;
  name: string;
  type: 'product' | 'service';
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  subtotal: number;
}

export interface PopulatedClientInfo {
  id: string;
  fullName: string;
  balance: number;
}

export interface PopulatedUserInfo {
  id: string;
  name: string;
  role: string;
}

export type PopulatedSaleLean = Omit<SaleLean, 'client' | 'seller'> & {
  number: number;
  type: SaleType;
  client?: PopulatedClientInfo | null;
  seller: PopulatedUserInfo;
  items: SaleItemInfo[];
};

export interface SaleListResult {
  items: PopulatedSaleLean[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SalesSummary {
  salesToday: number;
  salesGrowth: number;
  totalRevenue: number;
  returnsCount: number;
  returnsAmount: number;
  averageTicket: number;
}

export interface SaleItemForStockRestore {
  product: string;
  quantity: number;
  type: 'product' | 'service';
}

export interface SaleDocumentForVoid {
  _id: unknown;
  paymentMethod: PaymentMethod;
  settled: boolean;
  client?: string;
  total: number;
  items: Array<{
    product: unknown;
    type: 'product' | 'service';
    quantity: number;
  }>;
  voided: boolean;
  voidedAt?: Date;
  voidReason?: string;
  save: (options?: { session?: ClientSession }) => Promise<unknown>;
}

export interface CreditReversalParams {
  sale: SaleDocumentForVoid;
  schoolId: string;
  adminId: string;
  reason: string;
  session: ClientSession;
}