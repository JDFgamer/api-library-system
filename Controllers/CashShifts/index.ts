import { Request, Response } from 'express';
import * as cashShiftsService from '../../Services/CashShifts/index.js';
import * as cashMovementsController from '../../Controllers/CashMovements/index.js';

export async function openCashShift(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');
  const { openingAmount } = req.body;
  const cashShift = await cashShiftsService.openCashShift(req.schoolId!, req.user.sub, openingAmount);
  res.status(201).json(cashShift);
}

export async function getActiveCashShift(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');
  const result = await cashShiftsService.getActiveCashShiftWithDetails(req.schoolId!, req.user.sub);
  res.json(result);
}

export async function closeCashShift(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');
  const { id } = req.params;
  const { closingAmount, note } = req.body;
  const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
  const result = await cashShiftsService.closeCashShift(req.schoolId!, id as string, req.user.sub, closingAmount, note, isAdmin);
  res.json(result);
}

export async function getCashShift(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const cashShift = await cashShiftsService.getCashShiftById(req.schoolId!, id);
  res.json(cashShift);
}

export async function listCashShifts(req: Request, res: Response): Promise<void> {
  const query = req.query;
  const fromDate = query.fromDate ? new Date(query.fromDate as string) : undefined;
  const toDate = query.toDate ? new Date(query.toDate as string) : undefined;
  const hasDifference = query.hasDifference !== undefined ? query.hasDifference === 'true' : undefined;
  const result = await cashShiftsService.listCashShifts({
    schoolId: req.schoolId!,
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
    sortBy: (query.sortBy as string) || 'openedAt',
    sortOrder: (query.sortOrder as 'asc' | 'desc') || 'desc',
    sellerId: query.sellerId as string | undefined,
    status: query.status as 'open' | 'closed' | undefined,
    hasDifference,
    fromDate,
    toDate,
  });
  res.json(result);
}

export async function getDailySummary(req: Request, res: Response): Promise<void> {
  const date = req.query.date ? new Date(req.query.date as string) : undefined;
  const summary = await cashShiftsService.getDailySummary(req.schoolId!, date);
  res.json(summary);
}

// Cash Movement endpoints
export async function getCashShiftDetail(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const detail = await cashShiftsService.getCashShiftDetail(req.schoolId!, id);
  res.json(detail);
}

export const createCashMovement = cashMovementsController.createCashMovement;
export const getCashMovementsByShift = cashMovementsController.getCashMovementsByShift;
export const getCashMovementsAggregated = cashMovementsController.getCashMovementsAggregated;