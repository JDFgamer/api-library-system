import { z } from 'zod';
import * as productsService from '../../Products/index.js';
import * as quotesService from '../../Quotes/index.js';
import type {
  ToolContext,
  ToolDefinition,
  ToolResult,
  PublicProduct,
  DraftOrderResult,
  SetCustomerInfoResult,
  ExecutableToolDefinition,
  OpenAiTool,
} from './types.js';

export type {
  ToolContext,
  ToolDefinition,
  ToolResult,
  PublicProduct,
  DraftOrderResult,
  SetCustomerInfoResult,
  ExecutableToolDefinition,
  OpenAiTool,
};

const MAX_SEARCH_RESULTS = 8;

const singularize = (term: string): string =>
  term
    .split(' ')
    .map(word => (word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))
    .join(' ');

export const toPublicProduct = (product: { id: string; name: string; price: number; stock: number; type: string }): PublicProduct => {
  const isService = product.type === 'service';
  const available = isService || product.stock > 0;
  const availabilityNote = available ? undefined : 'Agotado';

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    available,
    availabilityNote,
  };
};

export const searchProductsTool: ToolDefinition = {
  name: 'search_products',
  description: 'Busca productos del catálogo por nombre, código o descripción. Devuelve nombre, precio y disponibilidad.',
  parameters: z.object({
    search: z.string().min(1).describe('Texto a buscar (nombre, código o descripción del producto)'),
  }),
};

export const createDraftOrderTool: ToolDefinition = {
  name: 'create_draft_order',
  description: 'Crea un borrador de pedido con los ítems elegidos por el cliente. Devuelve el código corto PED-XXXX y el total estimado.',
  parameters: z.object({
    items: z.array(z.object({
      product: z.string().min(1).describe('ID del producto'),
      quantity: z.number().int().min(1).describe('Cantidad'),
    })).min(1),
  }),
};

const paymentIntentValues = ['cash', 'transfer'] as const;

export const setOrderCustomerInfoTool: ToolDefinition = {
  name: 'set_order_customer_info',
  description: 'Guarda los datos de cierre del cliente sobre un pedido existente creado en esta conversación. Llamala apenas el cliente responda su nombre o cómo va a pagar. Podés llamarla varias veces (una por dato) sobre el mismo pedido.',
  parameters: z.object({
    publicCode: z.string().regex(/^PED-\d{4}$/).describe('Código del pedido (PED-XXXX) devuelto por create_draft_order'),
    customerName: z.string().min(1).max(80).optional().describe('Nombre del cliente, tal como lo dijo'),
    paymentIntent: z.enum(paymentIntentValues).optional().describe('cash = efectivo al retirar, transfer = transferencia. SOLO envialo si el cliente dijo explícitamente en su último mensaje cómo paga. Nunca lo asumas ni elijas por él; si no lo dijo, omití este campo.'),
  }),
};

export const addOrderItemsTool: ToolDefinition = {
  name: 'add_order_items',
  description: 'Agrega ítems a un pedido YA CREADO en esta conversación cuando el cliente quiere sumar algo más (devuelve el total actualizado). USALA SIEMPRE que el cliente agregue productos después de creado el pedido: NUNCA crees un segundo pedido para la misma conversación.',
  parameters: z.object({
    publicCode: z.string().regex(/^PED-\d{4}$/).describe('Código del pedido existente de esta conversación'),
    items: z.array(z.object({
      product: z.string().min(1).describe('ID del producto (de search_products)'),
      quantity: z.number().int().min(1).describe('Cantidad a agregar'),
    })).min(1),
  }),
};

export const executeAddOrderItems = async (
  ctx: ToolContext,
  args: { publicCode: string; items: Array<{ product: string; quantity: number }> }
): Promise<ToolResult> => {
  const resolved: Array<{ product: string; quantity: number }> = [];
  for (const item of args.items) {
    const match = await resolveProductRef(ctx.schoolId, item.product);
    if ('error' in match) {
      throw new Error(match.error);
    }
    resolved.push({ product: match.product, quantity: item.quantity });
  }

  try {
    const quote = await quotesService.addQuoteItems({
      schoolId: ctx.schoolId,
      publicCode: args.publicCode,
      items: resolved,
    });

    const draft: DraftOrderResult = {
      publicCode: quote.publicCode ?? args.publicCode,
      total: quote.total,
      items: quote.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
    };
    return { result: draft };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido';
    const wrap = (guidance: string) => {
      const wrapped = new Error(guidance);
      wrapped.stack = `${wrapped.stack}\nCaused by: ${error instanceof Error ? error.stack : String(error)}`;
      return wrapped;
    };
    if (detail.includes('Pedido no encontrado')) {
      throw wrap(
        `El código ${args.publicCode} no corresponde a un pedido de este negocio. Usá EXACTAMENTE el código que devolvió create_draft_order en esta conversación.`
      );
    }
    if (detail.includes('no admite más ítems')) {
      throw wrap(
        `El pedido ${args.publicCode} ya está confirmado y no admite más ítems. Informale al cliente que el negocio le confirma el agregado por WhatsApp.`
      );
    }
    if (detail.includes('Producto no disponible')) {
      throw wrap(`Uno de los productos no tiene stock suficiente. Reconsultá con search_products. Detalle: ${detail}`);
    }
    throw error;
  }
};

export const executeSearchProducts = async (ctx: ToolContext, args: { search: string }): Promise<ToolResult> => {
  const query = args.search.trim();
  const runSearch = (search: string) =>
    productsService.listProducts({
      schoolId: ctx.schoolId,
      search,
      active: true,
      page: 1,
      limit: MAX_SEARCH_RESULTS,
      sortBy: 'name',
      sortOrder: 'asc',
    });

  let result = await runSearch(singularize(query.toLowerCase()));

  // Fallback 1: texto exacto (preserva mayúsculas, evita el singularize)
  if (result.total === 0) {
    result = await runSearch(query);
  }

  // Fallback 2: código de producto (ej: "PRD-71D3B")
  if (result.total === 0 && /^[a-z]{3}-[\da-f]+$/i.test(query)) {
    result = await runSearch(query);
  }

  // Fallback 3: primera palabra (búsquedas conversacionales largas: "quiero el hilo naranja de algodón")
  if (result.total === 0) {
    const firstWord = singularize(query.toLowerCase().split(/\s+/)[0] ?? '');
    if (firstWord.length >= 3) {
      result = await runSearch(firstWord);
    }
  }

  const seen = new Set<string>();
  const items = result.items
    .filter(p => {
      const key = `${p.name.toLowerCase()}|${p.price}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(toPublicProduct);

  return { result: { items, total: items.length } };
};

const isObjectId = (value: string): boolean => /^[a-f\d]{24}$/i.test(value);

const resolveProductRef = async (
  schoolId: string,
  ref: string
): Promise<{ product: string } | { error: string }> => {
  if (isObjectId(ref)) return { product: ref };

  // El LLM a veces pasa el nombre: resolverlo por nombre exacto (case-insensitive).
  const result = await productsService.listProducts({
    schoolId,
    search: ref.trim(),
    active: true,
    page: 1,
    limit: 1,
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const exact = result.items.find(p => p.name.toLowerCase() === ref.trim().toLowerCase());
  if (exact) return { product: exact.id };

  return {
    error: `"${ref}" no es un ID de producto ni un nombre exacto del catálogo. Llamá search_products primero y usá el campo "id" de cada item.`,
  };
};

export const executeCreateDraftOrder = async (
  ctx: ToolContext,
  args: { items: Array<{ product: string; quantity: number }> }
): Promise<ToolResult> => {
  const resolved: Array<{ product: string; quantity: number }> = [];
  for (const item of args.items) {
    const match = await resolveProductRef(ctx.schoolId, item.product);
    if ('error' in match) {
      throw new Error(match.error);
    }
    resolved.push({ product: match.product, quantity: item.quantity });
  }

  let quote;
  try {
    ({ quote } = await quotesService.createQuote(
      ctx.schoolId,
      ctx.botSellerId,
      resolved,
      undefined,
      0,
      { source: 'bot', botSessionId: ctx.sessionId }
    ));
  } catch (error) {
    // Traducir los errores de dominio a mensajes accionables para el LLM:
    // el modelo puede autorrecuperarse si sabe exactamente qué corregir.
    const detail = error instanceof Error ? error.message : 'Error desconocido';
    const wrap = (guidance: string) => {
      const wrapped = new Error(guidance);
      wrapped.stack = `${wrapped.stack}\nCaused by: ${error instanceof Error ? error.stack : String(error)}`;
      return wrapped;
    };
    if (detail.includes('Producto no encontrado') || detail.includes('Cast to ObjectId failed')) {
      throw wrap(
        `Producto no encontrado en create_draft_order: el valor pasado en "product" no es un ID de producto válido. El campo "product" debe ser el "id" (ObjectId) que devuelve search_products, nunca el nombre. Llamá search_products otra vez, copiá el campo "id" de cada item y reintentá el pedido. Detalle: ${detail}`
      );
    }
    if (detail.includes('Producto no disponible')) {
      throw wrap(
        `Uno de los productos está inactivo o sin stock. Reconsultá con search_products antes de armar el pedido. Detalle: ${detail}`
      );
    }
    throw error;
  }

  const draft: DraftOrderResult = {
    publicCode: quote.publicCode ?? '',
    total: quote.total,
    items: quote.items.map(i => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.subtotal,
    })),
  };

  return { result: draft };
};

export const executeSetOrderCustomerInfo = async (
  ctx: ToolContext,
  args: { publicCode: string; customerName?: string; paymentIntent?: 'cash' | 'transfer' }
): Promise<ToolResult> => {
  try {
    const quote = await quotesService.setOrderCustomerInfo({
      schoolId: ctx.schoolId,
      publicCode: args.publicCode,
      ...(args.customerName !== undefined ? { customerName: args.customerName } : {}),
      ...(args.paymentIntent !== undefined ? { paymentIntent: args.paymentIntent } : {}),
    });

    const result: SetCustomerInfoResult = {
      publicCode: quote.publicCode ?? args.publicCode,
      customerName: quote.customerName || null,
      customerPhone: quote.customerPhone || null,
      paymentIntent: quote.paymentIntent ?? null,
    };
    return { result };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido';
    const wrap = (guidance: string) => {
      const wrapped = new Error(guidance);
      wrapped.stack = `${wrapped.stack}\nCaused by: ${error instanceof Error ? error.stack : String(error)}`;
      return wrapped;
    };
    if (detail.includes('Pedido no encontrado')) {
      throw wrap(
        `El código ${args.publicCode} no corresponde a un pedido de este negocio. Usá EXACTAMENTE el código que devolvió create_draft_order en esta conversación, sin modificarlo.`
      );
    }
    if (detail.includes('Nada que actualizar')) {
      throw wrap(
        'Tenés que pasar al menos un dato para guardar: customerName o paymentIntent. No llamés set_order_customer_info sin datos.'
      );
    }
    throw error;
  }
};

export const getPublicToolDefinitions = (): ExecutableToolDefinition[] => [
  { ...searchProductsTool, execute: (ctx, args) => executeSearchProducts(ctx, args as { search: string }) },
  { ...createDraftOrderTool, execute: (ctx, args) => executeCreateDraftOrder(ctx, args as { items: Array<{ product: string; quantity: number }> }) },
  { ...addOrderItemsTool, execute: (ctx, args) => executeAddOrderItems(ctx, args as { publicCode: string; items: Array<{ product: string; quantity: number }> }) },
  { ...setOrderCustomerInfoTool, execute: (ctx, args) => executeSetOrderCustomerInfo(ctx, args as { publicCode: string; customerName?: string; paymentIntent?: 'cash' | 'transfer' }) },
];

const toOpenAiParameters = (schema: z.ZodType): Record<string, unknown> => {
  const jsonSchema = z.toJSONSchema ? z.toJSONSchema(schema) : undefined;
  if (jsonSchema) {
    return jsonSchema as Record<string, unknown>;
  }
  return { type: 'object', properties: {} };
};

export const getOpenAiTools = (): OpenAiTool[] =>
  getPublicToolDefinitions().map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toOpenAiParameters(tool.parameters),
    },
  }));
