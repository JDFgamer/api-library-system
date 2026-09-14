import type { OffTopicMatch, MessageClassifier } from './types.js';

export type { OffTopicMatch, MessageClassifier };

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const DEFAULT_OFF_TOPIC_REPLY = 'Mmm, creo que eso no lo manejamos acá. Soy el asistente de este negocio, ¿te puedo ayudar con algo de nuestro catálogo?';

export const classifyMessage: MessageClassifier = (message, context): OffTopicMatch => {
  const topics = context.offTopics ?? [];
  if (topics.length === 0) {
    return { blocked: false, topic: null, reply: '' };
  }

  const normalizedMessage = normalize(message);
  const matchedTopic = topics.find(topic => {
    const normalizedTopic = normalize(topic.trim());
    return normalizedTopic.length > 0 && normalizedMessage.includes(normalizedTopic);
  });

  if (!matchedTopic) {
    return { blocked: false, topic: null, reply: '' };
  }

  return {
    blocked: true,
    topic: matchedTopic,
    reply: context.offTopicReply?.trim() || DEFAULT_OFF_TOPIC_REPLY,
  };
};
