export interface ConversationMessageInput {
  role: 'user' | 'assistant' | 'human';
  content: string;
  toolName?: string;
}

export interface ConversationSummaryItem {
  id: string;
  sessionId: string;
  status: 'bot' | 'human';
  lastMessage: string;
  lastMessageAt: Date;
  messageCount: number;
}

export interface ListConversationsResult {
  items: ConversationSummaryItem[];
  total: number;
  page: number;
  limit: number;
}

export type ConversationStatus = 'bot' | 'human';
