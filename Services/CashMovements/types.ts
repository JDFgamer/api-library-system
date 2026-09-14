import type { CashMovementLean, CashMovementCategory } from '../../models/CashMovement/index.js';

export interface CashMovementListResult {
  items: CashMovementLean[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CashMovementAggregated {
  cashInTotal: number;
  cashOutTotal: number;
  netMovements: number;
  movementsCount: number;
  byCategory: Record<CashMovementCategory, { in: number; out: number; count: number }>;
}