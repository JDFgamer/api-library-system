import { SaleModel } from '../../models/Sale/index.js';
import { CashShiftModel } from '../../models/CashShift/index.js';
import { getLowStockProducts } from '../Products/index.js';
import { getCreditsSummary } from '../Credits/index.js';
import {
  aggregateSales,
  aggregateReturns,
  calculateProfitability,
  buildSeries,
  aggregateTopProducts,
  getRange,
  daysBetween,
  calculateSalesCogs,
  calculateReturnsCogs,
  type SaleLike,
  type ReturnLike,
} from './dashboard-logic.js';
import type {
  TodayKPIs,
  SalesChartData,
  TopProduct,
  DailyClosing,
  CashShiftSummary,
  DashboardOverview,
} from './types.js';

export async function getTodayKPIs(schoolId: string): Promise<TodayKPIs> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sales = await SaleModel.find({
    school: schoolId,
    createdAt: { $gte: today, $lt: tomorrow },
    voided: false,
  }).lean();

  const salesOnly = sales.filter(s => s.type === 'sale');
  const returns = sales.filter(s => s.type === 'return');

  const totalSales = salesOnly.length;
  const totalAmount = salesOnly.reduce((sum, s) => sum + s.total, 0);
  const cashAmount = salesOnly.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
  const transferAmount = salesOnly.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.total, 0);
  const creditAmount = salesOnly.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.total, 0);
  const returnsCount = returns.length;
  const returnsAmount = returns.reduce((sum, s) => sum + Math.abs(s.total), 0);
  const avgTicket = totalSales > 0 ? totalAmount / totalSales : 0;
  const productsSold = salesOnly.reduce((sum, s) => sum + s.items.reduce((isum, i) => isum + i.quantity, 0), 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySales = await SaleModel.find({
    school: schoolId,
    createdAt: { $gte: yesterday, $lt: today },
    voided: false,
  }).lean();
  const yesterdayAmount = yesterdaySales.filter(s => s.type === 'sale').reduce((sum, s) => sum + s.total, 0);
  const yesterdayReturns = yesterdaySales.filter(s => s.type === 'return').length;
  const yesterdayCount = yesterdaySales.filter(s => s.type === 'sale').length;

  return {
    totalSales,
    totalAmount,
    cashAmount,
    transferAmount,
    creditAmount,
    returnsCount,
    returnsAmount,
    avgTicket,
    productsSold,
    yesterdayAmount,
    yesterdayReturns,
    yesterdayCount,
  };
}

export async function getSalesChart(schoolId: string, days: number): Promise<SalesChartData> {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const sales = await SaleModel.find({
    school: schoolId,
    createdAt: { $gte: startDate, $lte: endDate },
    voided: false,
    type: 'sale',
  }).lean();

  const labels: string[] = [];
  const cash: number[] = [];
  const transfer: number[] = [];
  const credit: number[] = [];
  const total: number[] = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dayStr = date.toISOString().split('T')[0] ?? '';
    labels.push(dayStr);

    const daySales = sales.filter(s => s.createdAt.toISOString().split('T')[0] === dayStr);
    
    const dayCash = daySales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
    const dayTransfer = daySales.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.total, 0);
    const dayCredit = daySales.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.total, 0);
    
    cash.push(dayCash);
    transfer.push(dayTransfer);
    credit.push(dayCredit);
    total.push(dayCash + dayTransfer + dayCredit);
  }

  return { labels, datasets: { cash, transfer, credit, total } };
}

export async function getSalesByHour(schoolId: string): Promise<SalesChartData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sales = await SaleModel.find({
    school: schoolId,
    createdAt: { $gte: today, $lt: tomorrow },
    voided: false,
    type: 'sale',
  }).lean();

  const hours = Array.from({ length: 13 }, (_, i) => `${8 + i}`.padStart(2, '0'));
  const cash = new Array(13).fill(0);
  const transfer = new Array(13).fill(0);
  const credit = new Array(13).fill(0);
  const total = new Array(13).fill(0);

  for (const s of sales) {
    const h = s.createdAt.getHours();
    if (h < 8 || h > 20) continue;
    const idx = h - 8;
    const amount = s.total;
    total[idx] += amount;
    if (s.paymentMethod === 'cash') cash[idx] += amount;
    else if (s.paymentMethod === 'transfer') transfer[idx] += amount;
    else if (s.paymentMethod === 'credit') credit[idx] += amount;
  }

  return { labels: hours, datasets: { cash, transfer, credit, total } };
}

export async function getTopProducts(schoolId: string, limit: number): Promise<TopProduct[]> {
  const sales = await SaleModel.find({ school: schoolId, type: 'sale', voided: false }).lean();

  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const key = item.product.toString();
      const existing = productMap.get(key) || { name: item.name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.subtotal;
      productMap.set(key, existing);
    }
  }

  return Array.from(productMap.entries())
    .map(([productId, data]) => ({ productId, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

export async function getDailyClosing(schoolId: string, date?: string): Promise<DailyClosing> {
  const targetDate = date ? new Date(date) : new Date();
  targetDate.setHours(0, 0, 0, 0);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const sales = await SaleModel.find({
    school: schoolId,
    createdAt: { $gte: targetDate, $lt: nextDay },
    voided: false,
  }).lean();

  const salesOnly = sales.filter(s => s.type === 'sale');

  const totalSales = salesOnly.reduce((sum, s) => sum + s.total, 0);
  const cashSales = salesOnly.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
  const transferSales = salesOnly.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.total, 0);
  const creditSales = salesOnly.filter(s => s.paymentMethod === 'credit').reduce((sum, s) => sum + s.total, 0);
  const totalChange = salesOnly.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.change, 0);

  const shifts = await CashShiftModel.find({
    school: schoolId,
    openedAt: { $gte: targetDate, $lt: nextDay },
  }).lean();

  const shiftSummaries: CashShiftSummary[] = shifts.map(s => ({
    id: s._id.toString(),
    seller: s.seller.toString(),
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString(),
    openingAmount: s.openingAmount,
    expectedAmount: s.expectedAmount ?? 0,
    closingAmount: s.closingAmount,
    difference: s.difference,
    status: s.status,
  }));

  const expectedCash = shifts.reduce((sum, s) => {
    if (s.status === 'closed' && s.closingAmount !== undefined) {
      return sum + s.closingAmount;
    }
    const shiftCashSales = salesOnly.filter(sale => sale.cashShift.toString() === s._id.toString() && sale.paymentMethod === 'cash');
    const shiftCashTotal = shiftCashSales.reduce((sum, sale) => sum + sale.total, 0);
    return sum + (s.openingAmount + shiftCashTotal);
  }, 0);

  const countedCash = shifts
    .filter(s => s.status === 'closed' && s.closingAmount !== undefined)
    .reduce((sum, s) => sum + (s.closingAmount ?? 0), 0);

  const difference = countedCash - expectedCash;

  return {
    date: targetDate.toISOString().split('T')[0] ?? '',
    totalSales,
    cashSales,
    transferSales,
    creditSales,
    totalChange,
    shifts: shiftSummaries,
    expectedCash,
    countedCash,
    difference,
  };
}

export async function getShifts(schoolId: string, fromDate?: Date, toDate?: Date): Promise<CashShiftSummary[]> {
  const filter: Record<string, unknown> = { school: schoolId };
  if (fromDate || toDate) {
    filter.openedAt = {};
    if (fromDate) (filter.openedAt as Record<string, Date>).$gte = fromDate;
    if (toDate) (filter.openedAt as Record<string, Date>).$lte = toDate;
  }

  const shifts = await CashShiftModel.find(filter).sort({ openedAt: -1 }).lean();

  return shifts.map(s => ({
    id: s._id.toString(),
    seller: s.seller.toString(),
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString(),
    openingAmount: s.openingAmount,
    expectedAmount: s.expectedAmount ?? 0,
    closingAmount: s.closingAmount,
    difference: s.difference,
    status: s.status,
  }));
}

export async function getOverview(
  schoolId: string,
  from?: Date,
  to?: Date
): Promise<DashboardOverview> {
  const { from: startDate, to: endDate } = getRange(from, to);
  const days = daysBetween(startDate, endDate);

  const [sales, returns, lowStock, creditSummary] = await Promise.all([
    SaleModel.find({
      school: schoolId,
      createdAt: { $gte: startDate, $lte: endDate },
      voided: false,
      type: 'sale',
    }).lean(),
    SaleModel.find({
      school: schoolId,
      createdAt: { $gte: startDate, $lte: endDate },
      voided: false,
      type: 'return',
    }).lean(),
    getLowStockProducts(schoolId),
    getCreditsSummary(schoolId),
  ]);

  const salesAgg = aggregateSales(sales as SaleLike[]);
  const returnsAgg = aggregateReturns(returns as ReturnLike[]);

  const salesCogs = calculateSalesCogs(sales as SaleLike[]);
  const returnsCogs = calculateReturnsCogs(returns as ReturnLike[]);
  const revenue = salesAgg.total - returnsAgg.amount;
  const cost = salesCogs - returnsCogs;
  const profitability = calculateProfitability(revenue, cost);

  const series = buildSeries(sales as SaleLike[], startDate, endDate);
  const topProducts = aggregateTopProducts(sales as SaleLike[], 5);

  return {
    range: {
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      days,
    },
    sales: salesAgg,
    returns: returnsAgg,
    profitability,
    series,
    topProducts,
    lowStock,
    credit: {
      totalOutstanding: creditSummary.totalOutstanding,
      clientsWithDebt: creditSummary.clientsWithDebt,
      clients: creditSummary.clients,
    },
  };
}