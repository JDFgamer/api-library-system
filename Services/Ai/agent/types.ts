import type { ChatMessage, CompletionChunk } from '../llm/index.js';
import type { StreamUsage, StreamTimings } from '../llm/index.js';
import type { ToolContext } from '../toolCatalog/index.js';

export interface AgentStreamEvent {
  type: 'text' | 'tool_call' | 'final' | 'metrics' | 'text_reset';
  content?: string;
  toolName?: string;
  usage?: AgentUsageSummary;
}

export interface AgentUsageSummary {
  usage: StreamUsage;
  timings: StreamTimings;
  steps: number;
}

export interface RunAgentParams {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  toolContext: ToolContext;
  maxToolCalls: number;
  signal?: AbortSignal;
  streamText: (params: { messages: ChatMessage[] }) => Promise<AsyncIterable<CompletionChunk & { usage?: StreamUsage; timings?: StreamTimings }>>;
  executeTool: (name: string, args: unknown) => Promise<unknown>;
  /** Red de seguridad: mensaje del cliente con señal de compra explícita. */
  buySignal?: boolean;
  /** Red de seguridad: el cliente cerró el carrito ("nada más", "eso es todo") — toca crear el pedido. */
  checkoutIntent?: boolean;
  /** Red de seguridad: el cliente respondió su nombre (cierre de venta). */
  nameAnswer?: boolean;
  /** Red de seguridad: el cliente respondió cómo va a pagar (cierre de venta). */
  paymentAnswer?: boolean;
  /** El historial de la conversación ya contiene un pedido creado (código PED-xxxx). */
  hasExistingOrder?: boolean;
}

export interface AgentUsageSummary {
  usage: StreamUsage;
  timings: StreamTimings;
  steps: number;
}
