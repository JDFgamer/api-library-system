import { Request, Response } from 'express';
import * as quotesService from '../../../Services/Quotes/index.js';
import * as aiConfigService from '../../../Services/Ai/config/index.js';
import * as conversationsService from '../../../Services/Ai/conversations/index.js';
import { runAgentLoop } from '../../../Services/Ai/agent/index.js';
import { buildSellerSystemPrompt, hasBuySignal, hasCheckoutIntent, hasPaymentAnswer, hasNameAnswer } from '../../../Services/Ai/prompts/index.js';
import { classifyMessage } from '../../../Services/Ai/guard/index.js';
import { getPublicToolDefinitions, getOpenAiTools } from '../../../Services/Ai/toolCatalog/index.js';
import { isLlmConfigured, streamChatCompletion } from '../../../Services/Ai/llm/index.js';
import type { ChatMessage } from '../../../Services/Ai/llm/index.js';
import type { AgentUsageSummary } from '../../../Services/Ai/agent/index.js';
import { memorySessionStore } from '../../../Services/Ai/sessionStore/index.js';
import { LlmUsageLogModel } from '../../../models/LlmUsageLog/index.js';
import { BotConversationModel } from '../../../models/BotConversation/index.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const MAX_TOOL_CALLS = env.AI_MAX_TOOL_CALLS;

const sseEvent = (res: Response, event: string, data: unknown): void => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

interface ChatBody {
  slug: string;
  botKey: string;
  sessionId: string;
  message: string;
}

const resolvePublicChat = async (body: ChatBody) => {
  const config = await aiConfigService.getPublicConfigBySlug(body.slug);
  await aiConfigService.validateBotKeyAgainst(config, body.botKey);
  return config;
};

const checkRateLimit = async (ip: string | undefined, slug: string): Promise<boolean> => {
  const key = `ai:rl:${ip ?? 'unknown'}:${slug}`;
  const count = await memorySessionStore.incrementRateLimit(key, RATE_LIMIT_WINDOW_MS);
  return count <= RATE_LIMIT_MAX_REQUESTS;
};

export const runSseChat = async (req: Request, res: Response) => {
  const body = req.body as ChatBody;
  const config = await resolvePublicChat(body);

  if (!(await checkRateLimit(req.ip, body.slug))) {
    res.status(429).json({ error: 'RATE_LIMIT', message: 'Demasiadas solicitudes, esperá un momento' });
    return;
  }

  if (!isLlmConfigured() || !config.botSellerId) {
    res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'El asistente no está configurado aún' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Si el staff tomó el control de la conversación, el bot no responde
  const conversation = await BotConversationModel.findOne(
    { school: config.schoolId, sessionId: body.sessionId },
    { status: 1 }
  ).lean();
  if (conversation?.status === 'human') {
    await conversationsService.appendMessages(config.schoolId, body.sessionId, [
      { role: 'user', content: body.message },
    ]);
    sseEvent(res, 'done', { paused: true, message: 'Un vendedor te está respondiendo' });
    res.end();
    return;
  }

  const history = await conversationsService.getHistory(config.schoolId, body.sessionId);

  // Capa 1: gate pre-LLM por temas fuera de rubro (0 tokens del LLM)
  const offTopic = classifyMessage(body.message, config.businessContext);
  if (offTopic.blocked) {
    sseEvent(res, 'text', { content: offTopic.reply });
    await conversationsService.appendMessages(config.schoolId, body.sessionId, [
      { role: 'user', content: body.message },
      { role: 'assistant', content: offTopic.reply },
    ]);
    sseEvent(res, 'done', { offTopic: true, topic: offTopic.topic });
    res.end();
    return;
  }

  const systemPrompt = buildSellerSystemPrompt({
    businessName: config.businessName,
    businessContext: config.businessContext,
    transferInfo: config.transferInfo,
  });

  const toolContext = {
    schoolId: config.schoolId,
    botSellerId: config.botSellerId,
    sessionId: body.sessionId,
  };

  const tools = getPublicToolDefinitions();
  const toolByName = new Map(tools.map(t => [t.name, t]));

  let fullText = '';
  let usageSummary: AgentUsageSummary | null = null;
  let toolCallsUsed = 0;
  let lastDraftOrder: { publicCode: string; total: number; items: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }> } | null = null;
  let lastCustomerUpdate: { publicCode: string; customerName: string | null; paymentIntent: 'cash' | 'transfer' | null } | null = null;

  // Pedido abierto de esta conversación: fuente de verdad = orderCode trackeado
  // en la conversación (no el texto del LLM, que puede omitir el código). Fallback
  // regex para sesiones anteriores a esta feature.
  const storedOrderCode = await conversationsService.getOrderCode(config.schoolId, body.sessionId);
  const existingCodeMatch = history.map(m => m.content).join(' ').match(/PED-\d{4}/g);
  let currentOrderCode = storedOrderCode ?? (existingCodeMatch ? existingCodeMatch[existingCodeMatch.length - 1] : null);

  // Si el cliente se desconecta, cancelamos el stream upstream (ahorra tokens y sockets)
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    const stream = runAgentLoop({
      systemPrompt,
      history: history.map(m => ({ role: m.role, content: m.content }) as ChatMessage),
      userMessage: body.message,
      toolContext,
      maxToolCalls: MAX_TOOL_CALLS,
      signal: abortController.signal,
      buySignal: hasBuySignal(body.message),
      checkoutIntent: hasCheckoutIntent(body.message),
      nameAnswer: hasNameAnswer(body.message),
      paymentAnswer: hasPaymentAnswer(body.message),
      // El nudge de pago solo dispara si ya existe un pedido en la conversación:
      // creado en este mismo turno o mencionado en el historial reciente.
      hasExistingOrder: lastDraftOrder !== null || /PED-\d{4}/.test(history.map(m => m.content).join(' ')),
      streamText: (params) => streamChatCompletion({ messages: params.messages, tools: getOpenAiTools(), signal: abortController.signal }),
      executeTool: async (name, args) => {
        const tool = toolByName.get(name);
        if (!tool) return { error: 'Tool no encontrada' };

        // Guard anti-multi-pedido: si la conversación ya tiene un pedido y el modelo
        // intenta crear OTRO, se lo impedimos y le damos el camino correcto. Los
        // modelos pequeños re-crean pedidos ante nombres/pagos en vez de usar la tool.
        if (name === 'create_draft_order' && currentOrderCode) {
          return {
            error: `Ya existe el pedido ${currentOrderCode} en esta conversación. NO crees otro: usá add_order_items si el cliente quiere sumar productos, o set_order_customer_info para guardar su nombre o forma de pago sobre ${currentOrderCode}.`,
          };
        }

        // Guard anti-doble-agregado: en un turno de cierre ("nada más", "eso es todo")
        // el modelo a veces re-ejecuta el agregado anterior. Si el turno NO pide
        // productos nuevos (no hay buySignal), el add_order_items es espurio.
        if (name === 'add_order_items' && currentOrderCode && !hasBuySignal(body.message) && hasCheckoutIntent(body.message)) {
          return {
            error: `El cliente dijo que ya no quiere agregar nada más. NO agregues ítems: confirmá el pedido ${currentOrderCode} y seguí con el cierre (nombre o pago según corresponda).`,
          };
        }

        // Guard anti-nombre-alucinado: si el mensaje del cliente de ESTE turno no
        // es una respuesta de nombre, cualquier customerName que el modelo quiera
        // guardar es inventado (los modelos pequeños "cierran" la venta fantaseando
        // un nombre). Se rechaza y se le indica el camino correcto.
        if (name === 'set_order_customer_info' && typeof (args as { customerName?: unknown }).customerName === 'string' && !hasNameAnswer(body.message)) {
          return {
            error: 'El cliente todavía no dijo su nombre en este turno: NO inventes ni guardes un customerName. Si necesitás el nombre, preguntale "¿A nombre de quién lo dejamos?" y esperá su respuesta. Podés guardar solo el paymentIntent si el cliente dijo cómo paga.',
          };
        }

        const parsed = tool.parameters.parse(args);
        const result = await tool.execute(toolContext, parsed);
        if (name === 'create_draft_order' && result && typeof result === 'object' && 'result' in result) {
          const draft = (result as { result: unknown }).result as { publicCode?: string; total?: number; items?: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }> };
          if (draft?.publicCode) {
            currentOrderCode = draft.publicCode;
            // Persistir el código en la conversación: el guard de los próximos
            // turnos no depende de que el LLM escriba el código en su texto.
            await conversationsService.setOrderCode(config.schoolId, body.sessionId, draft.publicCode);
            lastDraftOrder = {
              publicCode: draft.publicCode,
              total: draft.total ?? 0,
              items: draft.items ?? [],
            };
          }
        }
        if (name === 'add_order_items' && result && typeof result === 'object' && 'result' in result) {
          // Ítems agregados al pedido existente: el widget re-arma el ticket con el total nuevo.
          const draft = (result as { result: unknown }).result as { publicCode?: string; total?: number; items?: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }> };
          if (draft?.publicCode) {
            lastDraftOrder = {
              publicCode: draft.publicCode,
              total: draft.total ?? 0,
              items: draft.items ?? [],
            };
          }
        }
        if (name === 'set_order_customer_info' && result && typeof result === 'object' && 'result' in result) {
          const info = (result as { result: unknown }).result as { publicCode?: string; customerName?: string | null; paymentIntent?: 'cash' | 'transfer' | null };
          if (info?.publicCode) {
            lastCustomerUpdate = {
              publicCode: info.publicCode,
              customerName: info.customerName ?? null,
              paymentIntent: info.paymentIntent ?? null,
            };
          }
        }
        return result;
      },
    });

    for await (const event of stream) {
      if (event.type === 'text' && event.content) {
        fullText += event.content;
        sseEvent(res, 'text', { content: event.content });
      }
      if (event.type === 'text_reset') {
        fullText = '';
        sseEvent(res, 'text_reset', {});
      }
      if (event.type === 'tool_call') {
        toolCallsUsed += 1;
        sseEvent(res, 'tool_call', { toolName: event.toolName });
      }
      if (event.type === 'metrics' && event.usage) {
        usageSummary = event.usage;
      }
      if (event.type === 'final') {
        await conversationsService.appendMessages(config.schoolId, body.sessionId, [
          { role: 'user', content: body.message },
          { role: 'assistant', content: fullText || '(sin respuesta de texto)' },
        ]);
        // El pedido creado por el LLM llega al widget como evento dedicado (0 tokens extra):
        // el frontend muestra la card de confirmación + pregunta de pago.
        if (lastDraftOrder) {
          sseEvent(res, 'order', lastDraftOrder);
        }
        // Datos de cierre (nombre/pago) guardados por el LLM: actualizan la card
        // y re-arman el deeplink de WhatsApp con la info completa.
        if (lastCustomerUpdate) {
          sseEvent(res, 'customer', lastCustomerUpdate);
        }
        sseEvent(res, 'done', {});
      }
    }
  } catch (error) {
    const isAbort = abortController.signal.aborted;
    if (!isAbort) {
      logger.error('Error en chat SSE', { error: error instanceof Error ? error.message : String(error) });
      sseEvent(res, 'error', { message: 'Error procesando el mensaje' });
    }
    try {
      await conversationsService.appendMessages(config.schoolId, body.sessionId, [
        { role: 'user', content: body.message },
        { role: 'assistant', content: fullText || '(error del asistente — revisar en la bandeja)' },
      ]);
    } catch (persistError) {
      logger.error('Error persistiendo conversación fallida', { error: persistError instanceof Error ? persistError.message : String(persistError) });
    }
  } finally {
    if (usageSummary) {
      try {
        await LlmUsageLogModel.create({
          school: config.schoolId,
          llmModel: usageSummary.usage.modelUsed ?? env.AI_LLM_MODEL,
          promptTokens: usageSummary.usage.promptTokens,
          cachedTokens: usageSummary.usage.cachedTokens,
          completionTokens: usageSummary.usage.completionTokens,
          costUsd: usageSummary.usage.costUsd,
          latencyMs: usageSummary.timings.totalMs,
          ttftMs: usageSummary.timings.ttftMs,
          toolCalls: toolCallsUsed,
        });
      } catch (error) {
        logger.error('Error guardando usage log', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    res.end();
  }
}

export const getPublicBotConfig = async (req: Request, res: Response) => {
  const { slug, botKey } = req.query as { slug: string; botKey: string };
  const config = await aiConfigService.getPublicConfigBySlug(slug);
  await aiConfigService.validateBotKeyAgainst(config, botKey);

  res.json({
    businessName: config.businessName,
    greeting: config.greeting,
    quickReplies: config.quickReplies,
    whatsappNumber: config.whatsappNumber,
    transferInfo: config.transferInfo,
  });
}

/** Historial del cliente: para que retome su chat al volver al widget.
 * Con `since` (ISO date) devuelve solo los mensajes posteriores: el widget
 * hace polling liviano para detectar avisos de estado inyectados por el staff. */
export const getPublicChatHistory = async (req: Request, res: Response) => {
  const { slug, botKey, sessionId } = req.query as { slug: string; botKey: string; sessionId: string };
  const sinceRaw = (req.query as Record<string, string>).since;
  const config = await aiConfigService.getPublicConfigBySlug(slug);
  await aiConfigService.validateBotKeyAgainst(config, botKey);

  const all = await conversationsService.getHistoryFull(config.schoolId, sessionId);
  const since = sinceRaw ? new Date(sinceRaw) : null;
  const validSince = since && !Number.isNaN(since.getTime()) ? since : null;
  const messages = validSince
    ? all.filter(m => m.createdAt && m.createdAt > validSince)
    : all.slice(-LLM_HISTORY_MESSAGES_PUBLIC);

  res.json({ messages: messages.map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt })) });
}

const LLM_HISTORY_MESSAGES_PUBLIC = 30;

interface CreateOrderBody {
  slug: string;
  botKey: string;
  sessionId?: string;
  items: Array<{ product: string; quantity: number }>;
  customerName?: string;
  customerPhone?: string;
}

export const createDraftOrder = async (req: Request, res: Response) => {
  const body = req.body as CreateOrderBody;
  const config = await aiConfigService.getPublicConfigBySlug(body.slug);
  await aiConfigService.validateBotKeyAgainst(config, body.botKey);

  if (!config.botSellerId) {
    res.status(503).json({ error: 'AI_NOT_CONFIGURED', message: 'El asistente no está configurado aún' });
    return;
  }

  const { quote } = await quotesService.createQuote(
    config.schoolId,
    config.botSellerId,
    body.items,
    undefined,
    0,
    {
      source: 'bot',
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      botSessionId: body.sessionId,
    }
  );

  // Trackear el pedido en la conversación: el guard anti-duplicación del chat
  // lo usa para impedir que el LLM cree un segundo PED en la misma sesión.
  if (body.sessionId && quote.publicCode) {
    await conversationsService.setOrderCode(config.schoolId, body.sessionId, quote.publicCode);
  }

  res.status(201).json({
    publicCode: quote.publicCode ?? '',
    total: quote.total,
    items: quote.items.map(i => ({ name: i.name, quantity: i.quantity, subtotal: i.subtotal })),
  });
}

interface SetCustomerInfoBody {
  slug: string;
  botKey: string;
  customerName?: string;
  customerPhone?: string;
  paymentIntent?: 'cash' | 'transfer';
}

/**
 * Deeplink de WhatsApp armado server-side para un pedido del bot: número
 * normalizado del negocio + mensaje con el ticket (items, total, nombre).
 * El CTA existe SIEMPRE que haya un pedido. Con pago por transferencia el
 * mensaje es de envío de comprobante (los datos de transferencia ya los
 * recibió el cliente en el chat; no se repiten).
 */
export const getOrderWhatsappLink = async (req: Request, res: Response) => {
  const { slug, botKey } = req.query as { slug: string; botKey: string };
  const publicCode = req.params.publicCode as string;
  const config = await aiConfigService.getPublicConfigBySlug(slug);
  await aiConfigService.validateBotKeyAgainst(config, botKey);

  const quote = await quotesService.getBotOrderByPublicCode(config.schoolId, publicCode);
  if (!quote) {
    res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' });
    return;
  }

  const fmt = (n: number): string => n.toLocaleString('es-AR');
  const lines = [
    `Hola! Soy ${quote.customerName || 'un cliente'}, quiero confirmar mi pedido *${publicCode}*.`,
    '',
  ];
  for (const item of quote.items) {
    lines.push(`• ${item.quantity}x ${item.name} — $${fmt(item.subtotal)}`);
  }
  lines.push('', `Total: *$${fmt(quote.total)}*`);

  if (quote.paymentIntent === 'transfer') {
    lines.push('', 'Ya hice la transferencia, te adjunto el comprobante.');
  } else if (quote.paymentIntent === 'cash') {
    lines.push('', 'Lo pago en efectivo al retirar.');
  }

  const encoded = encodeURIComponent(lines.join('\n'));
  res.json({
    publicCode,
    whatsappUrl: `https://wa.me/${config.whatsappNumber}?text=${encoded}`,
    total: quote.total,
    customerName: quote.customerName || null,
    paymentIntent: quote.paymentIntent ?? null,
  });
}

export const setOrderCustomerInfo = async (req: Request, res: Response) => {
  const body = req.body as SetCustomerInfoBody;
  const config = await aiConfigService.getPublicConfigBySlug(body.slug);
  await aiConfigService.validateBotKeyAgainst(config, body.botKey);

  const quote = await quotesService.setOrderCustomerInfo({
    schoolId: config.schoolId,
    publicCode: req.params.publicCode as string,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    paymentIntent: body.paymentIntent,
  });

  res.json({ ok: true, paymentIntent: quote.paymentIntent ?? null });
};

interface MarkOrderPaidBody {
  slug: string;
  botKey: string;
}

/**
 * El cliente avisó que ya pagó la transferencia: el pedido pasa a 'paying'
 * (el staff lo verifica contra el comprobante y lo cobra desde el admin).
 * Idempotente — reintentos del widget no rompen nada.
 */
export const markOrderPaid = async (req: Request, res: Response) => {
  const body = req.body as MarkOrderPaidBody;
  const config = await aiConfigService.getPublicConfigBySlug(body.slug);
  await aiConfigService.validateBotKeyAgainst(config, body.botKey);

  const quote = await quotesService.markBotOrderPaying(config.schoolId, req.params.publicCode as string);

  res.json({ ok: true, status: quote.status });
};
