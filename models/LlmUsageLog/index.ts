import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILlmUsageLog extends Document {
  school: Types.ObjectId;
  llmModel: string;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costUsd: number;
  latencyMs: number;
  ttftMs: number;
  toolCalls: number;
  createdAt: Date;
}

const llmUsageLogSchema = new Schema<ILlmUsageLog>(
  {
    school: { type: Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    llmModel: { type: String, required: true, trim: true },
    promptTokens: { type: Number, default: 0, min: 0 },
    cachedTokens: { type: Number, default: 0, min: 0 },
    completionTokens: { type: Number, default: 0, min: 0 },
    costUsd: { type: Number, default: 0, min: 0 },
    latencyMs: { type: Number, default: 0, min: 0 },
    ttftMs: { type: Number, default: 0, min: 0 },
    toolCalls: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

llmUsageLogSchema.index({ school: 1, createdAt: -1 });
llmUsageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const LlmUsageLogModel = mongoose.model<ILlmUsageLog>('LlmUsageLog', llmUsageLogSchema);

export type LlmUsageLogDocument = ILlmUsageLog;
export type LlmUsageLogLean = mongoose.FlattenMaps<ILlmUsageLog> & { id: string };
