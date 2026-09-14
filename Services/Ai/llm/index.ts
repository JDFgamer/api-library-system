import OpenAI from 'openai';
import type { Stream } from 'openai/streaming.js';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions.js';
import type { ChatCompletionMessageToolCall, ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat/completions.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import type {
  ChatMessage,
  ToolDefinition,
  ToolCallRequest,
  CompletionChunk,
  CompletionParams,
  CompletionChunkWithMetrics,
  StreamUsage,
  StreamTimings,
  ModelPrice,
} from './types.js';

export type {
  ChatMessage,
  ToolDefinition,
  ToolCallRequest,
  CompletionChunk,
  CompletionParams,
  CompletionChunkWithMetrics,
  StreamUsage,
  StreamTimings,
  ModelPrice,
};

interface LlmProvider {
  name: string;
  client: OpenAI;
  model: string;
}

// GLM "piensa" antes de responder (hasta 40s de silencio en el chat).
// Para ventas: respuesta inmediata, sin razonamiento. Gemini no soporta el flag
// "thinking" y hace razonamiento corto por defecto en la API de compatibilidad.
const supportsThinkingFlag = (baseUrl: string): boolean => !baseUrl.includes('googleapis.com');

const buildProviders = (): LlmProvider[] => {
  const providers: LlmProvider[] = [];
  if (env.AI_LLM_API_KEY) {
    providers.push({
      name: `primary:${env.AI_LLM_MODEL}`,
      client: new OpenAI({
        baseURL: env.AI_LLM_BASE_URL,
        apiKey: env.AI_LLM_API_KEY,
        timeout: env.AI_LLM_TIMEOUT_MS,
        maxRetries: 0,
      }),
      model: env.AI_LLM_MODEL,
    });
  }
  if (env.AI_LLM_FALLBACK_API_KEY && env.AI_LLM_FALLBACK_BASE_URL && env.AI_LLM_FALLBACK_MODEL) {
    providers.push({
      name: `fallback:${env.AI_LLM_FALLBACK_MODEL}`,
      client: new OpenAI({
        baseURL: env.AI_LLM_FALLBACK_BASE_URL,
        apiKey: env.AI_LLM_FALLBACK_API_KEY,
        timeout: env.AI_LLM_TIMEOUT_MS,
        maxRetries: 0,
      }),
      model: env.AI_LLM_FALLBACK_MODEL,
    });
  }
  return providers;
};

let providers: LlmProvider[] | null = null;

const getProviders = (): LlmProvider[] => {
  if (!providers) providers = buildProviders();
  return providers;
};

const RETRY_DELAYS_MS = [1000];

const MAX_OUTPUT_TOKENS = 400;
const TEMPERATURE = 0.4;

// Precios por 1M de tokens en USD (Docs/ai-bot-cost-analysis.md §2.1/§2.4).
const MODEL_PRICES: Record<string, ModelPrice> = {
  'glm-4.7-flashx': { input: 0.07, cached: 0.01, output: 0.40 },
  'glm-4.7-flash': { input: 0.07, cached: 0.01, output: 0.40 },
  'glm-4.7': { input: 0.60, cached: 0.11, output: 2.20 },
  'glm-4.6': { input: 0.60, cached: 0.11, output: 2.20 },
  'glm-4.5-flash': { input: 0.07, cached: 0.01, output: 0.40 },
  'glm-4.5': { input: 0.60, cached: 0.11, output: 2.20 },
  // Gemini (Google AI, pricing oficial por 1M tokens)
  'gemini-3.6-flash': { input: 0.75, cached: 0.075, output: 3.75 },
  'gemini-3.7-flash': { input: 0.75, cached: 0.075, output: 3.75 },
  'gemini-3.8-flash': { input: 0.75, cached: 0.075, output: 3.75 },
  'gemini-3.5-flash': { input: 1.50, cached: 0.15, output: 9.00 },
  'gemini-3.5-flash-lite': { input: 0.30, cached: 0.03, output: 2.50 },
  'gemini-3.1-flash-lite': { input: 0.25, cached: 0.025, output: 1.50 },
  'gemini-2.5-flash': { input: 0.30, cached: 0.075, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, cached: 0.01, output: 0.40 },
};

const UNKNOWN_MODEL_PRICE: ModelPrice = { input: 0.60, cached: 0.11, output: 2.20 };

// Precio por defecto para modelos Gemini no listados en MODEL_PRICES (p. ej.
// versiones nuevas aún no registradas): se aproxima por familia "flash-lite".
const GEMINI_UNKNOWN_PRICE: ModelPrice = { input: 0.30, cached: 0.03, output: 2.50 };

const computeCostUsdForModel = (model: string, usage: { promptTokens: number; cachedTokens: number; completionTokens: number }): number => {
  const price = MODEL_PRICES[model] ?? (model.startsWith('gemini-') ? GEMINI_UNKNOWN_PRICE : UNKNOWN_MODEL_PRICE);
  const nonCached = Math.max(0, usage.promptTokens - usage.cachedTokens);
  const cost = (nonCached * price.input + usage.cachedTokens * price.cached + usage.completionTokens * price.output) / 1_000_000;
  return Math.round(cost * 1e8) / 1e8;
};

const getPromptCacheStatsKey = (): string => {
  const models = getProviders().map(p => p.model).join('|');
  return `llm:prompt-cache:${models}`;
};

export const computeCostUsd = (usage: { promptTokens: number; cachedTokens: number; completionTokens: number }): number =>
  computeCostUsdForModel(env.AI_LLM_MODEL, usage);

const isRetryableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Insufficient balance') || message.includes('1113')) return false;
  return message.includes('429') || message.includes('temporarily overloaded') || message.includes('Request timed out');
};

/**
 * Gemini 3.x vía OpenAI-compat NO acepta el round-trip de sus propios tool calls
 * emitidos en streaming: las thought_signatures quedan parciales/corruptas y
 * responde 400 ("Corrupted/Invalid/missing thought_signature"). Tampoco acepta
 * tool calls de otros proveedores (GLM tras un fallover).
 * Solución: aplanar cada bloque assistant(tool_calls) + sus tool results en UN
 * solo mensaje assistant con la acción y los resultados narrados como memoria
 * propia del modelo — evita que re-consulte y que haya users consecutivos.
 */
export const sanitizeMessagesForGemini = (messages: ChatMessage[]): ChatMessage[] => {
  const hasAnyToolCall = messages.some(m => m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0);
  if (!hasAnyToolCall) return messages;

  const out: ChatMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
      const parts: string[] = [];
      if (m.content) parts.push(m.content);
      const narrated = m.tool_calls.map(tc => {
        const result = messages[i + 1] && messages[i + 1].role === 'tool' && messages[i + 1].tool_call_id === tc.id
          ? (messages[i + 1] as ChatMessage).content
          : null;
        const call = `${tc.function.name}(${tc.function.arguments})`;
        return result !== null ? `${call} → ${result}` : call;
      });
      parts.push(`[consulté el catálogo/sistema: ${narrated.join('; ')}]`);
      out.push({ role: 'assistant', content: parts.join(' ') });
      let j = i + 1;
      while (j < messages.length && messages[j].role === 'tool') j++;
      i = j - 1;
      continue;
    }
    if (m.role === 'tool') {
      out.push({ role: 'user', content: `(resultado de la herramienta: ${m.content})` });
      continue;
    }
    out.push(m);
  }

  // Gemini exige que el request termine con turno del usuario ("Requests ending
  // with a model turn are not supported"): si el aplanado dejó el final en un
  // assistant (caso del agent loop re-consultando con resultados frescos), se
  // fusionan los últimos mensajes en un user con todo el contexto.
  if (out.length > 0 && out[out.length - 1].role === 'assistant') {
    const tail: string[] = [];
    while (out.length > 0 && (out[out.length - 1].role === 'assistant' || out[out.length - 1].role === 'user')) {
      const last = out.pop()!;
      if (last.content) tail.unshift(last.content);
    }
    out.push({ role: 'user', content: tail.join('\n') });
  }
  return out;
};

const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_DELAYS_MS.length || !isRetryableError(error)) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastError;
};

export const getLlmClient = (): OpenAI => {
  const list = getProviders();
  if (list.length === 0) {
    throw new Error('AI_LLM_API_KEY no está configurada');
  }
  return list[0].client;
};

export const isLlmConfigured = (): boolean => getProviders().length > 0;

export interface ProviderResolution {
  provider: LlmProvider;
  modelUsed: string;
}

const streamWithFallback = async (params: CompletionParams): Promise<{ stream: Stream<ChatCompletionChunk>; modelUsed: string }> => {
  const list = getProviders();
  let lastError: unknown;
  for (const provider of list) {
    try {
      const thinkingDisabled = supportsThinkingFlag(provider.client.baseURL) ? { type: 'disabled' } as never : undefined;
      const isGemini = !supportsThinkingFlag(provider.client.baseURL);
      // Gemini 3.x: si el historial trae tool calls de OTRO proveedor (p. ej. GLM tras un
      // fallover), los rechaza porque les falta thought_signature. Los aplanamos a texto:
      // el contexto queda intacto para el modelo, solo cambia el formato de transporte.
      const messages = isGemini ? sanitizeMessagesForGemini(params.messages) : params.messages;
      if (isGemini) {
        const badToolMsg = messages.findIndex(m => m.role === 'tool' && !(m as { name?: string }).name);
        if (badToolMsg >= 0) {
          logger.error('GEMINI 400 PRE-DUMP: tool message sin name', {
            position: badToolMsg,
            allMessages: JSON.stringify(messages.map((m, idx) => ({
              idx,
              role: m.role,
              name: (m as { name?: string }).name ?? null,
              tool_call_id: m.tool_call_id ?? null,
              toolCalls: m.tool_calls?.map(tc => ({ id: tc.id, name: tc.function.name })) ?? [],
            }))),
          });
        }
      }
      const stream = await withRetry(async (): Promise<Stream<ChatCompletionChunk>> =>
        (await provider.client.chat.completions.create({
          model: provider.model,
          messages: messages as never,
          tools: params.tools,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: TEMPERATURE,
          ...(thinkingDisabled ? { thinking: thinkingDisabled } : {}),
        } as never, {
          // Opciones del request (no del body): cancelación del stream.
          ...(params.signal ? { signal: params.signal } : {}),
        })) as unknown as Stream<ChatCompletionChunk>
      );
      return { stream, modelUsed: provider.model };
    } catch (error) {
      if (params.signal?.aborted) throw error;
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('LLM provider falló, probando siguiente', { provider: provider.name, error: message.slice(0, 200) });
    }
  }
  throw lastError;
};

export const streamChatCompletion = async (params: CompletionParams): Promise<AsyncIterable<CompletionChunkWithMetrics>> => {
  const startedAt = Date.now();
  let firstTokenAt: number | null = null;
  let receivedUsage: StreamUsage | null = null;

  const { stream, modelUsed } = await streamWithFallback(params);

  return (async function* () {
    const toolCallBuffers = new Map<string | number, { id: string; name: string; arguments: string; extraContent?: unknown }>();
    // Chunk inicial de Gemini: id + index; chunks siguientes: solo index. Este
    // map resuelve el id real de cada index para no duplicar buffers.
    const indexToId = new Map<number, string>();

    for await (const chunk of stream) {
      if (firstTokenAt === null && (chunk.choices?.length || chunk.usage)) {
        firstTokenAt = Date.now();
      }

      if (chunk.usage) {
        receivedUsage = {
          promptTokens: chunk.usage.prompt_tokens,
          cachedTokens: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
          completionTokens: chunk.usage.completion_tokens,
          costUsd: 0,
        };
      }

      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;
      const content = delta?.content ?? '';
      const toolCalls = delta?.tool_calls ?? [];

      for (const tc of toolCalls) {
        // Gemini emite cada tool call en varios chunks: el PRIMERO trae el id
        // (y a veces el index), los siguientes solo index + argumentos. Sin este
        // mapeo index→id se creaban buffers duplicados con name vacío, y el
        // tool result con name vacío hace que Gemini responda 400.
        if (tc.id && tc.index !== undefined) {
          indexToId.set(tc.index, tc.id);
        }
        const resolvedId = tc.id ?? (tc.index !== undefined ? indexToId.get(tc.index) : undefined);

        const existing = resolvedId
          ? Array.from(toolCallBuffers.values()).find(b => b.id === resolvedId)
          : toolCallBuffers.get(tc.index ?? 0);

        const buffer = existing ?? (() => {
          const created: { id: string; name: string; arguments: string; extraContent?: unknown } = { id: resolvedId ?? `call_${toolCallBuffers.size}`, name: tc.function?.name ?? '', arguments: '' };
          toolCallBuffers.set(resolvedId ?? tc.index ?? toolCallBuffers.size, created);
          return created;
        })();
        if (tc.function?.name && !buffer.name) buffer.name = tc.function.name;
        if (tc.function?.arguments) buffer.arguments += tc.function.arguments;
        // Gemini 3.x: preservar extra_content (thought_signature) para la
        // siguiente vuelta del loop de tools.
        const extra = (tc as { extra_content?: unknown }).extra_content;
        if (extra) buffer.extraContent = extra;
      }

      yield {
        content,
        toolCalls: [],
        finishReason: choice.finish_reason ?? null,
      };
    }

    const ttftMs = firstTokenAt !== null ? firstTokenAt - startedAt : Date.now() - startedAt;
    const totalMs = Date.now() - startedAt;

    const usage: StreamUsage = receivedUsage ?? { promptTokens: 0, cachedTokens: 0, completionTokens: 0, costUsd: 0 };
    if (receivedUsage) {
      usage.costUsd = computeCostUsdForModel(modelUsed, receivedUsage);
    }
    usage.modelUsed = modelUsed;

    logger.debug('LLM request metrics', {
      key: getPromptCacheStatsKey(),
      model: modelUsed,
      ttftMs,
      totalMs,
      ...usage,
    });

    yield {
      content: '',
      toolCalls: toolCallBuffers.size > 0
        ? Array.from(toolCallBuffers.values()).map(tc => ({ id: tc.id, name: tc.name, arguments: tc.arguments, extraContent: tc.extraContent }))
        : [],
      finishReason: toolCallBuffers.size > 0 ? 'tool_calls' : null,
      usage,
      timings: { ttftMs, totalMs },
    };
  })();
};

const isFunctionToolCall = (tc: ChatCompletionMessageToolCall): tc is ChatCompletionMessageFunctionToolCall =>
  tc.type === 'function';

export const completeChat = async (params: CompletionParams): Promise<{ content: string; toolCalls: ToolCallRequest[] }> => {
  const list = getProviders();
  if (list.length === 0) throw new Error('Ningún LLM configurado');
  let lastError: unknown;

  for (const provider of list) {
    try {
      const response = await provider.client.chat.completions.create({
        model: provider.model,
        messages: params.messages as never,
        tools: params.tools,
      } as never);

      const choice = response.choices[0];
      const toolCalls = (choice?.message?.tool_calls ?? [])
        .filter(isFunctionToolCall)
        .map((tc): ToolCallRequest => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        }));

      return {
        content: choice?.message?.content ?? '',
        toolCalls,
      };
    } catch (error) {
      if (params.signal?.aborted) throw error;
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('LLM provider falló en completeChat', { provider: provider.name, error: message.slice(0, 200) });
    }
  }
  throw lastError;
};

export { MODEL_PRICES };
