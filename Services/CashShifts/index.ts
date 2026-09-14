import { CashShiftModel } from '../../models/CashShift/index.js';
import type { CashShiftLean } from '../../models/CashShift/index.js';
import { SaleModel } from '../../models/Sale/index.js';
import { CashMovementModel } from '../../models/CashMovement/index.js';
import { CreditMovementModel } from '../../models/CreditMovement/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { withId, withIds } from '../../utils/lean.js';
import type {
  CloseCashShiftResult,
  DailySummary,
  CashShiftDetail,
} from './types.js';
import {
  calculateSalesTotals,
  buildMovementAggregated,
  resolveExpectedAmount,
} from './cashShiftDetail.js';

export async function openCashShift(schoolId: string, sellerId: string, openingAmount: number): Promise<CashShiftLean> {
  const existing = await CashShiftModel.findOne({ seller: sellerId, school: schoolId, status: 'open' }).lean();
  if (existing) {
    throw new ConflictError('Ya tienes un turno abierto');
  }

  const cashShift = await CashShiftModel.create({
    seller: sellerId,
    school: schoolId,
    openingAmount,
    status: 'open',
  });

  return cashShift.toJSON() as CashShiftLean;
}

export async function getActiveCashShift(schoolId: string, sellerId: string): Promise<CashShiftLean | null> {
  const cashShift = await CashShiftModel.findOne({ seller: sellerId, school: schoolId, status: 'open' }).lean();
  return cashShift ? (withId(cashShift) as CashShiftLean) : null;
}

export async function closeCashShift(
  schoolId: string,
  cashShiftId: string,
  sellerId: string,
  closingAmount: number,
  note?: string,
  isAdmin = false
): Promise<CloseCashShiftResult> {
  const cashShift = await CashShiftModel.findOne({ _id: cashShiftId, school: schoolId });
  if (!cashShift) {
    throw new NotFoundError('Turno no encontrado');
  }
  // El dueño del turno cierra el suyo; un admin puede cerrar cualquier turno del negocio
  // (p. ej. el turno del bot, o el de un vendedor que se fue sin cerrar).
  const isShiftOwner = cashShift.seller.toString() === sellerId;
  if (!isShiftOwner && !isAdmin) {
    throw new Error('No autorizado para cerrar este turno');
  }
  if (cashShift.status === 'closed') {
    throw new ConflictError('El turno ya está cerrado');
  }

  // Get all sales (including returns) from the cash shift
  const allSales = await SaleModel.find({
    cashShift: cashShift._id,
    voided: false,
  }).lean();

  // Calculate sales totals using shared function
  const salesTotals = calculateSalesTotals(allSales as Array<{ type: string; paymentMethod: 'cash' | 'transfer' | 'credit'; total: number }>);

  // Calculate movements
  const movements = await CashMovementModel.find({ cashShift: cashShift._id, school: schoolId }).lean();
  const movementAggregated = buildMovementAggregated(movements.map(m => ({
    type: m.type,
    category: m.category,
    amount: m.amount,
  })));

  // Expected cash = opening + cash sales - returns cash - cash out + cash in
  const { expectedAmount } = resolveExpectedAmount(
    cashShift.status,
    cashShift.openingAmount,
    salesTotals.cashTotal,
    movementAggregated.cashOutTotal,
    movementAggregated.cashInTotal,
    salesTotals.returnsCashTotal,
    cashShift.expectedAmount,
    cashShift.difference
  );

  // For open shift being closed, expectedAmount is always a number
  const expectedAmountValue = expectedAmount ?? (cashShift.openingAmount + salesTotals.cashTotal - salesTotals.returnsCashTotal - movementAggregated.cashOutTotal + movementAggregated.cashInTotal);

  // Validate difference - calculate actual difference when closing
  const actualDifference = closingAmount - expectedAmountValue;
  if (actualDifference !== 0 && !note) {
    throw new ValidationError('Se requiere un motivo cuando hay diferencia en el arqueo');
  }

  cashShift.closingAmount = closingAmount;
  cashShift.expectedAmount = expectedAmountValue;
  cashShift.difference = actualDifference;
  cashShift.status = 'closed';
  cashShift.closedAt = new Date();
  cashShift.note = note;
  await cashShift.save();

  // difference is always a number when closing (closingAmount - expectedAmount)
  const differenceValue = actualDifference;

  return {
    cashShift: cashShift.toJSON() as CashShiftLean,
    expectedAmount: expectedAmountValue,
    difference: differenceValue,
    cashInTotal: movementAggregated.cashInTotal,
    cashOutTotal: movementAggregated.cashOutTotal,
    netMovements: movementAggregated.netMovements,
  };
}

export async function getCashShiftDetail(schoolId: string, cashShiftId: string): Promise<CashShiftDetail> {
  const cashShift = await CashShiftModel.findOne({ _id: cashShiftId, school: schoolId }).populate({ path: 'seller', select: 'name' }).lean();
  if (!cashShift) {
    throw new NotFoundError('Turno no encontrado');
  }

  const [allSales, movements] = await Promise.all([
    SaleModel.find({ cashShift: cashShift._id, voided: false }).lean(),
    CashMovementModel.find({ cashShift: cashShift._id, school: schoolId }).lean(),
  ]);

  // Ventas
  const salesTotals = calculateSalesTotals(allSales as Array<{ type: string; paymentMethod: 'cash' | 'transfer' | 'credit'; total: number }>);

  // Movimientos
  const movementAggregated = buildMovementAggregated(movements.map(m => ({
    type: m.type,
    category: m.category,
    amount: m.amount,
  })));

  // shiftNumber: contar turnos anteriores por escuela
  const allShifts = await CashShiftModel.find({ school: schoolId }).sort({ openedAt: 1 }).select('_id').lean();
  const shiftIndex = allShifts.findIndex(s => String(s._id) === cashShiftId);
  const shiftNumber = shiftIndex >= 0 ? shiftIndex + 1 : 0;

  // expectedAmount y difference
  const { expectedAmount, difference } = resolveExpectedAmount(
    cashShift.status,
    cashShift.openingAmount,
    salesTotals.cashTotal,
    movementAggregated.cashOutTotal,
    movementAggregated.cashInTotal,
    salesTotals.returnsCashTotal,
    cashShift.expectedAmount,
    cashShift.difference
  );

  return {
    shift: {
      id: String(cashShift._id),
      shiftNumber,
      sellerName: ((cashShift.seller as { name?: string | undefined })?.name ?? 'Desconocido'),
      status: cashShift.status,
      openedAt: cashShift.openedAt.toISOString(),
      closedAt: cashShift.closedAt?.toISOString(),
      openingAmount: cashShift.openingAmount,
      closingAmount: cashShift.closingAmount,
      expectedAmount,
      difference,
      note: cashShift.note,
    },
    sales: salesTotals,
    movements: {
      items: movements.map(m => ({
        id: String(m._id),
        type: m.type,
        category: m.category,
        amount: m.amount,
        description: m.description,
        createdAt: m.createdAt.toISOString(),
      })),
      aggregated: movementAggregated,
    },
  };
}

export async function getCashShiftById(schoolId: string, id: string): Promise<CashShiftLean> {
  const cashShift = await CashShiftModel.findOne({ _id: id, school: schoolId }).lean();
  if (!cashShift) {
    throw new NotFoundError('Turno no encontrado');
  }
  return withId(cashShift) as CashShiftLean;
}

export async function listCashShifts(params: {
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
}): Promise<{
  items: (CashShiftLean & { sellerName?: string; shiftNumber?: number })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const filter: Record<string, unknown> = { school: params.schoolId };

  if (params.sellerId) filter.seller = params.sellerId;
  if (params.status) filter.status = params.status;
  if (params.hasDifference === true) filter['$expr'] = { $ne: ['$difference', 0] };
  if (params.fromDate || params.toDate) {
    filter.openedAt = {};
    if (params.fromDate) (filter.openedAt as Record<string, Date>).$gte = params.fromDate;
    if (params.toDate) (filter.openedAt as Record<string, Date>).$lte = params.toDate;
  }

  const sort: Record<string, 1 | -1> = { [params.sortBy]: params.sortOrder === 'asc' ? 1 : -1 };

  const [items, total] = await Promise.all([
    CashShiftModel.find(filter)
      .populate({ path: 'seller', select: 'name' })
      .sort(sort)
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .lean(),
    CashShiftModel.countDocuments(filter),
  ]);

  // Obtener el número de secuencia global de cada turno (posición histórica)
  const allShifts = await CashShiftModel.find({ school: params.schoolId }).sort({ openedAt: 1 }).select('_id').lean();
  const shiftNumberMap = new Map(allShifts.map((s, i) => [String(s._id), i + 1]));

  return {
    items: (withIds(items) as CashShiftLean[]).map(s => ({
      ...s,
      sellerName: ((s as { seller: { name?: string | undefined } }).seller?.name ?? 'Desconocido'),
      shiftNumber: shiftNumberMap.get(s.id) ?? 0,
    })),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

export async function getActiveCashShiftWithDetails(schoolId: string, sellerId: string): Promise<{
  cashShift: CashShiftLean | null;
  aggregated: {
    cashTotal: number;
    transferTotal: number;
    creditTotal: number;
    salesCount: number;
    productsSold: number;
    avgTicket: number;
    expectedCash: number;
    returnsTotal: number;
    returnsCashTotal: number;
    returnsTransferTotal: number;
    returnsCreditTotal: number;
    cashInTotal: number;
    cashOutTotal: number;
    netMovements: number;
    movementsCount: number;
  } | null;
}> {
  const cashShift = await CashShiftModel.findOne({ seller: sellerId, school: schoolId, status: 'open' }).lean();
  if (!cashShift) {
    return { cashShift: null, aggregated: null };
  }

  const [allSales, movements] = await Promise.all([
    SaleModel.find({
      cashShift: cashShift._id,
      voided: false,
    }).lean(),
    CashMovementModel.find({ cashShift: cashShift._id, school: schoolId }).lean(),
  ]);

  // Use shared calculateSalesTotals function
  const salesTotals = calculateSalesTotals(allSales as Array<{ type: string; paymentMethod: 'cash' | 'transfer' | 'credit'; total: number }>);

  const sales = allSales.filter(s => s.type === 'sale');
  const productsSold = sales.reduce((sum, s) => sum + s.items.reduce((isum, i) => isum + i.quantity, 0), 0);
  const avgTicket = salesTotals.salesCount > 0
    ? sales.reduce((sum, s) => sum + s.total, 0) / salesTotals.salesCount
    : 0;

  const movementAggregated = buildMovementAggregated(movements.map(m => ({
    type: m.type,
    category: m.category,
    amount: m.amount,
  })));

  // Expected cash = opening + cash sales - returns cash - cash out + cash in
  const { expectedAmount: expectedCashRaw } = resolveExpectedAmount(
    'open',
    cashShift.openingAmount,
    salesTotals.cashTotal,
    movementAggregated.cashOutTotal,
    movementAggregated.cashInTotal,
    salesTotals.returnsCashTotal
  );
  const expectedCash = expectedCashRaw ?? (cashShift.openingAmount + salesTotals.cashTotal - salesTotals.returnsCashTotal - movementAggregated.cashOutTotal + movementAggregated.cashInTotal);

  return {
    cashShift: withId(cashShift) as CashShiftLean,
    aggregated: {
      cashTotal: salesTotals.cashTotal,
      transferTotal: salesTotals.transferTotal,
      creditTotal: salesTotals.creditTotal,
      salesCount: salesTotals.salesCount,
      productsSold,
      avgTicket,
      expectedCash,
      returnsTotal: salesTotals.returnsTotal,
      returnsCashTotal: salesTotals.returnsCashTotal,
      returnsTransferTotal: salesTotals.returnsTransferTotal,
      returnsCreditTotal: salesTotals.returnsCreditTotal,
      cashInTotal: movementAggregated.cashInTotal,
      cashOutTotal: movementAggregated.cashOutTotal,
      netMovements: movementAggregated.netMovements,
      movementsCount: movementAggregated.movementsCount,
    },
  };
}

export async function getDailySummary(schoolId: string, date?: Date): Promise<DailySummary> {
  const target = date ?? new Date();
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  const [shiftsOpenedToday, openShifts, shiftsClosedToday, sales, creditMovements, cashMovements] = await Promise.all([
    CashShiftModel.find({ school: schoolId, openedAt: { $gte: start, $lte: end } })
      .populate({ path: 'seller', select: 'name' })
      .lean(),
    // Turnos abiertos de días anteriores: sus ventas de hoy también están en caja y siguen pendientes de conteo.
    CashShiftModel.find({ school: schoolId, status: 'open' })
      .populate({ path: 'seller', select: 'name' })
      .lean(),
    // Turnos que abrieron otro día pero cerraron HOY: su conteo entra hoy, pero su apertura no es plata nueva de hoy.
    CashShiftModel.find({ school: schoolId, closedAt: { $gte: start, $lte: end }, openedAt: { $lt: start } })
      .populate({ path: 'seller', select: 'name' })
      .lean(),
    SaleModel.find({ school: schoolId, createdAt: { $gte: start, $lte: end }, voided: false }).lean(),
    CreditMovementModel.find({ school: schoolId, createdAt: { $gte: start, $lte: end }, type: 'payment' }).lean(),
    CashMovementModel.find({ school: schoolId, createdAt: { $gte: start, $lte: end } }).lean(),
  ]);

  const relevantOpen = openShifts.filter(s => !shiftsOpenedToday.some(t => String(t._id) === String(s._id)));
  const allRelevantShifts = [...shiftsOpenedToday, ...relevantOpen];

  const totalOpening = shiftsOpenedToday.reduce((s, sh) => s + sh.openingAmount, 0);
  // Apertura de turnos heredados (abrieron antes de hoy): la plata entró a la caja otro día,
  // pero su conteo de cierre de hoy la incluye → hay que restarla para cuadrar.
  const inheritedOpening = shiftsClosedToday.reduce((s, sh) => s + sh.openingAmount, 0);

  // Use shared calculateSalesTotals for consistency
  const salesTotals = calculateSalesTotals(sales as Array<{ type: string; paymentMethod: 'cash' | 'transfer' | 'credit'; total: number }>);

  const cashSalesTotal = salesTotals.cashTotal;
  const transferSalesTotal = salesTotals.transferTotal;
  const returnsCashTotal = salesTotals.returnsCashTotal;
  const creditPaymentsTotal = creditMovements.reduce((s, m) => s + m.amount, 0);

  const cashInTotal = cashMovements
    .filter(m => m.type === 'in')
    .reduce((sum, m) => sum + m.amount, 0);
  const cashOutTotal = cashMovements
    .filter(m => m.type === 'out')
    .reduce((sum, m) => sum + m.amount, 0);
  const netMovements = cashInTotal - cashOutTotal;

  // totalExpected = opening + cash sales - returns cash + credit payments - cash out + cash in
  const totalExpected = totalOpening + cashSalesTotal - returnsCashTotal + creditPaymentsTotal - cashOutTotal + cashInTotal;

  const closedShifts = allRelevantShifts.filter(s => s.status === 'closed');
  // Conteo de hoy = turnos que abrieron hoy y cerraron + turnos heredados que cerraron hoy
  // (los heredados no están en allRelevantShifts: abrieron antes de hoy y ya no están abiertos).
  const finalCount =
    closedShifts.reduce((s, sh) => s + (sh.closingAmount ?? 0), 0) +
    shiftsClosedToday.reduce((s, sh) => s + (sh.closingAmount ?? 0), 0);
  const openTodayOrStillOpen = allRelevantShifts.filter(s => s.status === 'open');
  // Ventas de hoy que pertenecen a turnos todavía abiertos: efectivo en caja pero aún sin contar.
  const openShiftIds = new Set(openTodayOrStillOpen.map(s => String(s._id)));
  const salesInOpenShifts = sales
    .filter(sale => openShiftIds.has(String((sale as { cashShift?: unknown }).cashShift)))
    .reduce((sum, sale) => sum + (sale as { total: number }).total, 0);
  // Diferencia real = (lo contado hoy, sin la apertura heredada que ya era plata en caja) + pendiente - operación
  const difference = finalCount - inheritedOpening + salesInOpenShifts - totalExpected;
  const shiftsWithDifference = closedShifts.filter(sh => sh.difference !== 0 && sh.difference != null).length;
  const pendingShifts = openTodayOrStillOpen
    .map(s => ({ sellerName: ((s as { seller: { name?: string | undefined } }).seller?.name ?? 'Desconocido'), id: String(s._id) }));

  return {
    date: start.toISOString().split('T')[0] as string,
    totalOpening,
    inheritedOpening,
    cashSales: cashSalesTotal,
    transferSales: transferSalesTotal,
    returns: returnsCashTotal,
    creditPayments: creditPaymentsTotal,
    cashInTotal,
    cashOutTotal,
    netMovements,
    totalExpected,
    finalCount,
    salesInOpenShifts,
    difference,
    shiftsWithDifference,
    totalShifts: allRelevantShifts.length + shiftsClosedToday.length,
    pendingShifts,
  };
}