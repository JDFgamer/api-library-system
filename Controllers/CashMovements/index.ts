import { Request, Response } from 'express';
import * as cashMovementsService from '../../Services/CashMovements/index.js';

function getStringParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : (val ?? '');
}

function getOptionalString(query: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const val = query[key];
  if (val === undefined) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

function getOptionalNumber(query: Record<string, string | string[] | undefined>, key: string, defaultVal: number): number {
  const val = getOptionalString(query, key);
  if (val === undefined) return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
}

export async function createCashMovement(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');
  const cashShiftId = getStringParam(req.params, 'cashShiftId');
  const { type, category, amount, description } = req.body;

  const movement = await cashMovementsService.createCashMovement({
    schoolId: req.schoolId!,
    cashShiftId,
    sellerId: req.user.sub,
    type,
    category,
    amount,
    description,
  });

  res.status(201).json(movement);
}

export async function getCashMovementsByShift(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');
  const cashShiftId = getStringParam(req.params, 'cashShiftId');

  const movements = await cashMovementsService.getCashMovementsByShift(
    req.schoolId!,
    cashShiftId,
    req.user.sub
  );

  res.json(movements);
}

export async function getCashMovementsAggregated(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');
  const cashShiftId = getStringParam(req.params, 'cashShiftId');

  const aggregated = await cashMovementsService.getCashMovementsAggregated(req.schoolId!, cashShiftId);

  res.json(aggregated);
}

export async function listCashMovements(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');

  const query = req.query as Record<string, string | string[] | undefined>;
  const result = await cashMovementsService.listCashMovements({
    schoolId: req.schoolId!,
    sellerId: getOptionalString(query, 'sellerId'),
    cashShiftId: getOptionalString(query, 'cashShiftId'),
    type: getOptionalString(query, 'type') as 'in' | 'out' | undefined,
    category: getOptionalString(query, 'category') as 'lunch' | 'supplies' | 'personal_withdrawal' | 'change' | 'expense' | 'other' | undefined,
    fromDate: getOptionalString(query, 'fromDate') ? new Date(getOptionalString(query, 'fromDate')!) : undefined,
    toDate: getOptionalString(query, 'toDate') ? new Date(getOptionalString(query, 'toDate')!) : undefined,
    page: getOptionalNumber(query, 'page', 1),
    limit: getOptionalNumber(query, 'limit', 20),
    sortBy: getOptionalString(query, 'sortBy') ?? 'createdAt',
    sortOrder: (getOptionalString(query, 'sortOrder') as 'asc' | 'desc') ?? 'desc',
  });

  res.json(result);
}

export async function deleteCashMovement(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');
  const id = getStringParam(req.params, 'id');

  await cashMovementsService.deleteCashMovement(
    req.schoolId!,
    id,
    req.user.sub,
    req.user.role
  );

  res.status(204).send();
}