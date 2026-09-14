import { CashMovementModel } from '../../models/CashMovement/index.js';
import { UserRole } from '../../models/User/index.js';
import type { CashMovementLean, CashMovementType, CashMovementCategory } from '../../models/CashMovement/index.js';
import { CashShiftModel } from '../../models/CashShift/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { withId } from '../../utils/lean.js';
import type { CashMovementListResult, CashMovementAggregated } from './types.js';

export async function createCashMovement(params: {
  schoolId: string;
  cashShiftId: string;
  sellerId: string;
  type: CashMovementType;
  category: CashMovementCategory;
  amount: number;
  description: string;
}): Promise<CashMovementLean> {
  const cashShift = await CashShiftModel.findOne({ _id: params.cashShiftId, school: params.schoolId });
  if (!cashShift) {
    throw new NotFoundError('Turno no encontrado');
  }
  if (cashShift.seller.toString() !== params.sellerId) {
    throw new ConflictError('No autorizado para registrar movimientos en este turno');
  }
  if (cashShift.status === 'closed') {
    throw new ConflictError('El turno está cerrado, no se pueden registrar movimientos');
  }

  if (params.amount <= 0) {
    throw new ValidationError('El monto debe ser mayor a 0');
  }
  if (!params.description || params.description.trim().length < 3) {
    throw new ValidationError('La descripción es obligatoria (mínimo 3 caracteres)');
  }

  const movement = await CashMovementModel.create({
    cashShift: params.cashShiftId,
    school: params.schoolId,
    seller: params.sellerId,
    type: params.type,
    category: params.category,
    amount: params.amount,
    description: params.description.trim(),
  });

  return movement.toJSON() as CashMovementLean;
}

export async function getCashMovementsByShift(
  schoolId: string,
  cashShiftId: string,
  sellerId: string
): Promise<CashMovementLean[]> {
  const cashShift = await CashShiftModel.findOne({ _id: cashShiftId, school: schoolId });
  if (!cashShift) {
    throw new NotFoundError('Turno no encontrado');
  }
  if (cashShift.seller.toString() !== sellerId) {
    throw new ConflictError('No autorizado para ver movimientos de este turno');
  }

  const movements = await CashMovementModel.find({ cashShift: cashShiftId, school: schoolId })
    .sort({ createdAt: -1 })
    .lean();

  return movements.map(m => withId(m) as CashMovementLean);
}

export async function getCashMovementsAggregated(
  schoolId: string,
  cashShiftId: string
): Promise<CashMovementAggregated> {
  const movements = await CashMovementModel.find({ cashShift: cashShiftId, school: schoolId }).lean();

  const cashInTotal = movements
    .filter(m => m.type === 'in')
    .reduce((sum, m) => sum + m.amount, 0);

  const cashOutTotal = movements
    .filter(m => m.type === 'out')
    .reduce((sum, m) => sum + m.amount, 0);

  const byCategory: CashMovementAggregated['byCategory'] = {
    lunch: { in: 0, out: 0, count: 0 },
    supplies: { in: 0, out: 0, count: 0 },
    personal_withdrawal: { in: 0, out: 0, count: 0 },
    change: { in: 0, out: 0, count: 0 },
    expense: { in: 0, out: 0, count: 0 },
    other: { in: 0, out: 0, count: 0 },
  };

  for (const m of movements) {
    if (m.type === 'in') {
      byCategory[m.category].in += m.amount;
    } else {
      byCategory[m.category].out += m.amount;
    }
    byCategory[m.category].count += 1;
  }

  return {
    cashInTotal,
    cashOutTotal,
    netMovements: cashInTotal - cashOutTotal,
    movementsCount: movements.length,
    byCategory,
  };
}

export async function listCashMovements(params: {
  schoolId: string;
  sellerId?: string;
  cashShiftId?: string;
  type?: CashMovementType;
  category?: CashMovementCategory;
  fromDate?: Date;
  toDate?: Date;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): Promise<CashMovementListResult> {
  const filter: Record<string, unknown> = { school: params.schoolId };

  if (params.sellerId) filter.seller = params.sellerId;
  if (params.cashShiftId) filter.cashShift = params.cashShiftId;
  if (params.type) filter.type = params.type;
  if (params.category) filter.category = params.category;
  if (params.fromDate || params.toDate) {
    filter.createdAt = {};
    if (params.fromDate) (filter.createdAt as Record<string, Date>).$gte = params.fromDate;
    if (params.toDate) (filter.createdAt as Record<string, Date>).$lte = params.toDate;
  }

  const sort: Record<string, 1 | -1> = { [params.sortBy]: params.sortOrder === 'asc' ? 1 : -1 };

  const [items, total] = await Promise.all([
    CashMovementModel.find(filter)
      .populate({ path: 'seller', select: 'name' })
      .populate({ path: 'cashShift', select: 'id openedAt closedAt' })
      .sort(sort)
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    CashMovementModel.countDocuments(filter),
  ]);

  return {
    items: items.map(m => ({
      ...withId(m),
      sellerName: (m as unknown as { seller?: { name?: string } | null }).seller?.name ?? 'Desconocido',
      shiftNumber: (m as unknown as { cashShift?: { id?: string } | null }).cashShift?.id ?? '',
    })) as CashMovementLean[],
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

export async function deleteCashMovement(
  schoolId: string,
  movementId: string,
  requesterId: string,
  requesterRole: UserRole
): Promise<void> {
  const movement = await CashMovementModel.findOne({ _id: movementId, school: schoolId });
  if (!movement) {
    throw new NotFoundError('Movimiento no encontrado');
  }

  if (requesterRole === 'seller' && movement.seller.toString() !== requesterId) {
    throw new ConflictError('No autorizado para anular este movimiento');
  }

  const cashShift = await CashShiftModel.findById(movement.cashShift);
  if (cashShift && cashShift.status === 'closed') {
    throw new ConflictError('No se pueden anular movimientos de un turno cerrado');
  }

  await movement.deleteOne();
}