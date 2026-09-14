import type { BotBusinessContext } from '../config/types.js';

export interface OffTopicMatch {
  blocked: boolean;
  topic: string | null;
  reply: string;
}

export type MessageClassifier = (message: string, context: BotBusinessContext) => OffTopicMatch;
