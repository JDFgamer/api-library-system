import type { ChatMessage, ToolCallRequest, StreamUsage, StreamTimings } from '../llm/index.js';
import { getPublicToolDefinitions } from '../toolCatalog/index.js';
import { logger } from '../../../utils/logger.js';
import type { AgentStreamEvent, AgentUsageSummary, RunAgentParams } from './types.js';

export type { AgentStreamEvent, AgentUsageSummary, RunAgentParams };

export const buildAgentMessages = (systemPrompt: string, history: ChatMessage[], userMessage: string): ChatMessage[] => [
  { role: 'system', content: systemPrompt },
  ...history,
  { role: 'user', content: userMessage },
];

export const runAgentLoop = async function* (params: RunAgentParams): AsyncGenerator<AgentStreamEvent> {
  const tools = getPublicToolDefinitions();
  const toolNames = new Set(tools.map(t => t.name));
  const messages = buildAgentMessages(params.systemPrompt, params.history, params.userMessage);

  let toolCallsUsed = 0;
  let steps = 0;
  let totalUsage: StreamUsage = { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 };
  let totalTimings: StreamTimings = { ttftMs: 0, totalMs: 0 };
  let nudged = false;
  let paymentNudged = false;
  let nameNudged = false;
  let emptyTextNudged = false;
  let createdOrder = false;
  let savedPayment = false;
  let savedName = false;
  let loopTextEmitted = false;

  for (let step = 0; step < params.maxToolCalls + 1; step++) {
    if (params.signal?.aborted) {
      yield { type: 'final' };
      return;
    }
    const stream = await params.streamText({ messages });
    let streamedContent = '';
    const pendingToolCalls: ToolCallRequest[] = [];

    for await (const chunk of stream) {
      if (chunk.content) {
        streamedContent += chunk.content;
        loopTextEmitted = true;
        yield { type: 'text', content: chunk.content };
      }
      for (const tc of chunk.toolCalls) {
        pendingToolCalls.push(tc);
      }
      if (chunk.usage) {
        totalUsage = {
          promptTokens: totalUsage.promptTokens + chunk.usage.promptTokens,
          cachedTokens: totalUsage.cachedTokens + chunk.usage.cachedTokens,
          completionTokens: totalUsage.completionTokens + chunk.usage.completionTokens,
          costUsd: Math.round((totalUsage.costUsd + chunk.usage.costUsd) * 1e8) / 1e8,
          modelUsed: chunk.usage.modelUsed ?? totalUsage.modelUsed,
        };
      }
      if (chunk.timings) {
        totalTimings = {
          ttftMs: totalTimings.ttftMs === 0 ? chunk.timings.ttftMs : Math.min(totalTimings.ttftMs, chunk.timings.ttftMs),
          totalMs: totalTimings.totalMs + chunk.timings.totalMs,
        };
      }
    }

    steps = step + 1;

    const usableToolCalls = pendingToolCalls.filter(tc => toolNames.has(tc.name));
    const canCallMoreTools = toolCallsUsed + usableToolCalls.length <= params.maxToolCalls;

    if (usableToolCalls.length === 0 || !canCallMoreTools) {
      // Red de seguridad anti burbuja vacía: el turno terminó sin texto ni
      // tools útiles (el modelo "colgó"). El cliente quedó mirando una burbuja
      // vacía sin saber si funcionó. Se re-inyecta UNA vez la orden de
      // responder algo útil. Solo aplica si el loop no emitió texto en todo
      // el turno (no pisamos la respuesta que ya dimos).
      if (usableToolCalls.length === 0 && !loopTextEmitted && !emptyTextNudged) {
        emptyTextNudged = true;
        messages.push({ role: 'assistant', content: streamedContent || '' });
        messages.push({
          role: 'user',
          content: '(sistema) Tu última respuesta quedó vacía: el cliente no vio nada. Respondé AHORA en UNA frase corta y útil: si el cliente pidió productos, agregalos con las tools correspondientes (search_products para obtener IDs, add_order_items); si preguntó algo, respondé su pregunta. No pidas disculpas ni expliques el error.',
        });
        step -= 1; // este paso no cuenta como intento
        continue;
      }
      // Red de seguridad del carrito: el cliente decidió comprar y ya eligió
      // productos, pero el modelo ni creó el pedido, ni agregó ítems, ni
      // preguntó si quiere algo más (el "Dame 4" ignorado: respondió texto
      // de cierre sin ejecutar ninguna tool). Se re-inyecta la orden una
      // única vez. No exige tools previas: con buySignal alcanza. Si ya se
      // disparó otra red este turno (anti-vacía), no re-nudgea.
      if (params.buySignal && !nudged && !emptyTextNudged && !createdOrder && usableToolCalls.length === 0) {
        nudged = true;
        yield { type: 'text_reset' };
        messages.push({ role: 'assistant', content: streamedContent || '' });
        const nudge = params.checkoutIntent
          ? '(sistema) El cliente confirmó que ya es todo. Creá el pedido AHORA con create_draft_order usando los IDs que te devolvió search_products, y respondé UNA frase con el código real + UNA sola pregunta combinada: su nombre y cómo prefiere pagar (efectivo al retirar o transferencia). No pidas confirmación ni enumeres los items. NO llames set_order_customer_info: el cliente todavía no respondió sus datos. NO inventes ningún nombre.'
          : '(sistema) El cliente acaba de elegir productos con cantidad y tu respuesta no confirmó qué entendiste. Respondé UNA frase corta confirmando producto Y cantidad exactos (ej: "¡Listo! 4 hilos amarillos, $12.000. ¿Querés agregar algo más o los cierro?"). No crees el pedido todavía ni pidas confirmación de lo que ya eligió.';
        messages.push({ role: 'user', content: nudge });
        step -= 1; // este paso no cuenta como intento
        continue;
      }
      // Red de seguridad de los datos de cierre: el modelo preguntó nombre+pago
      // combinados, el cliente respondió con uno o ambos, pero el modelo no los
      // guardó. Solo con pedido existente: sin pedido, "aceptan transferencia?"
      // o "me llamo X?" son preguntas, no respuestas de cierre.
      if (params.hasExistingOrder && (params.nameAnswer || params.paymentAnswer) && !nameNudged && !savedName && !savedPayment && usableToolCalls.length === 0) {
        nameNudged = true;
        yield { type: 'text_reset' };
        messages.push({ role: 'assistant', content: streamedContent || '' });
        messages.push({ role: 'user', content: '(sistema) El cliente acaba de responder datos de cierre (nombre y/o forma de pago). Guardalos AHORA con set_order_customer_info (publicCode del pedido abierto de esta conversación): customerName si dijo su nombre, paymentIntent si dijo cómo paga. Después respondé UNA frase corta: agradecé por su nombre si lo dio, y si falta algún dato preguntá SOLO el que falte. No repitas nada de lo que ya dijiste.' });
        step -= 1;
        continue;
      }
      // Red de seguridad del pago: el cliente respondió cómo pagar pero el modelo
      // no guardó el paymentIntent. Solo aplica si hay pedido en la conversación.
      if (params.hasExistingOrder && params.paymentAnswer && !paymentNudged && !savedPayment && usableToolCalls.length === 0) {
        paymentNudged = true;
        yield { type: 'text_reset' };
        messages.push({ role: 'assistant', content: streamedContent || '' });
        messages.push({ role: 'user', content: '(sistema) El cliente acaba de decir cómo va a pagar. Guardalo AHORA con set_order_customer_info (publicCode del pedido abierto de esta conversación + paymentIntent). No repitas la despedida que ya diste: respondé solo UNA frase corta confirmando el método de pago y, si es transferencia, pasando los datos de transferencia del contexto tal cual están escritos.' });
        step -= 1;
        continue;
      }
      yield { type: 'metrics', usage: { usage: totalUsage, timings: totalTimings, steps } };
      yield { type: 'final' };
      return;
    }

    if (usableToolCalls.some(tc => tc.name === 'create_draft_order')) createdOrder = true;
    if (usableToolCalls.some(tc => tc.name === 'set_order_customer_info')) {
      try {
        const args = JSON.parse(usableToolCalls.find(tc => tc.name === 'set_order_customer_info')!.arguments || '{}');
        if (args.paymentIntent === 'cash' || args.paymentIntent === 'transfer') savedPayment = true;
        if (typeof args.customerName === 'string' && args.customerName.trim().length >= 2) savedName = true;
      } catch { /* el executeTool le devolverá el error */ }
    }

    messages.push({
      role: 'assistant',
      content: streamedContent || '',
      tool_calls: usableToolCalls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments || '{}' },
        // Gemini 3.x (thought_signature): devolver intacto lo que envió el modelo.
        ...((tc.extraContent !== undefined) ? { extra_content: tc.extraContent } : {}),
      })),
    });

    for (const tc of usableToolCalls) {
      toolCallsUsed += 1;
      yield { type: 'tool_call', toolName: tc.name };

      let result: unknown;
      try {
        const args = JSON.parse(tc.arguments || '{}');
        result = await params.executeTool(tc.name, args);
      } catch (error) {
        // Devolver el error real al LLM para que pueda autocorregirse
        // (p. ej. "Producto no encontrado: Hilo Naranja" → reintentar con el ID).
        const message = error instanceof Error ? error.message : 'Error ejecutando la herramienta';
        logger.error('Tool execution failed', { tool: tc.name, error: message });
        result = { error: message };
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        // Gemini 3.x vía OpenAI-compat exige el nombre de la tool en el result
        // (function_response.name): sin esto responde 400 y el turno queda vacío.
        name: tc.name,
        content: JSON.stringify(result),
      });
    }
  }

  yield { type: 'metrics', usage: { usage: totalUsage, timings: totalTimings, steps } };
  yield { type: 'final' };
};
