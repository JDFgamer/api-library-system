import { describe, it, expect } from 'vitest';
import { sanitizeMessagesForGemini } from '../../../../Services/Ai/llm/index.js';
import type { ChatMessage } from '../../../../Services/Ai/llm/types.js';

const glmMessages: ChatMessage[] = [
  { role: 'system', content: 'sys' },
  { role: 'user', content: 'quiero hilo' },
  {
    role: 'assistant',
    content: '',
    tool_calls: [
      { id: 'call_1', type: 'function', function: { name: 'search_products', arguments: '{"search":"hilo"}' } },
    ],
  },
  { role: 'tool', tool_call_id: 'call_1', name: 'search_products', content: '{"result":{"items":[]}}' },
  { role: 'assistant', content: 'No hay resultados' },
];

const geminiParallelMessages: ChatMessage[] = [
  { role: 'system', content: 'sys' },
  { role: 'user', content: 'una tijera un hilo amarillo y dos naranja' },
  {
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        id: 'call_g1',
        type: 'function',
        function: { name: 'search_products', arguments: '{"search":"tijera"}' },
        extra_content: { google: { thought_signature: 'sig-abc' } },
      },
      {
        id: 'call_g2',
        type: 'function',
        function: { name: 'search_products', arguments: '{"search":"hilo"}' },
        extra_content: { google: { thought_signature: 'sig-def' } },
      },
    ],
  },
  { role: 'tool', tool_call_id: 'call_g1', name: 'search_products', content: '{"result":{"items":["tijera"]}}' },
  { role: 'tool', tool_call_id: 'call_g2', name: 'search_products', content: '{"result":{"items":["hilo"]}}' },
  { role: 'user', content: 'cuánto es?' },
];

describe('sanitizeMessagesForGemini (aplanado de tool calls a memoria del assistant)', () => {
  it('fusiona assistant(tool_calls) + tool results y garantiza fin en user', () => {
    const out = sanitizeMessagesForGemini(glmMessages);
    // Sin roles tool ni tool_calls: secuencia válida para Gemini
    expect(out.filter(m => m.role === 'tool')).toHaveLength(0);
    expect(out.some(m => m.tool_calls && m.tool_calls.length > 0)).toBe(false);
    // La llamada y su resultado viven como memoria del assistant
    const flat = out.find(m => m.content?.includes('search_products'));
    expect(flat?.content).toContain('[consulté el catálogo/sistema:');
    expect(flat?.content).toContain('{"result":{"items":[]}}');
    // No hay users consecutivos ni turnos finales del modelo
    const roles = out.map(m => m.role);
    for (let i = 1; i < roles.length; i++) {
      expect(roles[i] === 'user' && roles[i - 1] === 'user').toBe(false);
    }
    expect(roles[roles.length - 1]).toBe('user');
  });

  it('aplana TAMBIÉN tool calls paralelos del propio Gemini (round-trip de signatures inválido)', () => {
    const out = sanitizeMessagesForGemini(geminiParallelMessages);
    expect(out.filter(m => m.role === 'tool')).toHaveLength(0);
    expect(out.some(m => m.tool_calls && m.tool_calls.length > 0)).toBe(false);
    // Ambos resultados fusionados en el mensaje de memoria
    const flat = out.find(m => m.role === 'assistant' && m.content.includes('consulté'));
    expect(flat?.content).toContain('"tijera"');
    expect(flat?.content).toContain('"hilo"');
    // El user posterior sobrevive
    expect(out.some(m => m.role === 'user' && m.content === 'cuánto es?')).toBe(true);
  });

  it('historial sin tool calls queda intacto', () => {
    const plain: ChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: '¡Hola!' },
    ];
    expect(sanitizeMessagesForGemini(plain)).toEqual(plain);
  });
});
