import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuoteModel } from '../../../../models/Quote/index.js';
import { ProductModel } from '../../../../models/Product/index.js';
import { ClientModel } from '../../../../models/Client/index.js';
import * as quotesService from '../../../../Services/Quotes/index.js';
import { NotFoundError, ValidationError } from '../../../../utils/errors.js';

vi.mock('../../../../models/Quote/index.js');
vi.mock('../../../../models/Product/index.js');
vi.mock('../../../../models/Client/index.js');
type MockDoc = { _id?: unknown; [key: string]: unknown };

vi.mock('../../../../utils/lean.js', () => {
  return {
    withId: vi.fn((x: MockDoc) => ({ ...x, id: x._id?.toString() ?? 'mock-id' })),
    withIds: vi.fn((arr: MockDoc[]) => arr.map((x: MockDoc) => ({ ...x, id: x._id?.toString() ?? 'mock-id' })))
  };
});

describe('Quotes Service', () => {
  const schoolId = 'school-1';
  const sellerId = 'seller-1';
  const productId = 'product-1';
  const clientId = 'client-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('previewQuote', () => {
    it('should calculate quote preview correctly', async () => {
      const mockProduct = {
        _id: productId,
        name: 'Test Product',
        type: 'product',
        price: 1000,
        cost: 500,
        active: true,
        school: schoolId,
      };
      const mockClient = { _id: clientId, fullName: 'Test Client', balance: 0, school: schoolId };

      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(ProductModel.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockProduct]),
      });
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(ClientModel.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockClient),
      });

      const result = await quotesService.previewQuote(schoolId, [{ product: productId, quantity: 2 }], clientId, 500);

      expect(result.subtotal).toBe(2000);
      expect(result.discount).toBe(500);
      expect(result.total).toBe(1500);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].unitPrice).toBe(1000);
    });

    it('should throw NotFoundError for non-existent product', async () => {
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(ProductModel.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });

      await expect(
        quotesService.previewQuote(schoolId, [{ product: 'non-existent', quantity: 1 }], undefined, 0)
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for inactive product', async () => {
      const mockProduct = { _id: productId, name: 'Test Product', active: false };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(ProductModel.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockProduct]),
      });

      await expect(
        quotesService.previewQuote(schoolId, [{ product: productId, quantity: 1 }], undefined, 0)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when discount exceeds subtotal', async () => {
      const mockProduct = { _id: productId, name: 'Test Product', type: 'product', price: 1000, active: true };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(ProductModel.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockProduct]),
      });

      await expect(
        quotesService.previewQuote(schoolId, [{ product: productId, quantity: 1 }], undefined, 2000)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('createQuote', () => {
    it('should create quote with sequential number', async () => {
      const mockProduct = {
        _id: productId,
        name: 'Test Product',
        type: 'product',
        price: 1000,
        cost: 500,
        active: true,
      };
      const mockClient = { _id: clientId, fullName: 'Test Client', balance: 0 };

      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(ProductModel.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockProduct]),
      });
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(ClientModel.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockClient),
      });
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          session: vi.fn().mockResolvedValue(null),
        }),
      });
      
      // Mock session for transaction
      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      };
      // @ts-expect-error - mocking mongoose connection
      QuoteModel.db = {
        startSession: vi.fn().mockResolvedValue(mockSession),
      };

      vi.mocked(QuoteModel.create).mockResolvedValue([{
        _id: 'quote-1',
        number: 1,
        subtotal: 1000,
        discount: 0,
        total: 1000,
        items: [{ product: productId, name: 'Test Product', type: 'product', quantity: 1, unitPrice: 1000, unitCost: 500, subtotal: 1000 }],
        client: clientId,
        seller: sellerId,
        school: schoolId,
        status: 'active',
        createdAt: new Date(),
        toJSON: function() { return this; },
      }]);

      const result = await quotesService.createQuote(schoolId, sellerId, [{ product: productId, quantity: 1 }], clientId, 0);

      expect(result.quote.number).toBe(1);
      expect(result.quote.total).toBe(1000);
    });

    it('should increment number from last quote', async () => {
      const mockProduct = { _id: productId, name: 'Test Product', type: 'product', price: 1000, cost: 500, active: true };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(ProductModel.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockProduct]),
      });
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          session: vi.fn().mockResolvedValue({ number: 5 }),
        }),
      });
      
      // Mock session for transaction
      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn(),
        endSession: vi.fn(),
      };
      // @ts-expect-error - mocking mongoose connection
      QuoteModel.db = {
        startSession: vi.fn().mockResolvedValue(mockSession),
      };

      vi.mocked(QuoteModel.create).mockResolvedValue([{
        _id: 'quote-2',
        number: 6,
        subtotal: 1000,
        discount: 0,
        total: 1000,
        items: [],
        seller: sellerId,
        school: schoolId,
        status: 'active',
        createdAt: new Date(),
        toJSON: function() { return this; },
      }]);

      const result = await quotesService.createQuote(schoolId, sellerId, [{ product: productId, quantity: 1 }], undefined, 0);

      expect(result.quote.number).toBe(6);
    });
  });

  describe('getQuoteById', () => {
    it('should return quote with populated client and seller', async () => {
      const mockQuote = {
        _id: 'quote-1',
        number: 1,
        subtotal: 1000,
        discount: 0,
        total: 1000,
        items: [],
        client: { _id: clientId, fullName: 'Test Client', balance: 0 },
        seller: { _id: sellerId, name: 'Test Seller', role: 'seller' },
        status: 'active',
        createdAt: new Date(),
      };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockQuote),
          }),
        }),
      });

      const result = await quotesService.getQuoteById(schoolId, 'quote-1');

      expect(result.id).toBe('quote-1');
      expect(result.number).toBe(1);
    });

    it('should throw NotFoundError for non-existent quote', async () => {
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(quotesService.getQuoteById(schoolId, 'non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listQuotes', () => {
    it('should return paginated quotes with filters', async () => {
      const mockQuotes = [
        { _id: 'quote-1', number: 1, total: 1000, status: 'active' },
        { _id: 'quote-2', number: 2, total: 2000, status: 'active' },
      ];
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.find).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              populate: vi.fn().mockReturnValue({
                populate: vi.fn().mockReturnValue({
                  lean: vi.fn().mockResolvedValue(mockQuotes),
                }),
              }),
            }),
          }),
        }),
      });
      vi.mocked(QuoteModel.countDocuments).mockResolvedValue(2);

      const result = await quotesService.listQuotes({
        schoolId,
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });
  });

  describe('cancelQuote', () => {
    it('should cancel active quote', async () => {
      const mockQuote = {
        _id: 'quote-1',
        status: 'active',
        save: vi.fn().mockResolvedValue(true),
        toJSON: function() { return { ...this, id: this._id }; },
      };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockResolvedValue(mockQuote);

      const result = await quotesService.cancelQuote(schoolId, 'quote-1');

      expect(result.status).toBe('cancelled');
      expect(mockQuote.save).toHaveBeenCalled();
    });

    it('should throw ValidationError for already cancelled quote', async () => {
      const mockQuote = { _id: 'quote-1', status: 'cancelled' };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockResolvedValue(mockQuote);

      await expect(quotesService.cancelQuote(schoolId, 'quote-1')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent quote', async () => {
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockResolvedValue(null);

      await expect(quotesService.cancelQuote(schoolId, 'non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('markBotOrderPaying (aviso "Ya pagué" del cliente)', () => {
    const baseQuote = {
      _id: 'quote-1',
      status: 'confirmed',
      paymentIntent: 'transfer',
      botSessionId: 'session-1',
      school: schoolId,
      save: vi.fn().mockResolvedValue(true),
      toJSON: function() { return { ...this, id: this._id }; },
    };

    it('marca paying con payingBy=customer y notifica al cliente', async () => {
      const mockQuote = { ...baseQuote, save: vi.fn().mockResolvedValue(true) };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockResolvedValue(mockQuote);

      const result = await quotesService.markBotOrderPaying(schoolId, 'PED-1234');

      expect(result.status).toBe('paying');
      expect(mockQuote.payingBy).toBe('customer');
      expect(mockQuote.save).toHaveBeenCalled();
    });

    it('es idempotente: si ya está paying, no vuelve a notificar', async () => {
      const mockQuote = { ...baseQuote, status: 'paying', payingBy: 'customer', save: vi.fn() };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockResolvedValue(mockQuote);

      const result = await quotesService.markBotOrderPaying(schoolId, 'PED-1234');

      expect(result.status).toBe('paying');
      expect(mockQuote.save).not.toHaveBeenCalled();
    });

    it('rechaza pedido que no es de transferencia', async () => {
      const mockQuote = { ...baseQuote, paymentIntent: 'cash' };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockResolvedValue(mockQuote);

      await expect(quotesService.markBotOrderPaying(schoolId, 'PED-1234')).rejects.toThrow(ValidationError);
    });

    it('rechaza pedido sin confirmar por el negocio', async () => {
      const mockQuote = { ...baseQuote, status: 'active' };
      // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
      vi.mocked(QuoteModel.findOne).mockResolvedValue(mockQuote);

      await expect(quotesService.markBotOrderPaying(schoolId, 'PED-1234')).rejects.toThrow(ValidationError);
    });
  });
});