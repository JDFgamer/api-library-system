export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string }; extra_content?: unknown }>;
  tool_call_id?: string;
  /** Nombre de la tool (rol tool): requerido por el compat layer de Gemini. */
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
  // Gemini 3.x exige devolver el thought_signature del tool call en la
  // siguiente vuelta (viaja en extra_content.google.thought_signature).
  extraContent?: unknown;
}

export interface CompletionChunk {
  content: string;
  toolCalls: ToolCallRequest[];
  finishReason: string | null;
}

export interface StreamUsage {
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  costUsd: number;
  modelUsed?: string;
}

export interface StreamTimings {
  ttftMs: number;
  totalMs: number;
}

export interface CompletionChunkWithMetrics extends CompletionChunk {
  usage?: StreamUsage;
  timings?: StreamTimings;
}

export interface CompletionParams {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

export interface ModelPrice {
  input: number;
  cached: number;
  output: number;
}
