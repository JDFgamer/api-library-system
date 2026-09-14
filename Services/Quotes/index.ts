import { QuoteModel } from '../../models/Quote/index.js';
import type { QuoteLean } from '../../models/Quote/index.js';
import { generateQuotePublicCode } from '../../models/Quote/index.js';
import type { QuoteSource } from '../../models/Quote/index.js';
import { ProductModel } from '../../models/Product/index.js';
import { ClientModel } from '../../models/Client/index.js';
import { CashShiftModel } from '../../models/CashShift/index.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { withId, withIds } from '../../utils/lean.js';
import * as salesService from '../Sales/index.js';
import * as conversationsService from '../Ai/conversations/index.js';
import { SettingModel } from '../../models/Setting/index.js';
import type { IQuote } from '../../models/Quote/index.js';

/**
 * Mensaje que el bot le deja al cliente cuando el staff cambia el estado de su
 * pedido (confirmado/pago/listo). El texto lo define el dueño en el admin; si
 * no configuró ninguno, se usan defaults. El mensaje entra al historial de la
 * conversación como si fuera del asistente, así el cliente lo ve al volver.
 */
const DEFAULT_STATUS_MESSAGES: Record<'confirmed' | 'paid' | 'ready' | 'paying', string> = {
  confirmed: '¡Buenas noticias! Tomamos tu pedido. Te avisamos cuando esté listo.',
  paid: '¡Listo! Ya quedó registrado el pago de tu pedido.',
  ready: '¡Tu pedido ya está listo para retirar! Te esperamos.',
  paying: '¡Recibimos tu aviso de pago! En cuanto el negocio verifique el comprobante, queda todo saldado.',
};

export const notifyBotStatusChange = async (quote: IQuote, nextStatus: string): Promise<void> => {
  const sessionId = quote.botSessionId;
  if (!sessionId) return; // pedido creado antes de esta feature o desde el POS

  const knownStatuses = ['confirmed', 'paid', 'ready', 'paying'];
  if (!knownStatuses.includes(nextStatus)) return;

  try {
    const settings = await SettingModel.findOne({ school: quote.school }).lean();
    const custom = (nextStatus === 'paying'
      ? ''
      : settings?.botStatusMessages?.[nextStatus as 'confirmed' | 'paid' | 'ready']) ?? '';
    const message = custom.trim() || DEFAULT_STATUS_MESSAGES[nextStatus as keyof typeof DEFAULT_STATUS_MESSAGES];

    await conversationsService.appendMessages(String(quote.school), sessionId, [
      { role: 'assistant', content: message },
    ]);
  } catch (error) {
    // El cambio de estado ya se guardó: que el aviso al cliente nunca lo revierta.
    console.error('Error notificando cambio de estado al bot', error instanceof Error ? error.message : error);
  }
};

export interface QuotePreviewResult {
  items: Array<{
    product: string;
    name: string;
    type: 'product' | 'service';
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
}

export interface QuoteResult {
  quote: QuoteLean;
}

export interface QuoteItemInfo {
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

export type PopulatedQuoteLean = Omit<QuoteLean, 'client' | 'seller'> & {
  number: number;
  client?: PopulatedClientInfo | null;
  seller: PopulatedUserInfo;
  items: QuoteItemInfo[];
};

export interface QuoteListResult {
  items: PopulatedQuoteLean[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type BotOrderStatus = 'active' | 'confirmed' | 'ready' | 'paying' | 'paid' | 'cancelled';

const BOT_ORDER_TRANSITIONS: Record<Exclude<BotOrderStatus, 'cancelled' | 'paid' | 'paying'>, BotOrderStatus[]> = {
  active: ['confirmed', 'cancelled'],
  confirmed: ['ready', 'paid', 'cancelled'],
  ready: ['paid', 'cancelled'],
};

const PAYABLE_STATUSES = ['confirmed', 'ready'] as const;
const PAYING_STALE_MS = 5 * 60 * 1000;

export const previewQuote = async (
  schoolId: string,
  items: Array<{ product: string; quantity: number }>,
  clientId: string | undefined,
  discount: number
) => {
  const [products] = await Promise.all([
    ProductModel.find({ _id: { $in: items.map(i => i.product) }, school: schoolId }).lean(),
    clientId ? ClientModel.findOne({ _id: clientId, school: schoolId }).lean() : Promise.resolve(null),
  ]);

  const quoteItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = products.find(p => p._id.toString() === item.product);
    if (!product) {
      throw new NotFoundError(`Producto no encontrado: ${item.product}`);
    }
    if (!product.active) {
      throw new ValidationError(`Producto no disponible: ${product.name}`);
    }

    const unitPrice = product.price;
    const itemSubtotal = unitPrice * item.quantity;
    subtotal += itemSubtotal;

    quoteItems.push({
      product: product._id.toString(),
      name: product.name,
      type: product.type,
      quantity: item.quantity,
      unitPrice,
      unitCost: product.cost ?? 0,
      subtotal: itemSubtotal,
    });
  }

  if (discount > subtotal) {
    throw new ValidationError('El descuento no puede ser mayor al subtotal');
  }

  const total = subtotal - discount;

  return {
    items: quoteItems,
    subtotal,
    discount,
    total,
  };
}

const PUBLIC_CODE_MAX_ATTEMPTS = 3;

const generateUniquePublicCode = async () => {
  for (let attempt = 0; attempt < PUBLIC_CODE_MAX_ATTEMPTS; attempt++) {
    const candidate = generateQuotePublicCode();
    const exists = await QuoteModel.exists({ publicCode: candidate });
    if (!exists) {
      return candidate;
    }
  }
  throw new ValidationError('No se pudo generar un código de pedido único, reintentá');
}

export interface CreateQuoteOptions {
  source?: QuoteSource;
  customerName?: string;
  customerPhone?: string;
  botSessionId?: string;
}

export const createQuote = async (
  schoolId: string,
  sellerId: string,
  items: Array<{ product: string; quantity: number }>,
  clientId: string | undefined,
  discount: number,
  options: CreateQuoteOptions = {}
) => {
  const preview = await previewQuote(schoolId, items, clientId, discount);

  const session = await QuoteModel.db.startSession();
  session.startTransaction();

  try {
    // Generate sequential quote number within the transaction
    const lastNumber = await QuoteModel.findOne({ school: schoolId }, { number: 1 }).sort({ number: -1 }).session(session);
    const nextNumber = (lastNumber?.number ?? 0) + 1;
    const source = options.source ?? 'pos';
    const publicCode = source === 'bot' ? await generateUniquePublicCode() : undefined;

    // Create quote
    const quote = await QuoteModel.create([{
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
      client: clientId ?? undefined,
      seller: sellerId,
      school: schoolId,
      status: 'active',
      source,
      publicCode,
      customerName: options.customerName ?? '',
      customerPhone: options.customerPhone ?? '',
      botSessionId: options.botSessionId ?? '',
    }], { session });

    await session.commitTransaction();

    return {
      quote: quote[0]!.toJSON() as QuoteLean,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export const getQuoteById = async (schoolId: string, id: string) => {
  const quote = await QuoteModel.findOne({ _id: id, school: schoolId })
    .populate('client', 'fullName balance')
    .populate('seller', 'name role')
    .lean();
  if (!quote) {
    throw new NotFoundError('Presupuesto no encontrado');
  }
  return withId(quote) as QuoteLean;
}

export const listQuotes = async (params: {
  schoolId: string;
  clientId?: string;
  sellerId?: string;
  status?: 'active' | 'confirmed' | 'ready' | 'paying' | 'paid' | 'cancelled';
  source?: 'pos' | 'bot';
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}) => {
  const filter: Record<string, unknown> = { school: params.schoolId };

  if (params.clientId) filter.client = params.clientId;
  if (params.sellerId) filter.seller = params.sellerId;
  if (params.status) filter.status = params.status;
  if (params.source) filter.source = params.source;
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
    QuoteModel.find(filter)
      .sort(sort)
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .populate('client', 'fullName balance')
      .populate('seller', 'name role')
      .lean(),
    QuoteModel.countDocuments(filter),
  ]);

  return {
    items: withIds(items) as unknown as PopulatedQuoteLean[],
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  };
}

export const cancelQuote = async (schoolId: string, id: string) => {
  const quote = await QuoteModel.findOne({ _id: id, school: schoolId });
  if (!quote) {
    throw new NotFoundError('Presupuesto no encontrado');
  }
  if (quote.status === 'paying') {
    throw new ValidationError('El pedido se está cobrando ahora mismo, esperá unos segundos');
  }
  if (quote.status === 'cancelled') {
    throw new ValidationError('El presupuesto ya está cancelado');
  }

  quote.status = 'cancelled';
  await quote.save();

  return quote.toJSON() as QuoteLean;
}

export const setBotOrderStatus = async (
  schoolId: string,
  id: string,
  nextStatus: Exclude<BotOrderStatus, 'cancelled' | 'paid' | 'paying'>,
): Promise<QuoteLean> => {
  const quote = await QuoteModel.findOne({ _id: id, school: schoolId, source: 'bot' });
  if (!quote) {
    throw new NotFoundError('Pedido no encontrado');
  }
  if (quote.status === 'cancelled' || quote.status === 'paid' || quote.status === 'paying') {
    throw new ValidationError('El pedido está cerrado o en cobro y no puede cambiar de estado');
  }

  const allowed = BOT_ORDER_TRANSITIONS[quote.status as Exclude<BotOrderStatus, 'cancelled' | 'paid' | 'paying'>];
  if (!allowed.includes(nextStatus)) {
    throw new ValidationError(`No podés pasar un pedido de "${quote.status}" a "${nextStatus}"`);
  }

  quote.status = nextStatus;
  await quote.save();

  await notifyBotStatusChange(quote, nextStatus);

  return quote.toJSON() as QuoteLean;
};

/** El cliente avisa que ya pagó (transferencia): el pedido pasa a 'paying' hasta
 *  que el staff verifique el comprobante y lo cobre. Idempotente y solo para
 *  pedidos confirmados/listos con intención de transferencia. */
export const markBotOrderPaying = async (
  schoolId: string,
  publicCode: string
): Promise<QuoteLean> => {
  const quote = await QuoteModel.findOne({ publicCode, school: schoolId, source: 'bot' });
  if (!quote) {
    throw new NotFoundError('Pedido no encontrado');
  }
  if (quote.status === 'paying') {
    return quote.toJSON() as QuoteLean; // ya avisó: idempotente
  }
  if (quote.status === 'paid') {
    throw new ValidationError('El pedido ya está pagado');
  }
  if (quote.status === 'cancelled') {
    throw new ValidationError('El pedido fue cancelado');
  }
  if (quote.paymentIntent !== 'transfer') {
    throw new ValidationError('Este pedido no es de pago por transferencia');
  }
  if (quote.status === 'active') {
    throw new ValidationError('El pedido todavía no fue confirmado por el negocio');
  }

  quote.status = 'paying';
  quote.payingBy = 'customer';
  await quote.save();

  await notifyBotStatusChange(quote, 'paying');

  return quote.toJSON() as QuoteLean;
};
export interface PayBotQuoteResult {
  quote: QuoteLean;
  sale: SaleLeanLike;
}

type SaleLeanLike = {
  id?: string;
  number: number;
  total: number;
  items: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }>;
};

const ensureBotCashShift = async (schoolId: string, sellerId: string): Promise<string> => {
  const existing = await CashShiftModel.findOne({ school: schoolId, seller: sellerId, status: 'open' }).lean();
  if (existing) return String(existing._id);
  const created = await CashShiftModel.create({ school: schoolId, seller: sellerId, openingAmount: 0, status: 'open' });
  return String(created._id);
};

export const payBotQuote = async (
  schoolId: string,
  quoteId: string,
  paymentMethod: 'cash' | 'transfer'
): Promise<PayBotQuoteResult> => {
  // Claim atómico: solo un request gana el cobro (evita doble venta ante doble click / admins simultáneos).
  // Estados pagables directos: confirmed/ready, y 'paying' por aviso del CLIENTE
  // (pagó transferencia, staff verifica el comprobante). Un 'paying' con lock de
  // STAFF solo se reclama si es stale (>5 min, proceso muerto a mitad de cobro).
  const staleCutoff = new Date(Date.now() - PAYING_STALE_MS);
  const before = await QuoteModel.findOneAndUpdate(
    {
      _id: quoteId,
      school: schoolId,
      source: 'bot',
      $or: [
        { status: { $in: [...PAYABLE_STATUSES] } },
        { status: 'paying', payingBy: { $ne: 'staff' } },
        { status: 'paying', payingBy: 'staff', updatedAt: { $lt: staleCutoff } },
      ],
    },
    { status: 'paying', payingBy: 'staff' }
  );
  if (!before) {
    const existing = await QuoteModel.findOne({ _id: quoteId, school: schoolId, source: 'bot' }).lean();
    if (!existing) throw new NotFoundError('Pedido no encontrado');
    if (existing.status === 'paid') throw new ValidationError('El pedido ya está cobrado');
    if (existing.status === 'active') throw new ValidationError('Confirmá el pedido antes de cobrarlo');
    if (existing.status === 'paying') throw new ValidationError('El pedido se está cobrando, esperá unos segundos');
    throw new ValidationError('El pedido no puede cobrarse en su estado actual');
  }
  const prevStatus = before.status;
  const claimed = before;

  try {
    const cashShiftId = await ensureBotCashShift(schoolId, String(claimed.seller));

    const { sale } = await salesService.createSale(
      schoolId,
      String(claimed.seller),
      cashShiftId,
      claimed.items.map(i => ({ product: String(i.product), quantity: i.quantity })),
      undefined,
      claimed.discount,
      paymentMethod,
      claimed.total,
      'bot'
    );

    const finalized = await QuoteModel.findOneAndUpdate(
      { _id: quoteId, status: 'paying' },
      { status: 'paid', sale: String(sale.id), $unset: { payingBy: 1 } },
      { new: true }
    );
    if (!finalized) {
      throw new ValidationError('El pedido cambió de estado durante el cobro');
    }

    await notifyBotStatusChange(finalized, 'paid');

    return {
      quote: finalized.toJSON() as QuoteLean,
      sale: withId(sale) as SaleLeanLike,
    };
  } catch (error) {
    // Rollback del claim: devolver el pedido a su estado previo para que se pueda reintentar.
    // Si estaba en 'paying' por aviso del cliente, se mantiene ese aviso.
    const rollback = prevStatus === 'paying'
      ? { status: 'paying', payingBy: 'customer' as const }
      : { status: prevStatus, $unset: { payingBy: 1 } };
    await QuoteModel.updateOne(
      { _id: quoteId, status: 'paying' },
      rollback
    );
    throw error;
  }
};

export interface SetOrderCustomerInfoInput {
  schoolId: string;
  publicCode: string;
  customerName?: string;
  customerPhone?: string;
  paymentIntent?: 'cash' | 'transfer';
}

/** Pedido del bot por código público (para armar el deeplink de WhatsApp del CTA). */
export const getBotOrderByPublicCode = async (
  schoolId: string,
  publicCode: string
): Promise<QuoteLean | null> => {
  const quote = await QuoteModel.findOne({ publicCode, school: schoolId, source: 'bot' }).lean();
  return quote ? (withId(quote) as QuoteLean) : null;
};

export const setOrderCustomerInfo = async (input: SetOrderCustomerInfoInput): Promise<QuoteLean> => {
  const update: Record<string, unknown> = {};
  if (input.customerName !== undefined) update.customerName = input.customerName.trim().slice(0, 80);
  if (input.customerPhone !== undefined) update.customerPhone = input.customerPhone.replace(/[^\d+]/g, '').slice(0, 20);
  if (input.paymentIntent !== undefined) update.paymentIntent = input.paymentIntent;
  if (Object.keys(update).length === 0) {
    throw new ValidationError('Nada que actualizar');
  }

  const quote = await QuoteModel.findOneAndUpdate(
    { publicCode: input.publicCode, school: input.schoolId, source: 'bot' },
    update,
    { new: true }
  ).lean();

  if (!quote) {
    throw new NotFoundError('Pedido no encontrado');
  }
  return withId(quote) as QuoteLean;
};

export interface AddQuoteItemsInput {
  schoolId: string;
  publicCode: string;
  items: Array<{ product: string; quantity: number }>;
}

/**
 * Anexa ítems a un pedido borrador del bot (el cliente quiso agregar algo después
 * de creado). Suma cantidades si el producto ya estaba, y recalcula subtotal y total.
 * Es la alternativa a crear un segundo pedido: SIEMPRE hay un solo PED por sesión.
 */
export const addQuoteItems = async (input: AddQuoteItemsInput): Promise<QuoteLean> => {
  const quote = await QuoteModel.findOne({ publicCode: input.publicCode, school: input.schoolId, source: 'bot' });
  if (!quote) {
    throw new NotFoundError('Pedido no encontrado');
  }
  if (quote.status !== 'active') {
    throw new ValidationError('El pedido ya fue confirmado y no admite más ítems');
  }

  // Resolver productos y validar stock (mismas reglas que previewQuote)
  const resolved: Array<{ product: string; quantity: number; name: string; unitPrice: number; unitCost: number; type: string }> = [];
  for (const item of input.items) {
    const product = await ProductModel.findById(item.product).lean();
    if (!product || !product.active) {
      throw new ValidationError('Producto no encontrado o inactivo');
    }
    const isService = product.type === 'service';
    if (!isService && product.stock < item.quantity) {
      throw new ValidationError(`Producto no disponible: ${product.name}`);
    }
    resolved.push({
      product: String(product._id),
      quantity: item.quantity,
      name: product.name,
      unitPrice: product.price,
      unitCost: product.cost ?? 0,
      type: product.type,
    });
  }

  // Mezclar con los ítems existentes (sumar cantidad si ya estaba)
  for (const r of resolved) {
    const existing = quote.items.find(i => String(i.product) === r.product);
    if (existing) {
      existing.quantity += r.quantity;
      existing.subtotal = existing.quantity * existing.unitPrice;
    } else {
      quote.items.push({
        product: r.product as never,
        name: r.name,
        type: r.type as never,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        unitCost: r.unitCost,
        subtotal: r.quantity * r.unitPrice,
      });
    }
  }

  quote.subtotal = quote.items.reduce((sum, i) => sum + i.subtotal, 0);
  quote.total = quote.subtotal - quote.discount;

  await quote.save();

  return quote.toJSON() as QuoteLean;
};
