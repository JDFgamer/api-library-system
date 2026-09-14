import { BotConversationModel } from '../../../models/BotConversation/index.js';
import type { BotConversationLean } from '../../../models/BotConversation/index.js';
import { NotFoundError, ValidationError } from '../../../utils/errors.js';
import { withId } from '../../../utils/lean.js';
import type { ConversationMessageInput, ListConversationsResult, ConversationStatus } from './types.js';

export type { ConversationMessageInput, ListConversationsResult, ConversationStatus };

const MAX_MESSAGES_PER_CONVERSATION = 200;
const LLM_HISTORY_MESSAGES = 10;

export const appendMessages = async (
  schoolId: string,
  sessionId: string,
  newMessages: ConversationMessageInput[]
): Promise<void> => {
  if (newMessages.length === 0) return;

  const messages = newMessages.map(m => ({
    role: m.role,
    content: m.content,
    ...(m.toolName ? { toolName: m.toolName } : {}),
    createdAt: new Date(),
  }));

  await BotConversationModel.updateOne(
    { school: schoolId, sessionId },
    {
      $push: { messages: { $each: messages, $slice: -MAX_MESSAGES_PER_CONVERSATION } },
      $set: { lastMessageAt: new Date() },
      $setOnInsert: { school: schoolId, sessionId, status: 'bot' as const },
    },
    { upsert: true }
  );
};

export const getHistory = async (schoolId: string, sessionId: string): Promise<ConversationMessageInput[]> => {
  const conversation = await BotConversationModel.findOne(
    { school: schoolId, sessionId },
    { messages: { $slice: -LLM_HISTORY_MESSAGES } }
  ).lean();

  if (!conversation) return [];

  // El historial del LLM solo incluye user/assistant (los mensajes "human" los escribe el staff)
  return (conversation.messages ?? [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));
};

/** Historial completo con timestamps: lo usa el widget para detectar mensajes
 * nuevos (polling). Incluye los mensajes del staff ("human"): el cliente debe
 * ver en el chat lo que el negocio le escribe por el admin. */
export const getHistoryFull = async (
  schoolId: string,
  sessionId: string
): Promise<Array<{ role: 'user' | 'assistant' | 'human'; content: string; createdAt: Date }>> => {
  const conversation = await BotConversationModel.findOne(
    { school: schoolId, sessionId },
    { messages: { $slice: -LLM_HISTORY_MESSAGES_PUBLIC_LIMIT } }
  ).lean();

  if (!conversation) return [];

  return (conversation.messages ?? [])
    .filter(m => ((m.role === 'user' || m.role === 'assistant' || m.role === 'human') && m.createdAt))
    .map(m => ({ role: m.role as 'user' | 'assistant' | 'human', content: m.content, createdAt: m.createdAt }));
};

/** Código del pedido abierto en la sesión (fuente de verdad del guard anti-duplicación). */
export const getOrderCode = async (schoolId: string, sessionId: string): Promise<string | null> => {
  const conversation = await BotConversationModel.findOne(
    { school: schoolId, sessionId },
    { orderCode: 1 }
  ).lean();
  return conversation?.orderCode || null;
};

/** Persiste el código del pedido de la sesión: la primera creación gana, las demás lo respetan. */
export const setOrderCode = async (schoolId: string, sessionId: string, publicCode: string): Promise<void> => {
  await BotConversationModel.updateOne(
    { school: schoolId, sessionId },
    { $set: { orderCode: publicCode } }
  );
};

const LLM_HISTORY_MESSAGES_PUBLIC_LIMIT = 50;

export const listConversations = async (params: {
  schoolId: string;
  status?: ConversationStatus;
  page: number;
  limit: number;
}): Promise<ListConversationsResult> => {
  const filter: Record<string, unknown> = { school: params.schoolId };
  if (params.status) filter.status = params.status;

  const [conversations, total] = await Promise.all([
    BotConversationModel.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .select('sessionId status messages lastMessageAt')
      .lean(),
    BotConversationModel.countDocuments(filter),
  ]);

  return {
    items: conversations.map(c => {
      const messages = c.messages ?? [];
      const last = messages[messages.length - 1];
      return {
        id: String((c as BotConversationLean & { _id: unknown })._id),
        sessionId: c.sessionId,
        status: c.status,
        lastMessage: last ? last.content.slice(0, 120) : '(sin mensajes)',
        lastMessageAt: c.lastMessageAt,
        messageCount: messages.length,
      };
    }),
    total,
    page: params.page,
    limit: params.limit,
  };
};

export const getConversation = async (schoolId: string, id: string): Promise<BotConversationLean> => {
  const conversation = await BotConversationModel.findOne({ _id: id, school: schoolId }).lean();
  if (!conversation) {
    throw new NotFoundError('Conversación no encontrada');
  }
  return withId(conversation) as BotConversationLean;
};

export const setConversationStatus = async (
  schoolId: string,
  id: string,
  status: ConversationStatus
): Promise<BotConversationLean> => {
  if (!['bot', 'human'].includes(status)) {
    throw new ValidationError('Estado inválido');
  }

  const conversation = await BotConversationModel.findOneAndUpdate(
    { _id: id, school: schoolId },
    { status },
    { new: true }
  ).lean();

  if (!conversation) {
    throw new NotFoundError('Conversación no encontrada');
  }
  return withId(conversation) as BotConversationLean;
};
