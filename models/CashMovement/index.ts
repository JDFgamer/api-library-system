import mongoose, { Document, Schema, Types } from 'mongoose';

export type CashMovementType = 'in' | 'out';

export type CashMovementCategory =
  | 'lunch'
  | 'supplies'
  | 'personal_withdrawal'
  | 'change'
  | 'expense'
  | 'other';

export interface ICashMovement extends Document {
  cashShift: Types.ObjectId;
  school: Types.ObjectId;
  seller: Types.ObjectId;
  type: CashMovementType;
  category: CashMovementCategory;
  amount: number;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const cashMovementSchema = new Schema<ICashMovement>(
  {
    cashShift: {
      type: Schema.Types.ObjectId,
      ref: 'CashShift',
      required: true,
      index: true,
    },
    school: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['in', 'out'],
      required: true,
    },
    category: {
      type: String,
      enum: ['lunch', 'supplies', 'personal_withdrawal', 'change', 'expense', 'other'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

cashMovementSchema.index({ cashShift: 1, createdAt: -1 });
cashMovementSchema.index({ school: 1, createdAt: -1 });
cashMovementSchema.index({ seller: 1, createdAt: -1 });

cashMovementSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const CashMovementModel = mongoose.model<ICashMovement>('CashMovement', cashMovementSchema);

export type CashMovementDocument = ICashMovement;
export type CashMovementLean = mongoose.FlattenMaps<ICashMovement> & { id: string };