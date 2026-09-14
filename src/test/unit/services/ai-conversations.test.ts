import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotConversationModel } from '../../../../models/BotConversation/index.js';
import * as conversationsService from '../../../../Services/Ai/conversations/index.js';

vi.mock('../../../../models/BotConversation/index.js');
vi.mock('../../../../utils/errors.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) { super(message); }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string) { super(message); }
  },
}));

const mockedModel = vi.mocked(BotConversationModel);

function mockFindOneChain(result: unknown) {
  const chain = { lean: vi.fn().mockResolvedValue(result) };
  mockedModel.findOne = vi.fn().mockReturnValue(chain as never);
  return chain;
}

describe('Ai Conversations Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('appendMessages', () => {
    it('hace upsert con mensajes y lastMessageAt', async () => {
      mockedModel.updateOne = vi.fn().mockResolvedValue({ acknowledged: true });

      await conversationsService.appendMessages('school-1', 'session-1', [
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: '¡Hola! ¿En qué te ayudo?' },
      ]);

      expect(mockedModel.updateOne).toHaveBeenCalledWith(
        { school: 'school-1', sessionId: 'session-1' },
        {
          $push: {
            messages: {
              $each: [
                expect.objectContaining({ role: 'user', content: 'hola' }),
                expect.objectContaining({ role: 'assistant', content: '¡Hola! ¿En qué te ayudo?' }),
              ],
              $slice: -200,
            },
          },
          $set: expect.objectContaining({ lastMessageAt: expect.any(Date) }),
          $setOnInsert: { school: 'school-1', sessionId: 'session-1', status: 'bot' },
        },
        { upsert: true }
      );
    });

    it('no toca la base si no hay mensajes', async () => {
      mockedModel.updateOne = vi.fn();

      await conversationsService.appendMessages('school-1', 'session-1', []);

      expect(mockedModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('devuelve solo user/assistant (filtra mensajes del staff)', async () => {
      mockFindOneChain({
        messages: [
          { role: 'user', content: 'hola', createdAt: new Date() },
          { role: 'human', content: 'contestando yo', createdAt: new Date() },
          { role: 'assistant', content: '¡Hola!', createdAt: new Date() },
        ],
      });

      const history = await conversationsService.getHistory('school-1', 'session-1');

      expect(history).toEqual([
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: '¡Hola!' },
      ]);
    });

    it('devuelve vacío si la conversación no existe', async () => {
      mockFindOneChain(null);

      const history = await conversationsService.getHistory('school-1', 'session-x');

      expect(history).toEqual([]);
    });
  });

  describe('setConversationStatus', () => {
    it('rechaza estados inválidos', async () => {
      await expect(
        conversationsService.setConversationStatus('school-1', 'conv-1', 'broken' as 'bot' | 'human')
      ).rejects.toThrow('Estado inválido');
    });

    it('404 si la conversación no existe', async () => {
      mockedModel.findOneAndUpdate = vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      await expect(
        conversationsService.setConversationStatus('school-1', 'conv-x', 'human')
      ).rejects.toThrow('Conversación no encontrada');
    });

    it('actualiza el estado a human y normaliza id', async () => {
      const updated = { _id: 'conv-1', sessionId: 'session-1', status: 'human', messages: [] };
      mockedModel.findOneAndUpdate = vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(updated),
      } as never);

      const result = await conversationsService.setConversationStatus('school-1', 'conv-1', 'human');

      expect(result).toEqual({ id: 'conv-1', sessionId: 'session-1', status: 'human', messages: [] });
      expect(mockedModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'conv-1', school: 'school-1' },
        { status: 'human' },
        { new: true }
      );
    });
  });
});
