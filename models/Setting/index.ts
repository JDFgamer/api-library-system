import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISetting extends Document {
  school: Types.ObjectId;
  key: string;
  value: string;
  botEnabled?: boolean;
  botGreeting?: string;
  botQuickReplies?: string[];
  botKeyHash?: string;
  botKey?: string;
  botSellerId?: Types.ObjectId;
  whatsappNumber?: string;
  transferAlias?: string;
  transferCbu?: string;
  botBusinessType?: string;
  botBusinessDescription?: string;
  botOffTopics?: string[];
  botOffTopicReply?: string;
  /** Mensajes automáticos al cambiar el estado de pedidos del bot. */
  botStatusMessages?: {
    confirmed?: string;
    paid?: string;
    ready?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const settingSchema = new Schema<ISetting>(
  {
    school: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    key: { type: String, required: true },
    value: { type: String, required: true },
    botEnabled: { type: Boolean, default: false },
    botGreeting: { type: String, default: '' },
    botQuickReplies: { type: [String], default: [] },
    botKeyHash: { type: String, default: '' },
    botKey: { type: String, default: '' },
    botSellerId: { type: Schema.Types.ObjectId, ref: 'User' },
    whatsappNumber: { type: String, default: '' },
    transferAlias: { type: String, default: '' },
    transferCbu: { type: String, default: '' },
    botBusinessType: { type: String, default: '' },
    botBusinessDescription: { type: String, default: '' },
    botOffTopics: { type: [String], default: [] },
    botOffTopicReply: { type: String, default: '' },
    botStatusMessages: {
      type: new Schema(
        {
          confirmed: { type: String, default: '' },
          paid: { type: String, default: '' },
          ready: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

settingSchema.index({ school: 1 }, { unique: true });

settingSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: unknown, ret: any) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const SettingModel = mongoose.model<ISetting>('Setting', settingSchema);

export type SettingDocument = ISetting;
export type SettingLean = mongoose.FlattenMaps<ISetting> & { id: string };
