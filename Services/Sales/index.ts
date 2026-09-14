import { SaleModel } from '../../models/Sale/index.js';
import type { SaleLean, SaleSource } from '../../models/Sale/index.js';
import { PaymentMethod } from '../../models/Sale/index.js';
import { ProductModel } from '../../models/Product/index.js';
import { ClientModel } from '../../models/Client/index.js';
import { CashShiftModel } from '../../models/CashShift/index.js';
import { CashMovementModel } from '../../models/CashMovement/index.js';
import { CreditMovementModel } from '../../models/CreditMovement/index.js';
import type { CreditMovementLean } from '../../models/CreditMovement/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors.js';
import { withId, withIds } from '../../utils/lean.js';
import type { ClientSession } from 'mongoose';
import type {
  SaleItemForStockRestore,
  SaleDocumentForVoid,
  CreditReversalParams,
  SalePreviewResult,
  SaleResult,
  SaleListResult,
  PopulatedSaleLean,
  SalesSummary,
  CreateReturnParams,
} from './types.js';

export async function previewSale(
  schoolId: string,
  items: Array<{ product: string; quantity: number }>,
  clientId: string | undefined,
  discount: number,
  paymentMethod: PaymentMethod,
  amountReceived?: number
): Promise<SalePreviewResult> {
  const [products, client, activeShift] = await Promise.all([
    ProductModel.find({ _id: { $in: items.map(i => i.product) }, school: schoolId }).lean(),
    clientId ? ClientModel.findOne({ _id: clientId, school: schoolId }).lean() : Promise.resolve(null),
    CashShiftModel.findOne({ school: schoolId, status: 'open' }).lean(),
  ]);

  if (paymentMethod === 'credit' && !client) {
    throw new NotFoundError('Cliente requerido para venta a crédito');
  }
  if (!activeShift) {
    throw new ConflictError('No hay turno de caja abierto');
  }

  const saleItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = products.find(p => p._id.toString() === item.product);
    if (!product) {
      throw new NotFoundError(`Producto no encontrado: ${item.product}`);
    }
    if (!product.active) {
      throw new ValidationError(`Producto no disponible: ${product.name}`);
    }

    // Validate stock for products (not services)
    if (product.type === 'product' && product.stock < item.quantity) {
      throw new ValidationError(
        `Stock insuficiente para "${product.name}": solicitado ${item.quantity}, disponible ${product.stock}`
      );
    }

    const unitPrice = product.price;
    const itemSubtotal = unitPrice * item.quantity;
    subtotal += itemSubtotal;

    saleItems.push({
      product: product._id.toString(),
      name: product.name,
      type: product.type,
      quantity: item.quantity,
      unitPrice,
      unitCost: product.cost ?? 0,
      subtotal: itemSubtotal,
      availableStock: product.type === 'product' ? product.stock : undefined,
    });
  }

  if (discount > subtotal) {
    throw new ValidationError('El descuento no puede ser mayor al subtotal');
  }

  const total = subtotal - discount;
  let change = 0;
  let creditBalanceAfter: number | undefined;

  if (paymentMethod === 'cash' || paymentMethod === 'transfer') {
    if (amountReceived === undefined || amountReceived < total) {
      throw new ValidationError('Monto recibido insuficiente para pago');
    }
    change = amountReceived - total;
  } else if (paymentMethod === 'credit') {
    creditBalanceAfter = client!.balance + total;
  }

  return {
    items: saleItems,
    subtotal,
    discount,
    total,
    amountReceived,
    change,
    paymentMethod,
    creditBalanceAfter,
  };
}

export async function createSale(
  schoolId: string,
  sellerId: string,
  cashShiftId: string,
  items: Array<{ product: string; quantity: number }>,
  clientId: string | undefined,
  discount: number,
  paymentMethod: PaymentMethod,
  amountReceived?: number,
  source: SaleSource = 'pos'
): Promise<SaleResult> {
  let effectiveClientId = clientId;

  // Default to "consumidor final" client for cash/transfer if not specified
  if (paymentMethod !== 'credit' && !clientId) {
    const defaultClient = await ClientModel.findOne({ fullName: 'Consumidor Final', school: schoolId }).lean();
    if (defaultClient) {
      effectiveClientId = defaultClient._id.toString();
    }
  }

  const preview = await previewSale(schoolId, items, clientId, discount, paymentMethod, amountReceived);

  const session = await SaleModel.db.startSession();
  session.startTransaction();

  try {
    // Update product stock atomically to prevent race conditions
    for (const item of items) {
      const product = await ProductModel.findOne({ _id: item.product, school: schoolId }).session(session);
      if (!product) throw new Error(`Product not found: ${item.product}`);
      if (product.type === 'product') {
        const updated = await ProductModel.findOneAndUpdate(
          { _id: item.product, school: schoolId, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, new: true }
        );
        if (!updated) {
          // Re-fetch to get current stock for error message
          const current = await ProductModel.findOne({ _id: item.product, school: schoolId }).session(session);
          throw new ValidationError(`Stock insuficiente para "${product.name}": solicitado ${item.quantity}, disponible ${current?.stock ?? 0}`);
        }
      }
    }

    // Generate sequential receipt number within the transaction
    const lastNumber = await SaleModel.findOne({ school: schoolId }, { number: 1 }).sort({ number: -1 }).session(session);
    const nextNumber = (lastNumber?.number ?? 0) + 1;

    // Create sale
    const sale = await SaleModel.create([{
      items: preview.items.map(i => ({
        product: i.product,
        name: i.name,
        type: i.type,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unitCost: i.unitCost,
        subtotal: i.subtotal,
      })),
      number: nextNumber,
      subtotal: preview.subtotal,
      discount: preview.discount,
      total: preview.total,
      amountReceived: preview.amountReceived ?? 0,
      change: preview.change ?? 0,
      paymentMethod: preview.paymentMethod,
      type: 'sale',
      client: effectiveClientId ?? undefined,
      seller: sellerId,
      cashShift: cashShiftId,
      school: schoolId,
      settled: paymentMethod !== 'credit',
      source,
    }], { session });

    let creditMovement;
    if (paymentMethod === 'credit' && clientId) {
      const client = await ClientModel.findOne({ _id: clientId, school: schoolId }).session(session);
      if (!client) throw new Error('Client not found');

      const newBalance = client.balance + preview.total;
      client.balance = newBalance;
      await client.save({ session });

      creditMovement = await CreditMovementModel.create([{
        client: clientId,
        sale: sale[0]!._id,
        school: schoolId,
        type: 'debt',
        amount: preview.total,
        balanceAfter: newBalance,
        admin: sellerId,
      }], { session });
    }

    await session.commitTransaction();

    return {
      sale: sale[0]!.toJSON() as SaleLean,
      creditMovement: creditMovement?.[0]?.toJSON() as CreditMovementLean,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function voidSale(schoolId: string, saleId: string, adminId: string, reason: string): Promise<SaleLean> {
  const sale = await SaleModel.findOne({ _id: saleId, school: schoolId });
  if (!sale) {
    throw new NotFoundError('Venta no encontrada');
  }
  if (sale.voided) {
    throw new ConflictError('La venta ya está anulada');
  }
  if (sale.type === 'return' || sale.type === 'credit_note') {
    throw new ValidationError('No se puede anular una devolución ni una nota de crédito');
  }

  const session = await SaleModel.db.startSession();
  session.startTransaction();

  try {
    // Restore stock
    for (const item of sale.items) {
      const product = await ProductModel.findOne({ _id: item.product, school: schoolId }).session(session);
      if (product && product.type === 'product') {
        product.stock += item.quantity;
        await product.save({ session });
      }
    }

    // Reverse credit if applicable
    if (sale.paymentMethod === 'credit' && !sale.settled) {
      const client = await ClientModel.findOne({ _id: sale.client, school: schoolId }).session(session);
      if (client) {
        client.balance -= sale.total;
        await client.save({ session });

        await CreditMovementModel.create([{
          client: sale.client,
          sale: sale._id,
          school: schoolId,
          type: 'payment',
          amount: sale.total,
          balanceAfter: client.balance,
          method: 'cash',
          note: `Anulación: ${reason}`,
          admin: adminId,
        }], { session });
      }
    }

    sale.voided = true;
    sale.voidedAt = new Date();
    sale.voidReason = reason;
    await sale.save({ session });

    await session.commitTransaction();
    return sale.toJSON() as SaleLean;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function returnSale(
  schoolId: string,
  saleId: string,
  adminId: string,
  reason: string,
  returnItems: Array<{ productId: string; quantity: number }>,
  method: 'cash' | 'credit'
): Promise<SaleResult> {
  const originalSale = await SaleModel.findOne({ _id: saleId, school: schoolId });
  if (!originalSale) {
    throw new NotFoundError('Venta original no encontrada');
  }
  if (originalSale.voided) {
    throw new ConflictError('No se puede devolver una venta anulada');
  }
  if (originalSale.type === 'return' || originalSale.type === 'credit_note') {
    throw new ValidationError('No se puede devolver una devolución ni una nota de crédito');
  }

  // Cantidades ya devueltas de esta venta para impedir doble devolución del mismo ítem
  const previousReturns = await SaleModel.find({
    originalSale: saleId,
    school: schoolId,
    type: 'return',
    voided: false,
  }).lean();
  const alreadyReturnedByProduct = new Map<string, number>();
  for (const previousReturn of previousReturns) {
    for (const item of previousReturn.items) {
      const key = String(item.product);
      alreadyReturnedByProduct.set(key, (alreadyReturnedByProduct.get(key) ?? 0) + item.quantity);
    }
  }

  // Validate return items against original sale and previous returns
  for (const returnItem of returnItems) {
    const originalItem = originalSale.items.find(i => i.product.toString() === returnItem.productId);
    if (!originalItem) {
      throw new ValidationError(`Producto no encontrado en la venta original: ${returnItem.productId}`);
    }
    const alreadyReturned = alreadyReturnedByProduct.get(returnItem.productId) ?? 0;
    if (returnItem.quantity + alreadyReturned > originalItem.quantity) {
      throw new ValidationError(`Cantidad a devolver (${returnItem.quantity}) supera la disponible para devolver (${Math.max(0, originalItem.quantity - alreadyReturned)})`);
    }
  }

  const session = await SaleModel.db.startSession();
  session.startTransaction();

  try {
    // Calculate return amounts
    let returnSubtotal = 0;
    const returnSaleItems = [];

    for (const returnItem of returnItems) {
      const originalItem = originalSale.items.find(i => i.product.toString() === returnItem.productId)!;
      const itemSubtotal = originalItem.unitPrice * returnItem.quantity;
      returnSubtotal += itemSubtotal;

      returnSaleItems.push({
        product: returnItem.productId,
        name: originalItem.name,
        type: originalItem.type,
        quantity: returnItem.quantity,
        unitPrice: originalItem.unitPrice,
        unitCost: originalItem.unitCost ?? 0,
        subtotal: itemSubtotal,
      });

      // Restore stock
      const product = await ProductModel.findOne({ _id: returnItem.productId, school: schoolId }).session(session);
      if (product && product.type === 'product') {
        product.stock += returnItem.quantity;
        await product.save({ session });
      }
    }

    const returnDiscount = 0; // No discount on returns
    const returnTotal = returnSubtotal;

    // Create return sale
    const returnSale = await SaleModel.create([{
      items: returnSaleItems,
      subtotal: returnSubtotal,
      discount: returnDiscount,
      total: returnTotal,
      amountReceived: 0,
      change: 0,
      paymentMethod: method,
      type: 'return',
      client: originalSale.client,
      seller: adminId,
      cashShift: originalSale.cashShift,
      school: schoolId,
      originalSale: originalSale._id,
      settled: method !== 'credit',
    }], { session });

    let creditMovement;
    if (method === 'credit') {
      const client = await ClientModel.findOne({ _id: originalSale.client, school: schoolId }).session(session);
      if (!client) throw new Error('Client not found');

      const newBalance = client.balance - returnTotal;
      client.balance = newBalance;
      await client.save({ session });

      creditMovement = await CreditMovementModel.create([{
        client: originalSale.client,
        sale: returnSale[0]!._id,
        school: schoolId,
        type: 'payment',
        amount: returnTotal,
        balanceAfter: newBalance,
        method,
        note: `Devolución: ${reason}`,
        admin: adminId,
      }], { session });
    } else if (method === 'cash') {
      // For cash returns, we create a credit movement of type payment
      // but the actual cash comes from the register
      creditMovement = await CreditMovementModel.create([{
        client: originalSale.client,
        sale: returnSale[0]!._id,
        school: schoolId,
        type: 'payment',
        amount: returnTotal,
        balanceAfter: (await ClientModel.findOne({ _id: originalSale.client, school: schoolId }).session(session))?.balance ?? 0,
        method: 'cash',
        note: `Devolución en efectivo: ${reason}`,
        admin: adminId,
      }], { session });
    }

    await session.commitTransaction();

    return {
      sale: returnSale[0]!.toJSON() as SaleLean,
      creditMovement: creditMovement?.[0]?.toJSON() as CreditMovementLean,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function listSales(params: {
  schoolId: string;
  clientId?: string;
  sellerId?: string;
  paymentMethod?: 'cash' | 'transfer' | 'credit';
  type?: 'sale' | 'return' | 'credit_note';
  voided?: boolean;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): Promise<SaleListResult> {
  const filter: Record<string, unknown> = { school: params.schoolId };

  if (params.clientId) filter.client = params.clientId;
  if (params.sellerId) filter.seller = params.sellerId;
  if (params.paymentMethod) filter.paymentMethod = params.paymentMethod;
  if (params.type) filter.type = params.type;
  if (params.voided !== undefined) filter.voided = params.voided;
  if (params.fromDate || params.toDate) {
    filter.createdAt = {};
    if (params.fromDate) (filter.createdAt as Record<string, Date>).$gte = params.fromDate;
    if (params.toDate) (filter.createdAt as Record<string, Date>).$lte = params.toDate;
  }
  if (params.search) {
    const asNumber = Number(params.search);
    if (!Number.isNaN(asNumber)) {
      filter.number = asNumber;
    }
  }

  const sort: Record<string, 1 | -1> = { [params.sortBy]: params.sortOrder === 'asc' ? 1 : -1 };

  const [items, total] = await Promise.all([
    SaleModel.find(filter)
      .sort(sort)
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .populate('client', 'fullName balance')
      .populate('seller', 'name role')
      .lean(),
    SaleModel.countDocuments(filter),
  ]);

  return {
    items: withIds(items) as unknown as PopulatedSaleLean[],
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

export async function getSaleById(schoolId: string, id: string): Promise<SaleLean> {
  const sale = await SaleModel.findOne({ _id: id, school: schoolId })
    .populate('client', 'fullName balance dni')
    .populate('seller', 'name role')
    .lean();
  if (!sale) {
    throw new NotFoundError('Venta no encontrada');
  }
  return withId(sale) as SaleLean;
}

export async function getSalesSummary(schoolId: string): Promise<SalesSummary> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Today's stats
  const [todaySales, todayReturns] = await Promise.all([
    SaleModel.find({ school: schoolId, createdAt: { $gte: today }, type: 'sale', voided: false }).lean(),
    SaleModel.find({ school: schoolId, createdAt: { $gte: today }, type: 'return', voided: false }).lean(),
  ]);

  // Yesterday's stats for growth
  const yesterdaySalesCount = await SaleModel.countDocuments({
    school: schoolId,
    createdAt: { $gte: yesterday, $lt: today },
    type: 'sale',
    voided: false,
  });

  const salesTodayCount = todaySales.length;
  let salesGrowth = 0;
  if (yesterdaySalesCount > 0) {
    salesGrowth = ((salesTodayCount - yesterdaySalesCount) / yesterdaySalesCount) * 100;
  } else if (salesTodayCount > 0) {
    salesGrowth = 100;
  }

  const totalRevenue = todaySales.reduce((acc, sale) => acc + sale.total, 0);
  const returnsCount = todayReturns.length;
  const returnsAmount = todayReturns.reduce((acc, ret) => acc + ret.total, 0);
  const averageTicket = salesTodayCount > 0 ? totalRevenue / salesTodayCount : 0;

  return {
    salesToday: salesTodayCount,
    salesGrowth: Math.round(salesGrowth),
    totalRevenue,
    returnsCount,
    returnsAmount,
    averageTicket,
  };
}

export async function createReturn(params: CreateReturnParams): Promise<SaleResult> {
  const { schoolId, sellerId, cashShiftId, items, clientId, method } = params;

  const [products, , cashShift] = await Promise.all([
    ProductModel.find({ _id: { $in: items.map(i => i.product) }, school: schoolId }).lean(),
    clientId ? ClientModel.findOne({ _id: clientId, school: schoolId }).lean() : Promise.resolve(null),
    CashShiftModel.findOne({ _id: cashShiftId, school: schoolId }).lean(),
  ]);

  if (!cashShift) {
    throw new ConflictError('Turno de caja no encontrado');
  }
  if (cashShift.status !== 'open') {
    throw new ConflictError('El turno de caja está cerrado');
  }
  if (method === 'credit' && !clientId) {
    throw new ValidationError('Cliente requerido para devolución a crédito');
  }

  const returnItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = products.find(p => p._id.toString() === item.product);
    if (!product) {
      throw new NotFoundError(`Producto no encontrado: ${item.product}`);
    }
    // For returns, we don't require product.active

    const unitPrice = product.price;
    const itemSubtotal = unitPrice * item.quantity;
    subtotal += itemSubtotal;

    returnItems.push({
      product: product._id.toString(),
      name: product.name,
      type: product.type,
      quantity: item.quantity,
      unitPrice,
      unitCost: product.cost ?? 0,
      subtotal: itemSubtotal,
    });
  }

  const discount = 0; // No discount on returns
  const total = subtotal;

  // Guard de caja: no se puede devolver más efectivo del que realmente hay en el turno.
  if (method === 'cash') {
    const [cashSales, cashReturns, cashIn, cashOut] = await Promise.all([
      SaleModel.find({ school: schoolId, cashShift: cashShiftId, type: 'sale', paymentMethod: 'cash', voided: false }).lean(),
      SaleModel.find({ school: schoolId, cashShift: cashShiftId, type: 'return', paymentMethod: 'cash', voided: false }).lean(),
      CashMovementModel.find({ school: schoolId, cashShift: cashShiftId, type: 'in' }).lean(),
      CashMovementModel.find({ school: schoolId, cashShift: cashShiftId, type: 'out' }).lean(),
    ]);

    const cashAvailable =
      (cashShift.openingAmount ?? 0) +
      cashSales.reduce((sum, sale) => sum + sale.total, 0) -
      cashReturns.reduce((sum, sale) => sum + sale.total, 0) +
      cashIn.reduce((sum, movement) => sum + movement.amount, 0) -
      cashOut.reduce((sum, movement) => sum + movement.amount, 0);

    if (total > cashAvailable) {
      throw new ValidationError(`No hay suficiente efectivo en caja para la devolución (disponible: ${cashAvailable})`);
    }
  }

  const session = await SaleModel.db.startSession();
  session.startTransaction();

  try {
    // Restore stock for products
    for (const item of items) {
      const product = await ProductModel.findOne({ _id: item.product, school: schoolId }).session(session);
      if (product && product.type === 'product') {
        product.stock += item.quantity;
        await product.save({ session });
      }
    }

    // Generate sequential receipt number within the transaction (shared with sales)
    const lastNumber = await SaleModel.findOne({ school: schoolId }, { number: 1 }).sort({ number: -1 }).session(session);
    const nextNumber = (lastNumber?.number ?? 0) + 1;

    // Create return sale
    const sale = await SaleModel.create([{
      items: returnItems,
      number: nextNumber,
      subtotal,
      discount,
      total,
      amountReceived: 0,
      change: 0,
      paymentMethod: method,
      type: 'return',
      client: clientId ?? undefined,
      seller: sellerId,
      cashShift: cashShiftId,
      school: schoolId,
      settled: method !== 'credit',
    }], { session });

    let creditMovement;
    if (method === 'credit' && clientId) {
      const clientDoc = await ClientModel.findOne({ _id: clientId, school: schoolId }).session(session);
      if (!clientDoc) throw new Error('Client not found');

      const newBalance = clientDoc.balance - total;
      clientDoc.balance = newBalance;
      await clientDoc.save({ session });

      creditMovement = await CreditMovementModel.create([{
        client: clientId,
        sale: sale[0]!._id,
        school: schoolId,
        type: 'payment',
        amount: total,
        balanceAfter: newBalance,
        method: 'credit',
        note: 'Devolución a crédito',
        admin: sellerId,
      }], { session });
    }

    await session.commitTransaction();

    return {
      sale: sale[0]!.toJSON() as SaleLean,
      creditMovement: creditMovement?.[0]?.toJSON() as CreditMovementLean,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

async function restoreStockForItems(
  items: SaleItemForStockRestore[],
  schoolId: string,
  session: ClientSession
): Promise<void> {
  for (const item of items) {
    if (item.type === 'product') {
      const product = await ProductModel.findOne({ _id: item.product, school: schoolId }).session(session);
      if (product) {
        product.stock += item.quantity;
        await product.save({ session });
      }
    }
  }
}

async function reverseCreditForVoid(
  params: CreditReversalParams
): Promise<CreditMovementLean | undefined> {
  const { sale, schoolId, adminId, reason, session } = params;
  if (sale.paymentMethod === 'credit' && !sale.settled && sale.client) {
    const client = await ClientModel.findOne({ _id: sale.client, school: schoolId }).session(session);
    if (client) {
      client.balance -= sale.total;
      await client.save({ session });

      const creditMovement = await CreditMovementModel.create([{
        client: sale.client,
        sale: sale._id,
        school: schoolId,
        type: 'payment',
        amount: sale.total,
        balanceAfter: client.balance,
        method: 'cash',
        note: `Nota de crédito: ${reason}`,
        admin: adminId,
      }], { session });

      return creditMovement[0]?.toJSON() as CreditMovementLean;
    }
  }
  return undefined;
}

export async function createCreditNote(
  schoolId: string,
  saleId: string,
  adminId: string,
  reason?: string
): Promise<SaleResult> {
  const originalSale = await SaleModel.findOne({ _id: saleId, school: schoolId });
  if (!originalSale) {
    throw new NotFoundError('Venta no encontrada');
  }
  if (originalSale.voided) {
    throw new ConflictError('La venta ya está anulada');
  }
  if (originalSale.type !== 'sale') {
    throw new ValidationError('Solo se puede emitir nota de crédito sobre una venta');
  }

  const session = await SaleModel.db.startSession();
  session.startTransaction();

  try {
    // 1. Restaurar stock
    const itemsForStockRestore: SaleItemForStockRestore[] = originalSale.items.map(i => ({
      product: i.product.toString(),
      quantity: i.quantity,
      type: i.type,
    }));
    await restoreStockForItems(itemsForStockRestore, schoolId, session);

    // 2. Revertir crédito si aplica
    await reverseCreditForVoid({
      sale: originalSale as SaleDocumentForVoid,
      schoolId,
      adminId,
      reason: reason || 'Nota de crédito',
      session,
    });

    // 3. Marcar venta original como anulada
    originalSale.voided = true;
    originalSale.voidedAt = new Date();
    originalSale.voidReason = reason || 'Nota de crédito';
    await originalSale.save({ session });

    // 4. Generar número secuencial
    const lastNumber = await SaleModel.findOne({ school: schoolId }, { number: 1 }).sort({ number: -1 }).session(session);
    const nextNumber = (lastNumber?.number ?? 0) + 1;

    // 5. Crear la nota de crédito
    const creditNote = await SaleModel.create([{
      items: originalSale.items.map(i => ({
        product: i.product,
        name: i.name,
        type: i.type,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unitCost: i.unitCost,
        subtotal: i.subtotal,
      })),
      number: nextNumber,
      subtotal: originalSale.subtotal,
      discount: originalSale.discount,
      total: originalSale.total,
      amountReceived: 0,
      change: 0,
      paymentMethod: originalSale.paymentMethod,
      type: 'credit_note',
      client: originalSale.client,
      seller: adminId,
      cashShift: originalSale.cashShift,
      school: schoolId,
      originalSale: originalSale._id,
      settled: true,
      voided: false,
    }], { session });

    await session.commitTransaction();

    return {
      sale: creditNote[0]!.toJSON() as SaleLean,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}