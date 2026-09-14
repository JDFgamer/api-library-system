import mongoose, { Document, Schema, Types } from 'mongoose';

export type PaymentMethod = 'cash' | 'transfer' | 'credit';
export type SaleType = 'sale' | 'return' | 'credit_note';
export type SaleSource = 'pos' | 'bot';

export interface ISale extends Document {
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
  amountReceived: number;
  change: number;
  paymentMethod: PaymentMethod;
  type: SaleType;
  source?: SaleSource;
  client?: Types.ObjectId;
  seller: Types.ObjectId;
  cashShift: Types.ObjectId;
  school: Types.ObjectId;
  originalSale?: Types.ObjectId;
  voided: boolean;
  voidedAt?: Date;
  voidReason?: string;
  settled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const saleSchema = new Schema<ISale>(
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
    amountReceived: { type: Number, default: 0, min: 0 },
    change: { type: Number, default: 0, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'transfer', 'credit'],
      required: true,
    },
    type: { type: String, enum: ['sale', 'return', 'credit_note'], required: true, default: 'sale' },
    source: { type: String, enum: ['pos', 'bot'], default: 'pos' },
    client: { type: Schema.Types.ObjectId, ref: 'Client' },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cashShift: { type: Schema.Types.ObjectId, ref: 'CashShift', required: true },
    school: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    originalSale: { type: Schema.Types.ObjectId, ref: 'Sale' },
    voided: { type: Boolean, default: false },
    voidedAt: Date,
    voidReason: String,
    settled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

saleSchema.index({ school: 1, number: 1 }, { unique: true });
saleSchema.index({ school: 1, createdAt: -1 });
saleSchema.index({ school: 1, seller: 1, createdAt: -1 });
saleSchema.index({ school: 1, client: 1, createdAt: -1 });
saleSchema.index({ school: 1, cashShift: 1 });
saleSchema.index({ school: 1, paymentMethod: 1 });
saleSchema.index({ school: 1, type: 1 });
saleSchema.index({ school: 1, voided: 1 });
saleSchema.index({ school: 1, settled: 1 });

saleSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: unknown, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const SaleModel = mongoose.model<ISale>('Sale', saleSchema);

export type SaleDocument = ISale;
export type SaleLean = mongoose.FlattenMaps<ISale> & { id: string };