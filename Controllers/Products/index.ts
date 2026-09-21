import { Request, Response } from 'express';
import * as productsService from '../../Services/Products/index.js';
import { getValidatedInput } from '../../middleware/validation.js';
import type { ListProductsInput } from './types.js';

export async function listProducts(req: Request, res: Response): Promise<void> {
  const q = getValidatedInput<{ query: ListProductsInput }>(res)?.query ?? req.query;
  const result = await productsService.listProducts({
    schoolId: req.schoolId!,
    search: q.search as string | undefined,
    type: q.type as 'product' | 'service' | undefined,
    active: q.active !== undefined ? q.active === true || q.active === 'true' : undefined,
    lowStock: q.lowStock !== undefined ? q.lowStock === true || q.lowStock === 'true' : undefined,
    page: Number(q.page) || 1,
    limit: Number(q.limit) || 20,
    sortBy: (q.sortBy as string) || 'name',
    sortOrder: (q.sortOrder as 'asc' | 'desc') || 'asc',
  });
  res.json(result);
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const product = await productsService.getProductById(req.schoolId!, id);
  res.json(product);
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  const product = await productsService.createProduct(req.schoolId!, req.body);
  res.status(201).json(product);
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const product = await productsService.updateProduct(req.schoolId!, id, req.body);
  res.json(product);
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  await productsService.deleteProduct(req.schoolId!, id);
  res.status(204).send();
}

export async function updateStock(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const { quantity, operation } = req.body;
  const result = await productsService.updateStock(req.schoolId!, id, quantity, operation);
  res.json(result);
}

export async function getLowStock(req: Request, res: Response): Promise<void> {
  const products = await productsService.getLowStockProducts(req.schoolId!);
  res.json(products);
}
