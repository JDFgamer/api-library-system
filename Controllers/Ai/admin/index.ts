import { Request, Response } from 'express';
import { Types } from 'mongoose';
import * as quotesService from '../../../Services/Quotes/index.js';
import * as aiConfigService from '../../../Services/Ai/config/index.js';
import * as conversationsService from '../../../Services/Ai/conversations/index.js';
import { LlmUsageLogModel } from '../../../models/LlmUsageLog/index.js';
import { env } from '../../../config/env.js';

const getBotUrlBase = (): string => env.FRONTEND_BOT_URL;

export const getAdminBotMetrics = async (req: Request, res: Response) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const schoolFilter = new Types.ObjectId(req.schoolId!);
  const [totals] = await LlmUsageLogModel.aggregate<{
    _id: null;
    requests: number;
    messages: number;
    costUsd: number;
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
    avgTtftMs: number;
    avgLatencyMs: number;
    totalToolCalls: number;
  }>([
    { $match: { school: schoolFilter, createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        requests: { $sum: 1 },
        messages: { $sum: { $add: ['$promptTokens', '$completionTokens'] } },
        costUsd: { $sum: '$costUsd' },
        promptTokens: { $sum: '$promptTokens' },
        cachedTokens: { $sum: '$cachedTokens' },
        completionTokens: { $sum: '$completionTokens' },
        avgTtftMs: { $avg: '$ttftMs' },
        avgLatencyMs: { $avg: '$latencyMs' },
        totalToolCalls: { $sum: '$toolCalls' },
      },
    },
  ]);

  const daily = await LlmUsageLogModel.aggregate<{
    _id: { date: string };
    requests: number;
    costUsd: number;
    avgTtftMs: number;
  }>([
    { $match: { school: schoolFilter, createdAt: { $gte: since } } },
    {
      $group: {
        _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
        requests: { $sum: 1 },
        costUsd: { $sum: '$costUsd' },
        avgTtftMs: { $avg: '$ttftMs' },
      },
    },
    { $sort: { '_id.date': 1 } },
    { $limit: 90 },
  ]);

  const cacheRatio = totals && totals.promptTokens > 0
    ? Math.round((totals.cachedTokens / totals.promptTokens) * 100)
    : 0;

  res.json({
    days,
    requests: totals?.requests ?? 0,
    costUsd: Math.round((totals?.costUsd ?? 0) * 1e6) / 1e6,
    promptTokens: totals?.promptTokens ?? 0,
    cachedTokens: totals?.cachedTokens ?? 0,
    cacheRatioPct: cacheRatio,
    completionTokens: totals?.completionTokens ?? 0,
    avgTtftMs: Math.round(totals?.avgTtftMs ?? 0),
    avgLatencyMs: Math.round(totals?.avgLatencyMs ?? 0),
    toolCalls: totals?.totalToolCalls ?? 0,
    daily: daily.map(d => ({
      date: d._id.date,
      requests: d.requests,
      costUsd: Math.round(d.costUsd * 1e6) / 1e6,
      avgTtftMs: Math.round(d.avgTtftMs),
    })),
  });
}

export const getAdminBotConfig = async (req: Request, res: Response) => {
  const config = await aiConfigService.getBotAdminConfig(req.schoolId!, getBotUrlBase());
  res.json(config);
}

interface UpdateBotConfigBody {
  enabled?: boolean;
  greeting?: string;
  quickReplies?: string[];
  whatsappNumber?: string;
  transferAlias?: string;
  transferCbu?: string;
  businessType?: string;
  businessDescription?: string;
  offTopics?: string[];
  offTopicReply?: string;
  statusMessages?: { confirmed?: string; paid?: string; ready?: string };
}

export const updateAdminBotConfig = async (req: Request, res: Response) => {
  const body = req.body as UpdateBotConfigBody;
  const config = await aiConfigService.updateBotAdminConfig({
    schoolId: req.schoolId!,
    botUrlBase: getBotUrlBase(),
    ...body,
  });
  res.json(config);
}

export const rotateAdminBotKey = async (req: Request, res: Response) => {
  const newKey = await aiConfigService.rotateBotKey(req.schoolId!);
  const config = await aiConfigService.getBotAdminConfig(req.schoolId!, getBotUrlBase());
  res.json({ ...config, botKey: newKey });
}

export const listSchoolBots = async (_req: Request, res: Response) => {
  const bots = await aiConfigService.listSchoolBots(getBotUrlBase());
  res.json({ items: bots });
}

export const setSchoolBot = async (req: Request, res: Response) => {
  const schoolId = req.params.schoolId as string;
  const { enabled } = req.body as { enabled: boolean };
  const status = await aiConfigService.setSchoolBotStatus({
    schoolId,
    enabled,
    botUrlBase: getBotUrlBase(),
  });
  res.json(status);
}

// ── Bandeja de mensajes del bot (staff interviene conversaciones) ──────────

export const listConversations = async (req: Request, res: Response) => {
  const q = req.query;
  const result = await conversationsService.listConversations({
    schoolId: req.schoolId!,
    status: q.status as 'bot' | 'human' | undefined,
    page: Number(q.page) || 1,
    limit: Math.min(Number(q.limit) || 20, 100),
  });
  res.json(result);
}

export const getConversation = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const conversation = await conversationsService.getConversation(req.schoolId!, id);
  res.json(conversation);
}

export const pauseConversation = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const conversation = await conversationsService.setConversationStatus(req.schoolId!, id, 'human');
  res.json(conversation);
}

export const resumeConversation = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const conversation = await conversationsService.setConversationStatus(req.schoolId!, id, 'bot');
  res.json(conversation);
}

interface ReplyConversationBody {
  content: string;
}

export const replyConversation = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { content } = req.body as ReplyConversationBody;

  const conversation = await conversationsService.getConversation(req.schoolId!, id);
  if (conversation.status !== 'human') {
    res.status(409).json({ error: 'NOT_PAUSED', message: 'Pausá la conversación antes de responder como vendedor' });
    return;
  }

  await conversationsService.appendMessages(req.schoolId!, conversation.sessionId, [
    { role: 'human', content },
  ]);
  res.status(201).json({ ok: true });
}

// ── Pedidos del bot (quotes source: 'bot') ──────────────────────────────────

export const listBotOrders = async (req: Request, res: Response) => {
  const q = req.query;
  const result = await quotesService.listQuotes({
    schoolId: req.schoolId!,
    source: 'bot',
    status: q.status as 'active' | 'confirmed' | 'ready' | 'paying' | 'paid' | 'cancelled' | undefined,
    page: Number(q.page) || 1,
    limit: Math.min(Number(q.limit) || 20, 100),
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  res.json(result);
}

export const cancelBotOrder = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const quote = await quotesService.cancelQuote(req.schoolId!, id);
  res.json(quote);
}

interface SetBotOrderStatusBody {
  status: 'confirmed' | 'ready';
}

export const setBotOrderStatus = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { status } = req.body as SetBotOrderStatusBody;
  const quote = await quotesService.setBotOrderStatus(req.schoolId!, id, status);
  res.json(quote);
};

interface PayBotOrderBody {
  paymentMethod: 'cash' | 'transfer';
}

export const payBotOrder = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { paymentMethod } = req.body as PayBotOrderBody;
  const result = await quotesService.payBotQuote(req.schoolId!, id, paymentMethod);
  res.json(result);
};
