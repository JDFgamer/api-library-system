import mongoose, { Document, Schema, Types } from 'mongoose';

export type QuoteStatus = 'active' | 'confirmed' | 'ready' | 'paying' | 'paid' | 'cancelled';
export type QuoteSource = 'pos' | 'bot';

export const QUOTE_PUBLIC_CODE_ALPHABET = '0123456789';
export const QUOTE_PUBLIC_CODE_LENGTH = 4;

export function generateQuotePublicCode(): string {
  let code = '';
  for (let i = 0; i < QUOTE_PUBLIC_CODE_LENGTH; i++) {
    code += QUOTE_PUBLIC_CODE_ALPHABET[Math.floor(Math.random() * QUOTE_PUBLIC_CODE_ALPHABET.length)];
  }
  return `PED-${code}`;
}

export interface IQuote extends Document {
  items: Array<{
    product: Types.ObjectId;
    name: string;
    type: 'product' | 'service';
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    subtotal: number;
  }>;
  number: number;
  subtotal: number;
  discount: number;
  total: number;
  client?: Types.ObjectId;
  seller: Types.ObjectId;
  school: Types.ObjectId;
  status: QuoteStatus;
  source: QuoteSource;
  publicCode?: string;
  customerName?: string;
  customerPhone?: string;
  paymentIntent?: 'cash' | 'transfer';
  /** Sesión del widget que creó el pedido (para avisarle cambios de estado). */
  botSessionId?: string;
  /** Quién puso el pedido en 'paying': 'customer' (aviso de pago) | 'staff' (lock de cobro). */
  payingBy?: 'customer' | 'staff';
  sale?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const quoteSchema = new Schema<IQuote>(
  {
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ['product', 'service'], required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        unitCost: { type: Number, min: 0, default: 0 },
        subtotal: { type: Number, required: true, min: 0 },
      },
    ],
    number: { type: Number, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    school: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    status: { type: String, enum: ['active', 'confirmed', 'ready', 'paying', 'paid', 'cancelled'], required: true, default: 'active' },
    source: { type: String, enum: ['pos', 'bot'], required: true, default: 'pos' },
    publicCode: { type: String, unique: true, sparse: true, index: true },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    paymentIntent: { type: String, enum: ['cash', 'transfer'] },
    botSessionId: { type: String, default: '' },
    payingBy: { type: String, enum: ['customer', 'staff'] },
    sale: { type: Schema.Types.ObjectId, ref: 'Sale' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

quoteSchema.index({ school: 1, number: 1 }, { unique: true });
quoteSchema.index({ school: 1, createdAt: -1 });
quoteSchema.index({ school: 1, seller: 1, createdAt: -1 });
quoteSchema.index({ school: 1, client: 1, createdAt: -1 });
quoteSchema.index({ school: 1, status: 1 });

quoteSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: unknown, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const QuoteModel = mongoose.model<IQuote>('Quote', quoteSchema);

export type QuoteDocument = IQuote;
export type QuoteLean = mongoose.FlattenMaps<IQuote> & { id: string };