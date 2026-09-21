import { z } from 'zod';

const queryBoolean = z.enum(['true', 'false']).transform((value) => value === 'true');

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Nombre requerido').max(120),
    description: z.string().max(500).optional(),
    type: z.enum(['product', 'service']).default('product'),
    price: z.number().min(0, 'El precio debe ser >= 0'),
    cost: z.number().min(0).optional(),
    stock: z.number().int().min(0).default(0),
    minStock: z.number().int().min(0).optional(),
    unit: z.enum(['unit', 'sheet', 'binding']).optional(),
    code: z.string().max(50).optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido'),
  }),
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    type: z.enum(['product', 'service']).optional(),
    price: z.number().min(0).optional(),
    cost: z.number().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    minStock: z.number().int().min(0).optional(),
    unit: z.enum(['unit', 'sheet', 'binding']).optional(),
    active: z.boolean().optional(),
    code: z.string().max(50).optional(),
  }),
});

export const updateStockSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID inválido'),
  }),
  body: z.object({
    quantity: z.number().int('La cantidad debe ser entera'),
    operation: z.enum(['add', 'set']).default('add'),
  }),
});

export const listProductsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    type: z.enum(['product', 'service']).optional(),
    active: queryBoolean.optional(),
    lowStock: queryBoolean.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['name', 'price', 'stock', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type UpdateStockInput = z.infer<typeof updateStockSchema>['body'];
export type ListProductsInput = z.infer<typeof listProductsSchema>['query'];
