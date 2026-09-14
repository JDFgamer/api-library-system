import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaleModel } from '../../../../models/Sale/index.js';
import { ProductModel } from '../../../../models/Product/index.js';
import { ClientModel } from '../../../../models/Client/index.js';
import { CashShiftModel } from '../../../../models/CashShift/index.js';
import { CashMovementModel } from '../../../../models/CashMovement/index.js';
import { CreditMovementModel } from '../../../../models/CreditMovement/index.js';
import * as salesService from '../../../../Services/Sales/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../../../../utils/errors.js';

type MockDoc = { _id?: unknown; [key: string]: unknown };

const leanMock = vi.hoisted(() => {
  const withId = vi.fn((x: MockDoc) => ({ ...x, id: x._id?.toString() ?? 'mock-id' }));
  const withIds = vi.fn((arr: MockDoc[]) => arr.map((x: MockDoc) => ({ ...x, id: x._id?.toString() ?? 'mock-id' })));
  return { withId, withIds };
});

vi.mock('../../../../models/Sale/index.js');
vi.mock('../../../../models/Product/index.js');
vi.mock('../../../../models/Client/index.js');
vi.mock('../../../../models/CreditMovement/index.js');
vi.mock('../../../../models/CashMovement/index.js');
vi.mock('../../../../utils/lean.js', () => leanMock);

const cashShiftFindOneMock = vi.hoisted(() => vi.fn().mockReturnValue({
  lean: vi.fn().mockResolvedValue({ 
    status: 'open', 
    _id: 'shift-1', 
    school: 'school-1', 
    openingAmount: 10000 
  }),
}));

vi.mock('../../../../models/CashShift/index.js', () => ({
  CashShiftModel: {
    findOne: cashShiftFindOneMock,
  },
}));

describe('Sales Service - createReturn', () => {
  const schoolId = 'school-1';
  const sellerId = 'seller-1';
  const cashShiftId = 'shift-1';
  const productId = 'product-1';
  const clientId = 'client-1';

  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults para el guard de caja de createReturn
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(SaleModel.find).mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(CashMovementModel.find).mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
  });

  it('should create return with cash method and restore stock', async () => {
    const mockProduct = {
      _id: productId,
      name: 'Test Product',
      type: 'product',
      price: 1000,
      cost: 500,
      stock: 5,
      save: vi.fn().mockResolvedValue(true),
    };
    const mockClient = { _id: clientId, fullName: 'Test Client', balance: 0, school: schoolId };
    const mockShift = { _id: cashShiftId, status: 'open', school: schoolId, openingAmount: 10000 };

    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([mockProduct]),
    });
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ClientModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockClient),
    });
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.findOne).mockReturnValue({
      session: vi.fn().mockResolvedValue(mockProduct),
    });
    
    // Mock SaleModel.db for transaction
    const mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn(),
    };
    // @ts-expect-error - mocking mongoose connection
    SaleModel.db = {
      startSession: vi.fn().mockResolvedValue(mockSession),
    };
    
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(SaleModel.findOne).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      }),
    });
    // @ts-expect-error - test mock uses string IDs instead of ObjectId
    vi.mocked(SaleModel.create).mockResolvedValue([{
      _id: 'return-1',
      number: 1,
      subtotal: 1000,
      discount: 0,
      total: 1000,
      amountReceived: 0,
      change: 0,
      paymentMethod: 'cash',
      type: 'return',
      client: clientId,
      seller: sellerId,
      cashShift: cashShiftId,
      school: schoolId,
      settled: true,
      items: [{ product: productId, name: 'Test Product', type: 'product', quantity: 1, unitPrice: 1000, unitCost: 500, subtotal: 1000 }],
      createdAt: new Date(),
      // @ts-expect-error - test mock toJSON doesn't match Mongoose Document exactly
      toJSON: function() { return this; },
    }]);
    vi.mocked(CreditMovementModel.create).mockResolvedValue([]);

    const result = await salesService.createReturn({
      schoolId,
      sellerId,
      cashShiftId,
      items: [{ product: productId, quantity: 1 }],
      clientId,
      method: 'cash',
    });

    expect(result.sale.type).toBe('return');
    expect(result.sale.paymentMethod).toBe('cash');
    expect(result.sale.total).toBe(1000);
    expect(mockProduct.stock).toBe(6); // Stock restored
    expect(mockProduct.save).toHaveBeenCalled();
  });

  it('should create return with credit method and reduce client balance', async () => {
    const mockProduct = {
      _id: productId,
      name: 'Test Product',
      type: 'product',
      price: 1000,
      cost: 500,
      stock: 5,
      save: vi.fn().mockResolvedValue(true),
    };
    const mockClient = { _id: clientId, fullName: 'Test Client', balance: 5000, school: schoolId, save: vi.fn().mockResolvedValue(true) };
    const mockShift = { _id: cashShiftId, status: 'open', school: schoolId, openingAmount: 10000 };

    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([mockProduct]),
    });
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ClientModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockClient),
      session: vi.fn().mockResolvedValue(mockClient),
    });
    
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.findOne).mockReturnValue({
      session: vi.fn().mockResolvedValue(mockProduct),
    });
    
    // Mock SaleModel.db for transaction
    const mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn(),
    };
    // @ts-expect-error - mocking mongoose connection
    SaleModel.db = {
      startSession: vi.fn().mockResolvedValue(mockSession),
    };
    
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(SaleModel.findOne).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      }),
    });
    // @ts-expect-error - test mock uses string IDs instead of ObjectId
    vi.mocked(SaleModel.create).mockResolvedValue([{
      _id: 'return-2',
      number: 2,
      subtotal: 1000,
      discount: 0,
      total: 1000,
      amountReceived: 0,
      change: 0,
      paymentMethod: 'credit',
      type: 'return',
      client: clientId,
      seller: sellerId,
      cashShift: cashShiftId,
      school: schoolId,
      settled: false,
      items: [{ product: productId, name: 'Test Product', type: 'product', quantity: 1, unitPrice: 1000, unitCost: 500, subtotal: 1000 }],
      createdAt: new Date(),
      // @ts-expect-error - test mock toJSON doesn't match Mongoose Document exactly
      toJSON: function() { return this; },
    }]);
    // @ts-expect-error - test mock uses string IDs instead of ObjectId
    vi.mocked(CreditMovementModel.create).mockResolvedValue([{
      _id: 'cm-1',
      type: 'payment',
      amount: 1000,
      balanceAfter: 4000,
      method: 'credit',
      // @ts-expect-error - test mock toJSON doesn't match Mongoose Document exactly
      toJSON: function() { return this; },
    }]);

    const result = await salesService.createReturn({
      schoolId,
      sellerId,
      cashShiftId,
      items: [{ product: productId, quantity: 1 }],
      clientId,
      method: 'credit',
    });

    expect(result.sale.type).toBe('return');
    expect(result.sale.paymentMethod).toBe('credit');
    expect(result.sale.settled).toBe(false);
    expect(mockClient.balance).toBe(4000); // Balance reduced
    expect(result.creditMovement).toBeDefined();
  });

  it('should create return with transfer method', async () => {
    const mockProduct = {
      _id: productId,
      name: 'Test Product',
      type: 'product',
      price: 1000,
      cost: 500,
      stock: 5,
      save: vi.fn().mockResolvedValue(true),
    };
    const mockClient = { _id: clientId, fullName: 'Test Client', balance: 0 };
    const mockShift = { _id: cashShiftId, status: 'open', school: schoolId, openingAmount: 10000 };

    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([mockProduct]),
    });
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ClientModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockClient),
    });
    
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.findOne).mockReturnValue({
      session: vi.fn().mockResolvedValue(mockProduct),
    });
    
    // Mock SaleModel.db for transaction
    const mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn(),
    };
    // @ts-expect-error - mocking mongoose connection
    SaleModel.db = {
      startSession: vi.fn().mockResolvedValue(mockSession),
    };
    
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(SaleModel.findOne).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      }),
    });
    // @ts-expect-error - test mock uses string IDs instead of ObjectId
    vi.mocked(SaleModel.create).mockResolvedValue([{
      _id: 'return-3',
      number: 3,
      subtotal: 1000,
      discount: 0,
      total: 1000,
      amountReceived: 0,
      change: 0,
      paymentMethod: 'transfer',
      type: 'return',
      client: clientId,
      seller: sellerId,
      cashShift: cashShiftId,
      school: schoolId,
      settled: true,
      items: [{ product: productId, name: 'Test Product', type: 'product', quantity: 1, unitPrice: 1000, unitCost: 500, subtotal: 1000 }],
      createdAt: new Date(),
      // @ts-expect-error - test mock toJSON doesn't match Mongoose Document exactly
      toJSON: function() { return this; },
    }]);
    vi.mocked(CreditMovementModel.create).mockResolvedValue([]);

    const result = await salesService.createReturn({
      schoolId,
      sellerId,
      cashShiftId,
      items: [{ product: productId, quantity: 1 }],
      clientId,
      method: 'transfer',
    });

    expect(result.sale.paymentMethod).toBe('transfer');
    expect(result.sale.settled).toBe(true);
  });

  it('should throw ValidationError for credit return without client', async () => {
    const mockProduct = { _id: productId, name: 'Test Product', type: 'product', price: 1000, active: true };
    const mockShift = { _id: cashShiftId, status: 'open', school: schoolId };

    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([mockProduct]),
    });
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ClientModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
      session: vi.fn().mockResolvedValue(null),
    });

    await expect(salesService.createReturn({
      schoolId,
      sellerId,
      cashShiftId,
      items: [{ product: productId, quantity: 1 }],
      method: 'credit',
    })).rejects.toThrow(ValidationError);
  });

  it('should throw NotFoundError for non-existent product', async () => {
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([]),
    });

    await expect(salesService.createReturn({
      schoolId,
      sellerId,
      cashShiftId,
      items: [{ product: 'non-existent', quantity: 1 }],
      method: 'cash',
    })).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError for closed cash shift', async () => {
    const mockProduct = { _id: productId, name: 'Test Product', type: 'product', price: 1000, active: true };
    const mockShift = { _id: cashShiftId, status: 'closed', school: schoolId };

    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([mockProduct]),
    });
    // Override the module-level mock for this test
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(CashShiftModel.findOne).mockImplementation(() => ({
      lean: vi.fn().mockResolvedValue(mockShift),
    }));

    await expect(salesService.createReturn({
      schoolId,
      sellerId,
      cashShiftId,
      items: [{ product: productId, quantity: 1 }],
      method: 'cash',
    })).rejects.toThrow(ConflictError);
  });

  it('should not require product.active for returns', async () => {
    const mockProduct = {
      _id: productId,
      name: 'Test Product',
      type: 'product',
      price: 1000,
      cost: 500,
      active: false, // Inactive product
      stock: 5,
      save: vi.fn().mockResolvedValue(true),
    };
    const mockClient = { _id: clientId, fullName: 'Test Client', balance: 0 };
    const mockShift = { _id: cashShiftId, status: 'open', school: schoolId, openingAmount: 10000 };

    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([mockProduct]),
    });
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ClientModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockClient),
    });
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(ProductModel.findOne).mockReturnValue({
      session: vi.fn().mockResolvedValue(mockProduct),
    });
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(CashShiftModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockShift),
    });
    
    // Mock SaleModel.db for transaction
    const mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      abortTransaction: vi.fn(),
      endSession: vi.fn(),
    };
    // @ts-expect-error - mocking mongoose connection
    SaleModel.db = {
      startSession: vi.fn().mockResolvedValue(mockSession),
    };
    
    // @ts-expect-error - mock return type doesn't match Mongoose Query exactly
    vi.mocked(SaleModel.findOne).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      }),
    });
    // @ts-expect-error - test mock uses string IDs instead of ObjectId
    vi.mocked(SaleModel.create).mockResolvedValue([{
      _id: 'return-4',
      number: 4,
      subtotal: 1000,
      discount: 0,
      total: 1000,
      amountReceived: 0,
      change: 0,
      paymentMethod: 'cash',
      type: 'return',
      client: clientId,
      seller: sellerId,
      cashShift: cashShiftId,
      school: schoolId,
      settled: true,
      items: [{ product: productId, name: 'Test Product', type: 'product', quantity: 1, unitPrice: 1000, unitCost: 500, subtotal: 1000 }],
      createdAt: new Date(),
      // @ts-expect-error - test mock toJSON doesn't match Mongoose Document exactly
      toJSON: function() { return this; },
    }]);
    vi.mocked(CreditMovementModel.create).mockResolvedValue([]);

    const result = await salesService.createReturn({
      schoolId,
      sellerId,
      cashShiftId,
      items: [{ product: productId, quantity: 1 }],
      clientId,
      method: 'cash',
    });

    expect(result.sale.type).toBe('return');
  });
});