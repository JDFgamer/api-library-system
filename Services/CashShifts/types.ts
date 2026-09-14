import type { CashShiftLean } from '../../models/CashShift/index.js';
import type { CashMovementCategory } from '../../models/CashMovement/index.js';

export interface CashShiftDetail {
  shift: {
    id: string;
    shiftNumber: number;
    sellerName: string;
    status: 'open' | 'closed';
    openedAt: string;
    closedAt?: string;
    openingAmount: number;
    closingAmount?: number;
    expectedAmount?: number;
    difference?: number;
    note?: string;
  };
  sales: {
    cashTotal: number;
    transferTotal: number;
    creditTotal: number;
    salesCount: number;
    returnsTotal: number;
    returnsCashTotal: number;
    returnsTransferTotal: number;
    returnsCreditTotal: number;
  };
  movements: {
    items: Array<{
      id: string;
      type: 'in' | 'out';
      category: CashMovementCategory;
      amount: number;
      description: string;
      createdAt: string;
    }>;
    aggregated: {
      cashInTotal: number;
      cashOutTotal: number;
      netMovements: number;
      movementsCount: number;
      byCategory: Record<CashMovementCategory, { in: number; out: number; count: number }>;
    };
  };
}

export interface CashShiftListResult {
  items: (CashShiftLean & { sellerName?: string; shiftNumber?: number })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CloseCashShiftResult {
  cashShift: CashShiftLean;
  expectedAmount: number;
  difference: number;
  cashInTotal: number;
  cashOutTotal: number;
  netMovements: number;
}

export interface DailySummary {
  date: string;
  totalOpening: number;
  inheritedOpening: number;
  cashSales: number;
  transferSales: number;
  returns: number;
  creditPayments: number;
  cashInTotal: number;
  cashOutTotal: number;
  netMovements: number;
  totalExpected: number;
  finalCount: number;
  salesInOpenShifts: number;
  difference: number;
  shiftsWithDifference: number;
  totalShifts: number;
  pendingShifts: Array<{ sellerName: string; id: string }>;
}

export interface ListCashShiftsParams {
  schoolId: string;
  sellerId?: string;
  status?: 'open' | 'closed';
  hasDifference?: boolean;
  fromDate?: Date;
  toDate?: Date;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}