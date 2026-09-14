import { describe, it, expect } from 'vitest';
import { runAgentLoop, buildAgentMessages } from '../../../../Services/Ai/agent/index.js';
import type { CompletionChunk } from '../../../../Services/Ai/llm/index.js';

function fakeStream(chunks: CompletionChunk[]): AsyncIterable<CompletionChunk> {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();
}

const toolContext = { schoolId: 'school-1', botSellerId: 'seller-1' };

describe('buildAgentMessages', () => {
  it('arma system + historial + mensaje del usuario', () => {
    const messages = buildAgentMessages('sos el bot', [{ role: 'user', content: 'hola' }], 'chau');
    expect(messages).toEqual([
      { role: 'system', content: 'sos el bot' },
      { role: 'user', content: 'hola' },
      { role: 'user', content: 'chau' },
    ]);
  });
});

describe('runAgentLoop', () => {
  it('streamea texto y finaliza sin tool calls', async () => {
    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'hola',
      toolContext,
      maxToolCalls: 3,
      streamText: async () => fakeStream([{ content: '¡Hola!', toolCalls: [], finishReason: 'stop' }]),
      executeTool: async () => ({}),
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'text', content: '¡Hola!' },
      expect.objectContaining({ type: 'metrics' }),
      { type: 'final' },
    ]);
  });

  it('ejecuta un tool call y streamea la segunda respuesta', async () => {
    let callCount = 0;
    const executedTools: string[] = [];

    const streamText = async () => {
      callCount += 1;
      if (callCount === 1) {
        return fakeStream([
          { content: '', toolCalls: [{ id: 'call_1', name: 'search_products', arguments: '{"search":"cuadernos"}' }], finishReason: 'tool_calls' },
        ]);
      }
      return fakeStream([{ content: 'Tenemos cuadernos', toolCalls: [], finishReason: 'stop' }]);
    };

    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'buscá cuadernos',
      toolContext,
      maxToolCalls: 3,
      streamText,
      executeTool: async (name) => {
        executedTools.push(name);
        return { items: [] };
      },
    })) {
      events.push(event);
    }

    expect(executedTools).toEqual(['search_products']);
    expect(events).toContainEqual({ type: 'tool_call', toolName: 'search_products' });
    expect(events).toContainEqual({ type: 'text', content: 'Tenemos cuadernos' });
    expect(events[events.length - 1]).toEqual({ type: 'final' });
  });

  it('respeta el máximo de tool calls por mensaje', async () => {
    const executedTools: string[] = [];
    const infiniteToolStream = async () => fakeStream([
      { content: '', toolCalls: [{ id: `call_${executedTools.length}`, name: 'search_products', arguments: '{"search":"x"}' }], finishReason: 'tool_calls' },
    ]);

    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'loop',
      toolContext,
      maxToolCalls: 2,
      streamText: infiniteToolStream,
      executeTool: async (name) => {
        executedTools.push(name);
        return { items: [] };
      },
    })) {
      events.push(event);
    }

    expect(executedTools.length).toBeLessThanOrEqual(2);
    expect(events[events.length - 1]).toEqual({ type: 'final' });
  });

  it('no ejecuta tool calls desconocidos', async () => {
    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'x',
      toolContext,
      maxToolCalls: 3,
      streamText: async () => fakeStream([
        { content: '', toolCalls: [{ id: 'call_1', name: 'delete_database', arguments: '{}' }], finishReason: 'tool_calls' },
      ]),
      executeTool: async () => ({ items: [] }),
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      expect.objectContaining({ type: 'metrics' }),
      { type: 'final' },
    ]);
  });

  it('propaga el error real de la tool al LLM para que pueda autocorregirse', async () => {
    let callCount = 0;
    let secondStepMessages: Array<{ role: string; content?: string; tool_call_id?: string }> = [];

    const streamText = async (params: { messages: Array<{ role: string; content?: string; tool_call_id?: string }> }) => {
      callCount += 1;
      if (callCount === 1) {
        return fakeStream([
          { content: '', toolCalls: [{ id: 'call_1', name: 'create_draft_order', arguments: '{"items":[{"product":"Hilo Naranja","quantity":3}]}' }], finishReason: 'tool_calls' },
        ]);
      }
      secondStepMessages = params.messages;
      return fakeStream([{ content: 'Pedido creado', toolCalls: [], finishReason: 'stop' }]);
    };

    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: '3 hilos naranjas',
      toolContext,
      maxToolCalls: 3,
      streamText,
      executeTool: async (name, args) => {
        if (name === 'create_draft_order' && (args as { items: Array<{ product: string }> }).items[0].product === 'Hilo Naranja') {
          throw new Error('Producto no encontrado: Hilo Naranja. El campo "product" debe ser el ID numérico.');
        }
        return { publicCode: 'PED-1234', total: 9000 };
      },
    })) {
      events.push(event);
    }

    // El error real viajó como mensaje tool al segundo paso del LLM
    const toolMessage = secondStepMessages.find(m => m.role === 'tool');
    expect(toolMessage?.tool_call_id).toBe('call_1');
    expect(toolMessage?.content).toContain('Producto no encontrado');
    // Y el loop siguió hasta la respuesta final
    expect(events).toContainEqual({ type: 'text', content: 'Pedido creado' });
    expect(events[events.length - 1]).toEqual({ type: 'final' });
  });
});

describe('runAgentLoop nudge anti-modelo-vago', () => {
  const buySignalFlow = async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      if (callCount === 1) {
        // Paso 1: solo search_products (el modelo "olvida" crear el pedido)
        return fakeStream([
          { content: '', toolCalls: [{ id: 'call_1', name: 'search_products', arguments: '{"search":"hilo"}' }], finishReason: 'tool_calls' },
        ]);
      }
      if (callCount === 2) {
        // Paso 2: responde texto sin crear el pedido (fin del turno sin order)
        return fakeStream([{ content: 'Tenemos hilo naranja a $3000', toolCalls: [], finishReason: 'stop' }]);
      }
      if (callCount === 3) {
        // Paso 3 (post-nudge): crea el pedido
        return fakeStream([
          { content: '', toolCalls: [{ id: 'call_2', name: 'create_draft_order', arguments: '{"items":[{"product":"p1","quantity":1}]}' }], finishReason: 'tool_calls' },
        ]);
      }
      // Paso 4: respuesta final con el código
      return fakeStream([{ content: 'Listo, PED-1111. ¿A nombre de quién?', toolCalls: [], finishReason: 'stop' }]);
    };
    const executedTools: string[] = [];
    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'quiero 1 hilo naranja',
      toolContext,
      maxToolCalls: 3,
      buySignal: true,
      streamText,
      executeTool: async (name) => {
        executedTools.push(name);
        return { result: { publicCode: 'PED-1111' } };
      },
    })) {
      events.push(event);
    }
    return { executedTools, events, callCount };
  };

  it('re-inyecta la orden de crear el pedido cuando hubo señal de compra y no se creó', async () => {
    const { executedTools, events } = await buySignalFlow();
    expect(executedTools).toEqual(['search_products', 'create_draft_order']);
    expect(events).toContainEqual({ type: 'text', content: 'Listo, PED-1111. ¿A nombre de quién?' });
  });

  it('sin buySignal el modelo puede cerrar el turno sin crear pedido (sin nudge)', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      return fakeStream([{ content: 'No tenemos eso, ¿te interesa algo más?', toolCalls: [], finishReason: 'stop' }]);
    };
    for await (const _event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'cuánto sale el hilo naranja?',
      toolContext,
      maxToolCalls: 3,
      streamText,
      executeTool: async () => ({ result: {} }),
    })) {
      // solo consumir
    }
    expect(callCount).toBe(1);
  });

  it('re-inyecta cuando el turno quedó sin texto ni tools (burbuja vacía: venta real PED-6342)', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      if (callCount === 1) {
        // El modelo "colgó": 0 texto, 0 tool calls
        return fakeStream([{ content: '', toolCalls: [], finishReason: 'stop' }]);
      }
      // Post-nudge: responde algo útil
      return fakeStream([{ content: '¡Listo! 4 hilos amarillos, $12.000. ¿Algo más?', toolCalls: [], finishReason: 'stop' }]);
    };
    const events: Array<{ type: string; content?: string }> = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'Hilo amarillo quiero 4',
      toolContext,
      maxToolCalls: 3,
      buySignal: true,
      streamText,
      executeTool: async () => ({ result: {} }),
    })) {
      events.push(event);
    }
    expect(callCount).toBe(2);
    expect(events).toContainEqual({ type: 'text', content: '¡Listo! 4 hilos amarillos, $12.000. ¿Algo más?' });
  });

  it('re-inyecta el carrito aunque el modelo no haya ejecutado tools ("Dame 4" ignorado)', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      if (callCount === 1) {
        // El modelo responde texto de cierre SIN ejecutar ninguna tool ni
        // confirmar la cantidad (exactamente el "Dame 4" de PED-6342)
        return fakeStream([{ content: '¿Querés agregar algo más o lo cierro?', toolCalls: [], finishReason: 'stop' }]);
      }
      return fakeStream([{ content: '¡Listo! 4 hilos amarillos, $12.000. ¿Algo más o los cierro?', toolCalls: [], finishReason: 'stop' }]);
    };
    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'Dame 4',
      toolContext,
      maxToolCalls: 3,
      buySignal: true,
      streamText,
      executeTool: async () => ({ result: {} }),
    })) {
      events.push(event);
    }
    expect(callCount).toBe(2);
    expect(events).toContainEqual({ type: 'text_reset' });
    expect(events).toContainEqual({ type: 'text', content: '¡Listo! 4 hilos amarillos, $12.000. ¿Algo más o los cierro?' });
  });

  it('sin buySignal el modelo puede cerrar el turno sin crear pedido ni re-nudge (search + texto)', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      if (callCount === 1) {
        return fakeStream([
          { content: '', toolCalls: [{ id: 'call_1', name: 'search_products', arguments: '{"search":"hilo"}' }], finishReason: 'tool_calls' },
        ]);
      }
      return fakeStream([{ content: 'Tenemos hilo naranja a $3000', toolCalls: [], finishReason: 'stop' }]);
    };
    const executedTools: string[] = [];
    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'cuánto sale el hilo?',
      toolContext,
      maxToolCalls: 3,
      buySignal: false,
      streamText,
      executeTool: async (name) => {
        executedTools.push(name);
        return { result: {} };
      },
    })) {
      events.push(event);
    }
    expect(executedTools).toEqual(['search_products']);
    expect(events.filter(e => e.type === 'text')).toHaveLength(1);
  });

  it('no re-nudgea si el pedido ya se creó en el turno', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      if (callCount === 1) {
        return fakeStream([
          { content: '', toolCalls: [{ id: 'call_1', name: 'create_draft_order', arguments: '{"items":[]}' }], finishReason: 'tool_calls' },
        ]);
      }
      return fakeStream([{ content: 'Listo, PED-2222', toolCalls: [], finishReason: 'stop' }]);
    };
    const executedTools: string[] = [];
    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'quiero 1 hilo',
      toolContext,
      maxToolCalls: 3,
      buySignal: true,
      streamText,
      executeTool: async (name) => {
        executedTools.push(name);
        return { result: { publicCode: 'PED-2222' } };
      },
    })) {
      events.push(event);
    }
    expect(callCount).toBe(2);
    expect(executedTools).toEqual(['create_draft_order']);
  });
});

describe('runAgentLoop nudge de nombre (cierre de venta)', () => {
  it('re-inyecta la orden de guardar el nombre cuando el cliente lo dijo y no se guardó', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      if (callCount === 1) {
        // El modelo agradece el nombre pero no lo guarda
        return fakeStream([{ content: '¡Genial, Juan Martin! ¿Efectivo o transferencia?', toolCalls: [], finishReason: 'stop' }]);
      }
      if (callCount === 2) {
        // Post-nudge: guarda el nombre
        return fakeStream([
          { content: '', toolCalls: [{ id: 'call_n', name: 'set_order_customer_info', arguments: '{"publicCode":"PED-5733","customerName":"Juan Martin"}' }], finishReason: 'tool_calls' },
        ]);
      }
      return fakeStream([{ content: '¡Listo, Juan Martin! ¿Efectivo o transferencia?', toolCalls: [], finishReason: 'stop' }]);
    };
    let savedArgs: unknown = null;
    for await (const _event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'Juan Martin',
      toolContext,
      maxToolCalls: 3,
      nameAnswer: true,
      hasExistingOrder: true,
      streamText,
      executeTool: async (name, args) => {
        if (name === 'set_order_customer_info') savedArgs = args;
        return { result: { publicCode: 'PED-5733', customerName: 'Juan Martin', customerPhone: null, paymentIntent: null } };
      },
    })) {
      // consumir
    }
    expect(savedArgs).toEqual({ publicCode: 'PED-5733', customerName: 'Juan Martin' });
    expect(callCount).toBe(3);
  });

  it('emite text_reset al nudgear (el widget descarta el texto duplicado)', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      if (callCount === 1) return fakeStream([{ content: '¡Genial, Juan Martin! ¿Efectivo o transferencia?', toolCalls: [], finishReason: 'stop' }]);
      if (callCount === 2) return fakeStream([{ content: '', toolCalls: [{ id: 'call_n', name: 'set_order_customer_info', arguments: '{"publicCode":"PED-5733","customerName":"Juan Martin"}' }], finishReason: 'tool_calls' }]);
      return fakeStream([{ content: '¡Listo, Juan Martin! ¿Efectivo o transferencia?', toolCalls: [], finishReason: 'stop' }]);
    };
    const events: Array<string> = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'Juan Martin',
      toolContext,
      maxToolCalls: 3,
      nameAnswer: true,
      hasExistingOrder: true,
      streamText,
      executeTool: async () => ({ result: {} }),
    })) {
      events.push(event.type);
    }
    expect(events).toContain('text_reset');
    // Un solo text_reset: el nudge es one-shot
    expect(events.filter(e => e === 'text_reset')).toHaveLength(1);
  });
});

describe('runAgentLoop nudge de pago (cierre de venta)', () => {
  it('re-inyecta la orden de guardar el pago cuando el cliente lo dijo y no se guardó', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      if (callCount === 1) {
        // El modelo se despide sin guardar el pago
        return fakeStream([{ content: '¡Gracias Ferni! Tocá el botón verde de WhatsApp.', toolCalls: [], finishReason: 'stop' }]);
      }
      if (callCount === 2) {
        // Post-nudge: guarda el pago
        return fakeStream([
          { content: '', toolCalls: [{ id: 'call_p', name: 'set_order_customer_info', arguments: '{"publicCode":"PED-4147","paymentIntent":"cash"}' }], finishReason: 'tool_calls' },
        ]);
      }
      // Cierre final
      return fakeStream([{ content: '¡Listo, quedó anotado en efectivo!', toolCalls: [], finishReason: 'stop' }]);
    };
    let savedArgs: unknown = null;
    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'efectivo',
      toolContext,
      maxToolCalls: 3,
      paymentAnswer: true,
      hasExistingOrder: true,
      streamText,
      executeTool: async (name, args) => {
        if (name === 'set_order_customer_info') savedArgs = args;
        return { result: { publicCode: 'PED-4147', customerName: 'Ferni', customerPhone: null, paymentIntent: 'cash' } };
      },
    })) {
      events.push(event);
    }
    expect(savedArgs).toEqual({ publicCode: 'PED-4147', paymentIntent: 'cash' });
    expect(callCount).toBe(3); // respuesta + nudge + tool-final
  });

  it('sin paymentAnswer no re-inyecta (puede despedirse sin tool)', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      return fakeStream([{ content: '¡Gracias!', toolCalls: [], finishReason: 'stop' }]);
    };
    const events = [];
    for await (const event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'ok',
      toolContext,
      maxToolCalls: 3,
      paymentAnswer: false,
      streamText,
      executeTool: async () => ({ result: {} }),
    })) {
      events.push(event);
    }
    expect(callCount).toBe(1);
  });

  it('sin pedido existente no re-inyecta ("aceptan transferencia?" es pregunta, no cierre)', async () => {
    let callCount = 0;
    const streamText = async () => {
      callCount += 1;
      return fakeStream([{ content: 'Sí, aceptamos transferencia!', toolCalls: [], finishReason: 'stop' }]);
    };
    for await (const _event of runAgentLoop({
      systemPrompt: 'sys',
      history: [],
      userMessage: 'aceptan transferencia?',
      toolContext,
      maxToolCalls: 3,
      paymentAnswer: true,
      hasExistingOrder: false,
      streamText,
      executeTool: async () => ({ result: {} }),
    })) {
      // solo consumir
    }
    expect(callCount).toBe(1);
  });
});
