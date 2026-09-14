import { Request, Response } from 'express';
import * as quotesService from '../../Services/Quotes/index.js';

export async function previewQuote(req: Request, res: Response): Promise<void> {
  const { items, clientId, discount } = req.body;
  const result = await quotesService.previewQuote(req.schoolId!, items, clientId, discount);
  res.json(result);
}

export async function createQuote(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');
  const { items, clientId, discount } = req.body;

  const result = await quotesService.createQuote(
    req.schoolId!,
    req.user.sub,
    items,
    clientId,
    discount
  );
  res.status(201).json(result);
}

export async function listQuotes(req: Request, res: Response): Promise<void> {
  const q = req.query;
  const fromDate = q.fromDate ? new Date(q.fromDate as string) : undefined;
  const toDate = q.toDate ? new Date(q.toDate as string) : undefined;
  const result = await quotesService.listQuotes({
    schoolId: req.schoolId!,
    clientId: q.clientId as string | undefined,
    sellerId: q.sellerId as string | undefined,
    status: q.status as 'active' | 'cancelled' | undefined,
    source: q.source as 'pos' | 'bot' | undefined,
    fromDate,
    toDate,
    search: q.search as string | undefined,
    page: Number(q.page) || 1,
    limit: Number(q.limit) || 20,
    sortBy: (q.sortBy as string) || 'createdAt',
    sortOrder: (q.sortOrder as 'asc' | 'desc') || 'desc',
  });
  res.json(result);
}

export async function getQuote(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const quote = await quotesService.getQuoteById(req.schoolId!, id);
  res.json(quote);
}

export async function cancelQuote(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new Error('Usuario no autenticado');
  const id = req.params.id as string;
  const quote = await quotesService.cancelQuote(req.schoolId!, id);
  res.json(quote);
}