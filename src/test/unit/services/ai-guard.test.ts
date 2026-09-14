import { describe, it, expect } from 'vitest';
import { classifyMessage } from '../../../../Services/Ai/guard/index.js';
import { buildSellerSystemPrompt, hasBuySignal, hasCheckoutIntent, hasPaymentAnswer, hasNameAnswer } from '../../../../Services/Ai/prompts/index.js';
import type { BotBusinessContext } from '../../../../Services/Ai/config/index.js';

const merceriaContext: BotBusinessContext = {
  businessType: 'merceria',
  businessDescription: 'Mercería de barrio con fotocopias.',
  offTopics: ['comida', 'pizza', 'reparacion de celular'],
  offTopicReply: 'No trabajamos con eso, ¿te ayudo con algo del catálogo?',
};

const emptyContext: BotBusinessContext = {
  businessType: '',
  businessDescription: '',
  offTopics: [],
  offTopicReply: '',
};

describe('classifyMessage (gate pre-LLM)', () => {
  it('bloquea mensaje que matchea un tema off-topic (con y sin acentos)', () => {
    const r1 = classifyMessage('Hola, quiero comprar comida', merceriaContext);
    expect(r1.blocked).toBe(true);
    expect(r1.topic).toBe('comida');

    const r2 = classifyMessage('tenes pizza?', merceriaContext);
    expect(r2.blocked).toBe(true);
    expect(r2.topic).toBe('pizza');
  });

  it('no bloquea mensajes del rubro', () => {
    expect(classifyMessage('cuanto sale el hilo amarillo?', merceriaContext).blocked).toBe(false);
    expect(classifyMessage('quieren hacer fotocopias?', merceriaContext).blocked).toBe(false);
  });

  it('usa la respuesta custom del dueño', () => {
    const r = classifyMessage('quiero una pizza grande', merceriaContext);
    expect(r.reply).toBe('No trabajamos con eso, ¿te ayudo con algo del catálogo?');
  });

  it('sin off-topics configurados no bloquea nada', () => {
    expect(classifyMessage('quiero comida rapida', emptyContext).blocked).toBe(false);
  });

  it('responde default si el dueño no configuro reply', () => {
    const r = classifyMessage('pizza', { ...merceriaContext, offTopicReply: '' });
    expect(r.blocked).toBe(true);
    expect(r.reply.length).toBeGreaterThan(10);
  });
});

describe('buildSellerSystemPrompt con contexto de rubro', () => {
  it('incluye rubro, descripción y temas bloqueados', () => {
    const prompt = buildSellerSystemPrompt({
      businessName: 'Mercería Menta',
      businessContext: merceriaContext,
    });
    expect(prompt).toContain('Mercería Menta');
    expect(prompt).toContain('Rubro: merceria');
    expect(prompt).toContain('Mercería de barrio con fotocopias.');
    expect(prompt).toContain('comida, pizza, reparacion de celular');
    expect(prompt).toContain('NO atiende estos temas');
  });

  it('sin contexto no incluye el bloque de rubro', () => {
    const prompt = buildSellerSystemPrompt({
      businessName: 'Mercería Menta',
      businessContext: emptyContext,
    });
    expect(prompt).toContain('Mercería Menta');
    expect(prompt).not.toContain('# Contexto del negocio');
  });
});

describe('buildSellerSystemPrompt con flujo de cierre', () => {
  const prompt = buildSellerSystemPrompt({
    businessName: 'Mercería Menta',
    businessContext: merceriaContext,
  });

  it('conduce el cierre: carrito → nombre → pago', () => {
    expect(prompt).toContain('¿Querés agregar algo más o lo cierro?');
    expect(prompt).toContain('create_draft_order');
    expect(prompt).toContain('set_order_customer_info');
    expect(prompt).toContain('add_order_items');
    expect(prompt).toContain('efectivo al retirar o transferencia');
    expect(prompt).toContain('UN solo pedido');
  });

  it('mantiene el blindaje: el LLM jamás escribe links ni teléfonos', () => {
    expect(prompt).toContain('PROHIBIDO generar, armar, escribir o simular links');
    expect(prompt).toContain('PROHIBIDO mencionar números de teléfono');
  });

  it('prohíbe pedir teléfono/dirección (solo nombre y pago)', () => {
    expect(prompt).toContain('PROHIBIDO pedirle al cliente teléfono, email o dirección');
  });

  it('acepta nombre+pago juntos (pregunta unificada y una sola llamada)', () => {
    expect(prompt).toContain('nombre y cómo prefiere pagar');
    expect(prompt).toContain('ambos datos juntos si los dio juntos');
  });
});

describe('hasBuySignal (detección pre-LLM de decisión de compra)', () => {
  it('detecta decisiones de compra con producto/cantidad', () => {
    expect(hasBuySignal('Quiero 1 Hilo Naranja')).toBe(true);
    expect(hasBuySignal('dale, me llevo dos hilo amarillo')).toBe(true);
    expect(hasBuySignal('anotame 3 cuadernos')).toBe(true);
    expect(hasBuySignal('Dame uno')).toBe(true);
  });

  it('no dispara en consultas o saludos', () => {
    expect(hasBuySignal('cuanto sale el hilo naranja?')).toBe(false);
    expect(hasBuySignal('hola, que tenes?')).toBe(false);
    expect(hasBuySignal('tenes hilo azul?')).toBe(false);
  });
});

describe('hasCheckoutIntent (cierre del carrito)', () => {
  it('detecta confirmación de cierre de carrito', () => {
    expect(hasCheckoutIntent('no, nada más')).toBe(true);
    expect(hasCheckoutIntent('eso es todo')).toBe(true);
    expect(hasCheckoutIntent('si, avanza')).toBe(true);
    expect(hasCheckoutIntent('dale, cerralo')).toBe(true);
    expect(hasCheckoutIntent('ya está, confirma')).toBe(true);
  });

  it('no dispara al agregar productos ni en consultas', () => {
    expect(hasCheckoutIntent('quiero agregar una tijera')).toBe(false);
    expect(hasCheckoutIntent('cuánto sale?')).toBe(false);
    expect(hasCheckoutIntent('tenés tijeras?')).toBe(false);
  });
});

describe('hasPaymentAnswer (detección pre-LLM de respuesta de pago)', () => {
  it('detecta respuestas de método de pago', () => {
    expect(hasPaymentAnswer('efectivo')).toBe(true);
    expect(hasPaymentAnswer('Transferencia')).toBe(true);
    expect(hasPaymentAnswer('pago con transferencia')).toBe(true);
    expect(hasPaymentAnswer('en efectivo al retirar')).toBe(true);
  });

  it('no dispara en respuestas de nombre o producto', () => {
    expect(hasPaymentAnswer('Ariel')).toBe(false);
    expect(hasPaymentAnswer('quiero 2 hilo amarillo')).toBe(false);
    expect(hasPaymentAnswer('no, gracias')).toBe(false);
  });
});

describe('hasNameAnswer (detección pre-LLM de respuesta del nombre)', () => {
  it('detecta respuestas de nombre', () => {
    expect(hasNameAnswer('Juan Martin')).toBe(true);
    expect(hasNameAnswer('Ferni')).toBe(true);
    expect(hasNameAnswer('me llamo Ariel')).toBe(true);
    expect(hasNameAnswer('soy María José')).toBe(true);
  });

  it('detecta nombre+pago combinados (flujo unificado: "soy Ariel, pago con transferencia")', () => {
    expect(hasNameAnswer('soy Ariel, pago con transferencia')).toBe(true);
    expect(hasNameAnswer('Me llamo José, efectivo')).toBe(true);
    expect(hasNameAnswer('soy Ariel y pago en efectivo al retirar')).toBe(true);
  });

  it('detecta nombre+pago SIN prefijo (venta real PED-6342: "Ariel y pago con transferencia")', () => {
    expect(hasNameAnswer('Ariel y pago con transferencia')).toBe(true);
    expect(hasNameAnswer('Ariel, transferencia')).toBe(true);
    expect(hasNameAnswer('Ariel efectivo')).toBe(true);
    expect(hasNameAnswer('Maria del Carmen, transferencia')).toBe(true);
  });

  it('no dispara en preguntas, mensajes largos ni respuestas de producto/pago', () => {
    expect(hasNameAnswer('¿te parece ok mi nombre?')).toBe(false);
    expect(hasNameAnswer('efectivo')).toBe(false);
    expect(hasNameAnswer('quiero 2 hilo amarillo')).toBe(false);
    expect(hasNameAnswer('hola, aceptan transferencia?')).toBe(false);
    expect(hasNameAnswer('transferencia')).toBe(false);
    expect(hasNameAnswer('pago con transferencia')).toBe(false);
    expect(hasNameAnswer('en efectivo')).toBe(false);
    expect(hasNameAnswer('con transferencia')).toBe(false);
    expect(hasNameAnswer('soy cliente nuevo')).toBe(false);
    expect(hasNameAnswer('buenas tardes queria consultar si tienen stock de hilo naranja para mañana')).toBe(false);
  });
});
