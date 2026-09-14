import { describe, it, expect } from 'vitest';
import { getOpenAiTools, getPublicToolDefinitions, toPublicProduct, setOrderCustomerInfoTool, addOrderItemsTool } from '../../../../Services/Ai/toolCatalog/index.js';

describe('toolCatalog público', () => {
  it('expone search_products, create_draft_order, add_order_items y set_order_customer_info', () => {
    const tools = getPublicToolDefinitions();
    const names = tools.map(t => t.name);
    expect(names).toEqual(['search_products', 'create_draft_order', 'add_order_items', 'set_order_customer_info']);
  });

  it('genera definiciones OpenAI con nombre, descripción y parámetros', () => {
    const openaiTools = getOpenAiTools();
    expect(openaiTools).toHaveLength(4);
    for (const tool of openaiTools) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
    }
  });
});

describe('set_order_customer_info (schema)', () => {
  it('valida publicCode PED-XXXX y paymentIntent del dominio', () => {
    const ok = setOrderCustomerInfoTool.parameters.safeParse({
      publicCode: 'PED-1234',
      customerName: 'Ariel',
      paymentIntent: 'transfer',
    });
    expect(ok.success).toBe(true);

    const badCode = setOrderCustomerInfoTool.parameters.safeParse({ publicCode: 'PED-12345' });
    expect(badCode.success).toBe(false);

    const badPayment = setOrderCustomerInfoTool.parameters.safeParse({
      publicCode: 'PED-1234',
      paymentIntent: 'bitcoin',
    });
    expect(badPayment.success).toBe(false);
  });

  it('exige al menos publicCode (nombre y pago son opcionales de a uno)', () => {
    const onlyCode = setOrderCustomerInfoTool.parameters.safeParse({ publicCode: 'PED-0001' });
    expect(onlyCode.success).toBe(true);
  });
});

describe('toPublicProduct (whitelist de seguridad)', () => {
  it('oculta costo, stock exacto y margen; solo disponibilidad', () => {
    const publicProduct = toPublicProduct({
      id: 'p1',
      name: 'Cuaderno A4',
      price: 2500,
      stock: 7,
      type: 'product',
    });

    expect(publicProduct).toEqual({
      id: 'p1',
      name: 'Cuaderno A4',
      price: 2500,
      available: true,
      availabilityNote: undefined,
    });
    expect(publicProduct).not.toHaveProperty('cost');
    expect(publicProduct).not.toHaveProperty('stock');
    expect(publicProduct).not.toHaveProperty('minStock');
  });

  it('marca agotado cuando stock es 0', () => {
    const publicProduct = toPublicProduct({ id: 'p2', name: 'Birome', price: 100, stock: 0, type: 'product' });
    expect(publicProduct.available).toBe(false);
    expect(publicProduct.availabilityNote).toBe('Agotado');
  });

  it('los servicios siempre están disponibles', () => {
    const publicProduct = toPublicProduct({ id: 'p3', name: 'Plastificado', price: 500, stock: 0, type: 'service' });
    expect(publicProduct.available).toBe(true);
  });
});

describe('add_order_items (schema)', () => {
  it('valida publicCode y items requeridos', () => {
    const ok = addOrderItemsTool.parameters.safeParse({
      publicCode: 'PED-5679',
      items: [{ product: '507f1f77bcf86cd799439011', quantity: 2 }],
    });
    expect(ok.success).toBe(true);
  });

  it('rechaza items vacíos o cantidades inválidas', () => {
    const empty = addOrderItemsTool.parameters.safeParse({ publicCode: 'PED-5679', items: [] });
    expect(empty.success).toBe(false);
    const badQty = addOrderItemsTool.parameters.safeParse({ publicCode: 'PED-5679', items: [{ product: 'x', quantity: 0 }] });
    expect(badQty.success).toBe(false);
  });
});
