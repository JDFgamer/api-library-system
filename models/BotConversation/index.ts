import mongoose, { Document, Schema, Types } from 'mongoose';

export type ConversationStatus = 'bot' | 'human';

export interface IBotConversation extends Document {
  school: Types.ObjectId;
  sessionId: string;
  status: ConversationStatus;
  /** Código del pedido del bot abierto en esta sesión (anti-duplicación). */
  orderCode?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'human';
    content: string;
    toolName?: string;
    createdAt: Date;
  }>;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const botConversationSchema = new Schema<IBotConversation>(
  {
    school: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    sessionId: { type: String, required: true },
    status: { type: String, enum: ['bot', 'human'], required: true, default: 'bot' },
    orderCode: { type: String, default: '' },
    messages: {
      type: [
        {
          _id: false,
          role: { type: String, enum: ['user', 'assistant', 'human'], required: true },
          content: { type: String, required: true },
          toolName: { type: String },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    lastMessageAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Una conversación por sesión y negocio
botConversationSchema.index({ school: 1, sessionId: 1 }, { unique: true });
// Bandeja ordenada por actividad reciente
botConversationSchema.index({ school: 1, lastMessageAt: -1 });
// Retención: conversaciones inactivas por 90 días se purgan automáticamente
botConversationSchema.index({ lastMessageAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const BotConversationModel = mongoose.model<IBotConversation>('BotConversation', botConversationSchema);

export type BotConversationDocument = IBotConversation;
export type BotConversationLean = mongoose.FlattenMaps<IBotConversation> & { id: string };
