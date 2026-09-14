import { z } from 'zod';

const slugRegex = /^[a-z0-9-]+$/;

export const aiChatSchema = z.object({
  body: z.object({
    slug: z.string().regex(slugRegex, 'Slug inválido'),
    botKey: z.string().min(16, 'Credencial inválida'),
    sessionId: z.string().min(6).max(64),
    message: z.string().min(1, 'Mensaje vacío').max(500),
  }),
});

export const aiConfigSchema = z.object({
  query: z.object({
    slug: z.string().regex(slugRegex, 'Slug inválido'),
    botKey: z.string().min(16, 'Credencial inválida'),
  }),
});

export const aiHistorySchema = z.object({
  query: z.object({
    slug: z.string().regex(slugRegex, 'Slug inválido'),
    botKey: z.string().min(16, 'Credencial inválida'),
    sessionId: z.string().min(6).max(64),
    since: z.string().datetime().optional(),
  }),
});

export const aiCreateOrderSchema = z.object({
  body: z.object({
    slug: z.string().regex(slugRegex, 'Slug inválido'),
    botKey: z.string().min(16, 'Credencial inválida'),
    items: z.array(z.object({
      product: z.string().min(1),
      quantity: z.number().int().min(1),
    })).min(1).max(30),
    customerName: z.string().min(1).max(80).optional(),
    customerPhone: z.string().regex(/^[\d+\s-]{6,20}$/, 'Teléfono inválido').optional(),
  }),
});

export const aiSetCustomerInfoSchema = z.object({
  params: z.object({
    publicCode: z.string().regex(/^PED-\d{4}$/, 'Código de pedido inválido'),
  }),
  body: z.object({
    slug: z.string().regex(slugRegex, 'Slug inválido'),
    botKey: z.string().min(16, 'Credencial inválida'),
    customerName: z.string().min(1).max(80).optional(),
    customerPhone: z.string().regex(/^[\d+\s-]{6,20}$/, 'Teléfono inválido').optional(),
    paymentIntent: z.enum(['cash', 'transfer']).optional(),
  }),
});

export const aiOrderWhatsappSchema = z.object({
  params: z.object({
    publicCode: z.string().regex(/^PED-\d{4}$/, 'Código de pedido inválido'),
  }),
  query: z.object({
    slug: z.string().regex(slugRegex, 'Slug inválido'),
    botKey: z.string().min(16, 'Credencial inválida'),
  }),
});

export const aiMarkOrderPaidSchema = z.object({
  params: z.object({
    publicCode: z.string().regex(/^PED-\d{4}$/, 'Código de pedido inválido'),
  }),
  body: z.object({
    slug: z.string().regex(slugRegex, 'Slug inválido'),
    botKey: z.string().min(16, 'Credencial inválida'),
  }),
});

export const aiAdminUpdateConfigSchema = z.object({
  body: z.object({
    enabled: z.boolean().optional(),
    greeting: z.string().min(1).max(300).optional(),
    quickReplies: z.array(z.string().min(1).max(80)).max(6).optional(),
    whatsappNumber: z.string().regex(/^[\d+\s-]{8,20}$/, 'WhatsApp inválido').optional(),
    businessType: z.string().min(1).max(60).optional(),
    businessDescription: z.string().max(600).optional(),
    offTopics: z.array(z.string().min(2).max(40)).max(20).optional(),
    offTopicReply: z.string().min(1).max(300).optional(),
  }),
});

export const aiSuperadminBotSchema = z.object({
  params: z.object({
    schoolId: z.string().regex(/^[a-f\d]{24}$/i, 'Id inválido'),
  }),
  body: z.object({
    enabled: z.boolean(),
  }),
});

export const aiListConversationsSchema = z.object({
  query: z.object({
    status: z.enum(['bot', 'human']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const aiConversationIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'Id inválido'),
  }),
});

export const aiReplyConversationSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'Id inválido'),
  }),
  body: z.object({
    content: z.string().min(1, 'Mensaje vacío').max(2000),
  }),
});

export const aiSetOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'Id inválido'),
  }),
  body: z.object({
    status: z.enum(['confirmed', 'ready']),
  }),
});

export const aiPayOrderSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, 'Id inválido'),
  }),
  body: z.object({
    paymentMethod: z.enum(['cash', 'transfer']),
  }),
});
