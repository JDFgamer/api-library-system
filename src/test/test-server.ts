import express from 'express';
import type { Request, Response, NextFunction } from 'express';

const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

type TestRequest = Request & {
  user?: { sub?: string; role?: string };
  schoolId?: string;
  posId?: string;
};

type SaleItemLike = { product?: string; productId?: string; quantity: number };

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple CORS headers manually
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// MIDDLEWARE DEFINITIONS (single declarations)
// ============================================

const authMiddleware = (req: TestRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'AUTHENTICATION_ERROR', message: 'Token de autorización requerido' });
  }
  
  const token = authHeader.slice(7);
  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, TEST_JWT_SECRET);
    req.user = payload;
    req.schoolId = payload.schoolId;
    req.posId = payload.posId;
    next();
  } catch {
    return res.status(401).json({ error: 'AUTHENTICATION_ERROR', message: 'Token inválido o expirado' });
  }
};

const requireAdmin = (req: TestRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  next();
};

const requireAdminOrSeller = (req: TestRequest, res: Response, next: NextFunction) => {
  if (!req.user || !['admin', 'seller'].includes(req.user.role)) {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  next();
};

const validateProduct = (req: TestRequest, res: Response, next: NextFunction) => {
  const { name, type, price, cost, stock } = req.body;
  
  if (!name || !type || price === undefined || stock === undefined) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Datos de entrada inválidos' });
  }
  
  if (!['product', 'service'].includes(type)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Tipo de producto inválido' });
  }
  
  if (price < 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'El precio no puede ser negativo' });
  }
  
  if (cost < 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'El costo no puede ser negativo' });
  }
  
  if (stock < 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'El stock no puede ser negativo' });
  }
  
  next();
};

const validateStock = (req: TestRequest, res: Response, next: NextFunction) => {
  const { quantity, operation } = req.body;
  
  if (quantity === undefined || !['add', 'set'].includes(operation)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Datos de entrada inválidos' });
  }
  
  if (quantity < 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'La cantidad no puede ser negativa' });
  }
  
  next();
};

const validateId = (req: TestRequest, res: Response, next: NextFunction) => {
  const id = String(req.params.id ?? '');
  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID inválido' });
  }
  next();
};

const validateSalePreview = (req: TestRequest, res: Response, next: NextFunction) => {
  const { items, paymentMethod, amountReceived, clientId, discount } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Items requeridos' });
  }
  
  for (const item of items) {
    if (!item.product || item.quantity === undefined || item.quantity <= 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Items inválidos' });
    }
  }
  
  if (!['cash', 'transfer', 'credit'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Método de pago inválido' });
  }
  
  const subtotal = items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0);
  const total = subtotal - (discount || 0);
  
  if ((paymentMethod === 'cash' || paymentMethod === 'transfer') && (amountReceived === undefined || amountReceived < 0)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Monto recibido requerido para pago en efectivo/transferencia' });
  }
  
  if ((paymentMethod === 'cash' || paymentMethod === 'transfer') && amountReceived !== undefined && amountReceived < total) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Monto recibido insuficiente' });
  }
  
  if (paymentMethod === 'credit' && !clientId) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Cliente requerido para venta a crédito' });
  }
  
  if (discount !== undefined && discount < 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Descuento no puede ser negativo' });
  }
  
  next();
};

const validateSale = (req: TestRequest, res: Response, next: NextFunction) => {
  const { items, paymentMethod, amountReceived, clientId, discount } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Items requeridos' });
  }
  
  for (const item of items) {
    if (!item.product || item.quantity === undefined || item.quantity <= 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Items inválidos' });
    }
  }
  
  if (!['cash', 'transfer', 'credit'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Método de pago inválido' });
  }
  
  const subtotal = items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0);
  const total = subtotal - (discount || 0);
  
  if ((paymentMethod === 'cash' || paymentMethod === 'transfer') && (amountReceived === undefined || amountReceived < 0)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Monto recibido requerido para pago en efectivo/transferencia' });
  }
  
  if ((paymentMethod === 'cash' || paymentMethod === 'transfer') && amountReceived !== undefined && amountReceived < total) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Monto recibido insuficiente' });
  }
  
  if (paymentMethod === 'credit' && !clientId) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Cliente requerido para venta a crédito' });
  }
  
  if (discount !== undefined && discount < 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Descuento no puede ser negativo' });
  }
  
  next();
};

const validateVoidReq = (req: TestRequest, res: Response, next: NextFunction) => {
  const { reason } = req.body;
  if (!reason || reason.trim() === '') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Motivo requerido' });
  }
  next();
};

const validateReturnReq = (req: TestRequest, res: Response, next: NextFunction) => {
  const { reason, items, method } = req.body;
  
  if (!reason || reason.trim() === '') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Motivo requerido' });
  }
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Items requeridos para devolución' });
  }
  
  if (!['cash', 'credit'].includes(method)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Método de devolución inválido' });
  }
  
  next();
};

// ============================================
// ROUTES
// ============================================

// Auth routes
app.use('/auth', (req, res) => {
  if (req.method === 'POST' && req.path === '/login') {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Datos de entrada inválidos' });
    }
    return res.status(401).json({ error: 'AUTHENTICATION_ERROR', message: 'Credenciales inválidas' });
  }
  
  if (req.method === 'POST' && req.path === '/register') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Datos de entrada inválidos' });
  }
  
  if (req.method === 'POST' && req.path === '/refresh') {
    return res.status(401).json({ error: 'AUTHENTICATION_ERROR', message: 'Token de autorización requerido' });
  }
  
  if (req.method === 'GET' && req.path === '/me') {
    return res.status(401).json({ error: 'AUTHENTICATION_ERROR', message: 'Token de autorización requerido' });
  }
  
  return res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint no encontrado' });
});

// Products routes
app.use('/products', authMiddleware);

app.post('/products', requireAdmin, validateProduct, (req, res) => {
  res.status(201).json({ 
    id: 'new-product-id',
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

app.get('/products', (req, res) => {
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    totalPages: 0,
  });
});

app.get('/products/:id', validateId, (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Producto no encontrado' });
});

app.patch('/products/:id', requireAdmin, validateId, validateProduct, (req, res) => {
  res.json({ 
    id: req.params.id,
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
});

app.delete('/products/:id', requireAdmin, validateId, (req, res) => {
  res.status(204).send();
});

app.patch('/products/:id/stock', authMiddleware, requireAdminOrSeller, validateId, validateStock, (req, res) => {
  res.json({
    id: req.params.id,
    stock: req.body.operation === 'add' ? 10 : req.body.quantity,
  });
});

// Schools routes
app.get('/schools/public', (req, res) => {
  res.json({
    items: [
      { id: 'school-1', name: 'Escuela Principal', code: 'EP1', slug: 'libreria', active: true },
      { id: 'school-2', name: 'Escuela Secundaria', code: 'ES2', slug: 'libreria-2', active: true },
    ],
  });
});

app.get('/schools/public/:slug', (req, res) => {
  const slug = req.params.slug;
  
  // Validate slug format (same as slugParamSchema: /^[a-z0-9-]+$/)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Slug inválido' });
  }
  
  const schools: Record<string, { id: string; name: string; slug: string }> = {
    'libreria': { id: 'school-1', name: 'Escuela Principal', slug: 'libreria' },
    'libreria-2': { id: 'school-2', name: 'Escuela Secundaria', slug: 'libreria-2' },
  };
  
  const school = schools[slug];
  if (school) {
    res.json(school);
  } else {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Negocio no encontrado' });
  }
});

// Protected schools routes
app.use('/schools', authMiddleware);

app.get('/schools', (req, res) => {
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    totalPages: 0,
  });
});

app.get('/schools/:id', validateId, (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Escuela no encontrada' });
});

app.post('/schools', requireAdmin, (req, res) => {
  const { name, code, slug } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nombre y código requeridos' });
  }
  if (slug === 'libreria' || slug === 'libreria-2') {
    return res.status(409).json({ error: 'CONFLICT_ERROR', message: 'Ya existe una escuela con ese slug' });
  }
  res.status(201).json({ 
    id: 'new-school-id',
    name,
    code: code.toUpperCase(),
    slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

app.patch('/schools/:id', requireAdmin, validateId, (req, res) => {
  const { slug } = req.body;
  if (slug === 'libreria' || slug === 'libreria-2') {
    return res.status(409).json({ error: 'CONFLICT_ERROR', message: 'Ya existe una escuela con ese slug' });
  }
  res.json({ 
    id: req.params.id,
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
});

app.delete('/schools/:id', requireAdmin, validateId, (req, res) => {
  res.status(204).send();
});

// Sales routes
app.use('/sales', authMiddleware);

app.post('/sales/preview', validateSalePreview, (req, res) => {
  res.json({
    items: req.body.items.map((item: SaleItemLike) => ({
      product: item.product,
      name: 'Test Product',
      type: 'product',
      quantity: item.quantity,
      unitPrice: 1000,
      subtotal: item.quantity * 1000,
    })),
    subtotal: req.body.items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0),
    discount: req.body.discount || 0,
    total: req.body.items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0) - (req.body.discount || 0),
    amountReceived: req.body.amountReceived,
    change: req.body.amountReceived ? req.body.amountReceived - (req.body.items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0) - (req.body.discount || 0)) : 0,
    paymentMethod: req.body.paymentMethod,
    creditBalanceAfter: req.body.paymentMethod === 'credit' ? 5000 : undefined,
  });
});

app.post('/sales', authMiddleware, requireAdminOrSeller, validateSale, (req, res) => {
  res.status(201).json({
    id: 'new-sale-id',
    number: 1,
    items: req.body.items.map((item: SaleItemLike) => ({
      product: item.product,
      name: 'Test Product',
      type: 'product',
      quantity: item.quantity,
      unitPrice: 1000,
      subtotal: item.quantity * 1000,
    })),
    subtotal: req.body.items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0),
    discount: req.body.discount || 0,
    total: req.body.items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0) - (req.body.discount || 0),
    amountReceived: req.body.amountReceived || 0,
    change: req.body.amountReceived ? req.body.amountReceived - (req.body.items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0) - (req.body.discount || 0)) : 0,
    paymentMethod: req.body.paymentMethod,
    type: 'sale',
    client: req.body.clientId,
    seller: req.user?.sub,
    cashShift: 'active-shift-id',
    school: req.schoolId,
    settled: req.body.paymentMethod !== 'credit',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

app.get('/sales', (req, res) => {
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    totalPages: 0,
  });
});

app.get('/sales/summary', (req, res) => {
  res.json({
    salesToday: 0,
    salesGrowth: 0,
    totalRevenue: 0,
    returnsCount: 0,
    returnsAmount: 0,
    averageTicket: 0,
  });
});

app.get('/sales/:id', authMiddleware, validateId, (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Venta no encontrada' });
});

app.post('/sales/:id/void', validateId, validateVoidReq, (req, res) => {
  res.json({
    id: req.params.id,
    voided: true,
    voidedAt: new Date().toISOString(),
    voidReason: req.body.reason,
  });
});

app.post('/sales/:id/return', validateId, validateReturnReq, (req, res) => {
  res.status(201).json({
    id: 'return-sale-id',
    number: 2,
    items: req.body.items.map((item: SaleItemLike) => ({
      product: item.productId,
      name: 'Test Product',
      type: 'product',
      quantity: item.quantity,
      unitPrice: 1000,
      subtotal: item.quantity * 1000,
    })),
    subtotal: req.body.items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0),
    discount: 0,
    total: req.body.items.reduce((sum: number, item: SaleItemLike) => sum + (item.quantity * 1000), 0),
    amountReceived: 0,
    change: 0,
    paymentMethod: req.body.method,
    type: 'return',
    client: 'client-id',
    seller: req.user?.sub,
    cashShift: 'active-shift-id',
    school: req.schoolId,
    originalSale: req.params.id,
    settled: req.body.method !== 'credit',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

// Clients routes
const validateClient = (req: TestRequest, res: Response, next: NextFunction) => {
  const { fullName, dni, phone } = req.body;
  
  if (!fullName || !dni) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nombre y DNI requeridos' });
  }
  
  if (!/^\d{7,8}$/.test(dni)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'DNI inválido (7-8 dígitos)' });
  }
  
  if (phone && !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Teléfono inválido (10 dígitos)' });
  }
  
  next();
};

app.use('/clients', authMiddleware);

app.post('/clients', requireAdmin, validateClient, (req, res) => {
  res.status(201).json({
    id: 'new-client-id',
    ...req.body,
    isDefault: false,
    balance: 0,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

app.get('/clients', authMiddleware, (req, res) => {
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    totalPages: 0,
  });
});

app.get('/clients/search', (req, res) => {
  const q = req.query.q;
  const query = Array.isArray(q) ? q[0] : q;
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.json({ items: [] });
  }
  res.json({
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
});

app.get('/clients/:id', validateId, (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Cliente no encontrado' });
});

app.patch('/clients/:id', requireAdmin, validateId, validateClient, (req, res) => {
  res.json({
    id: req.params.id,
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
});

app.delete('/clients/:id', requireAdmin, validateId, (req, res) => {
  res.status(204).send();
});

// Users routes
const validateUser = (req: TestRequest, res: Response, next: NextFunction) => {
  const { name, email, password, role } = req.body;
  
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Nombre, email, contraseña y rol requeridos' });
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email inválido' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'La contraseña debe tener al menos 6 caracteres' });
  }
  
  if (!['admin', 'seller'].includes(role)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Rol inválido (admin/seller)' });
  }
  
  next();
};

const validatePasswordChange = (req: TestRequest, res: Response, next: NextFunction) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Contraseña actual y nueva requeridas' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  next();
};

app.use('/users', authMiddleware);

app.post('/users', requireAdmin, validateUser, (req, res) => {
  res.status(201).json({
    id: 'new-user-id',
    ...req.body,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});

app.get('/users', authMiddleware, requireAdmin, (req, res) => {
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    totalPages: 0,
  });
});

app.get('/users/:id', authMiddleware, requireAdmin, validateId, (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Usuario no encontrado' });
});

app.patch('/users/:id', requireAdmin, validateId, (req, res) => {
  res.json({
    id: req.params.id,
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
});

app.delete('/users/:id', requireAdmin, validateId, (req, res) => {
  res.status(204).send();
});

app.post('/users/:id/change-password', requireAdmin, validateId, validatePasswordChange, (req, res) => {
  res.json({
    id: req.params.id,
    message: 'Contraseña actualizada correctamente',
  });
});

// CashShifts routes
const validateCashShiftOpen = (req: TestRequest, res: Response, next: NextFunction) => {
  const { openingAmount } = req.body;
  if (openingAmount === undefined || openingAmount <= 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Monto de apertura requerido y mayor a 0' });
  }
  next();
};

const validateCashShiftClose = (req: TestRequest, res: Response, next: NextFunction) => {
  const { closingAmount } = req.body;
  if (closingAmount === undefined || closingAmount < 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Monto de cierre requerido y no negativo' });
  }
  next();
};

const validateCashMovement = (req: TestRequest, res: Response, next: NextFunction) => {
  const { type, category, amount, description } = req.body;
  if (!type || !['in', 'out'].includes(type)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Tipo requerido (in/out)' });
  }
  if (!category || category.trim() === '') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Categoría requerida' });
  }
  if (amount === undefined || amount <= 0) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Monto requerido y mayor a 0' });
  }
  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Descripción requerida' });
  }
  next();
};

app.use('/cash-shifts', authMiddleware);

app.post('/cash-shifts', requireAdminOrSeller, validateCashShiftOpen, (req, res) => {
  res.status(201).json({
    id: 'new-cash-shift-id',
    seller: req.user?.sub,
    school: req.schoolId,
    openingAmount: req.body.openingAmount,
    status: 'open',
    openedAt: new Date().toISOString(),
  });
});

app.get('/cash-shifts/active', authMiddleware, (req, res) => {
  res.json({
    cashShift: {
      id: 'active-shift-id',
      seller: req.user?.sub,
      school: req.schoolId,
      openingAmount: 10000,
      status: 'open',
      openedAt: new Date().toISOString(),
    },
    aggregated: {
      cashTotal: 0,
      transferTotal: 0,
      creditTotal: 0,
      salesCount: 0,
      productsSold: 0,
      avgTicket: 0,
      expectedCash: 10000,
      cashInTotal: 0,
      cashOutTotal: 0,
      netMovements: 0,
      movementsCount: 0,
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      grossMarginPercent: 0,
    },
  });
});

app.post('/cash-shifts/:id/close', authMiddleware, validateId, validateCashShiftClose, (req, res) => {
  res.json({
    id: req.params.id,
    closingAmount: req.body.closingAmount,
    expectedAmount: 15000,
    difference: req.body.closingAmount - 15000,
    status: 'closed',
    closedAt: new Date().toISOString(),
    note: req.body.note,
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMarginPercent: 0,
  });
});

app.get('/cash-shifts', (req, res) => {
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    totalPages: 0,
  });
});

app.get('/cash-shifts/daily-summary', (req, res) => {
  res.json({
    date: req.query.date || new Date().toISOString().split('T')[0],
    totalOpening: 10000,
    cashSales: 5000,
    transferSales: 3000,
    returns: 0,
    creditPayments: 2000,
    cashInTotal: 500,
    cashOutTotal: 200,
    netMovements: 300,
    totalExpected: 15000,
    finalCount: 15300,
    difference: 300,
    shiftsWithDifference: 0,
    totalShifts: 1,
    pendingShifts: [],
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    grossMarginPercent: 0,
  });
});

app.get('/cash-shifts/:id/detail', validateId, (req, res) => {
  res.json({
    shift: {
      id: req.params.id,
      shiftNumber: 1,
      sellerName: 'Vendedor Test',
      status: 'closed',
      openedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      openingAmount: 10000,
      closingAmount: 15000,
      expectedAmount: 15000,
      difference: 0,
      note: undefined,
    },
    sales: {
      cashTotal: 5000,
      transferTotal: 3000,
      creditTotal: 0,
      salesCount: 2,
      returnsTotal: 0,
    },
    movements: {
      items: [],
      aggregated: {
        cashInTotal: 0,
        cashOutTotal: 0,
        netMovements: 0,
        movementsCount: 0,
        byCategory: {
          lunch: { in: 0, out: 0, count: 0 },
          supplies: { in: 0, out: 0, count: 0 },
          personal_withdrawal: { in: 0, out: 0, count: 0 },
          change: { in: 0, out: 0, count: 0 },
          expense: { in: 0, out: 0, count: 0 },
          other: { in: 0, out: 0, count: 0 },
        },
      },
    },
    profitability: {
      revenue: 5000,
      cogs: 1000,
      grossProfit: 4000,
      grossMarginPercent: 80,
    },
  });
});

app.get('/cash-shifts/:id', validateId, (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Turno no encontrado' });
});

app.post('/cash-shifts/:id/movements', validateId, validateCashMovement, (req, res) => {
  res.status(201).json({
    id: 'new-movement-id',
    cashShift: req.params.id,
    type: req.body.type,
    category: req.body.category,
    amount: req.body.amount,
    description: req.body.description,
    createdAt: new Date().toISOString(),
  });
});

app.get('/cash-shifts/:id/movements', validateId, (req, res) => {
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    totalPages: 0,
  });
});

// Admins routes (require superadmin)
app.use('/admins', authMiddleware);
app.get('/admins', (req, res) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    totalPages: 0,
  });
});
app.post('/admins', (req, res) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  const { name, email, password, pin, role, schoolCode } = req.body;
  if (!name || !email || !password || !role || !schoolCode) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Datos de entrada inválidos' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email inválido' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'La contraseña debe tener al menos 6 caracteres' });
  }
  if (pin && pin.length < 4) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'El PIN debe tener al menos 4 dígitos' });
  }
  if (!['admin', 'seller'].includes(role)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Rol inválido (admin/seller)' });
  }
  if (!/^[A-Z]{2}\d{3}$/.test(schoolCode)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Código de escuela inválido (formato: XX000)' });
  }
  res.status(201).json({
    id: 'new-admin-id',
    name,
    email,
    role,
    schoolCode,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});
app.put('/admins/:id', (req, res) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID inválido' });
  }
  res.json({
    id: req.params.id,
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
});
app.delete('/admins/:id', (req, res) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID inválido' });
  }
  // Simulate non-existent admin in mock (no database)
  res.status(404).json({ error: 'NOT_FOUND', message: 'Admin no encontrado' });
});

// POS routes (require admin)
app.use('/pos', authMiddleware);
app.get('/pos', (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  res.json({
    items: [],
    total: 0,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    totalPages: 0,
  });
});
app.post('/pos', (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  const { name, code } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Datos de entrada inválidos' });
  }
  if (!/^[A-Z]{2}\d{3}$/.test(code)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Código inválido (formato: XX000)' });
  }
  res.status(201).json({
    id: 'new-pos-id',
    name,
    code,
    school: req.schoolId,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
});
app.put('/pos/:id', (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID inválido' });
  }
  res.json({
    id: req.params.id,
    ...req.body,
    updatedAt: new Date().toISOString(),
  });
});
app.delete('/pos/:id', (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'AUTHORIZATION_ERROR', message: 'Rol insuficiente para esta acción' });
  }
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'ID inválido' });
  }
  res.status(204).send();
});

app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint no encontrado' });
});

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error.name === 'ZodError') {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Datos de entrada inválidos' });
  }
  console.error('Unhandled error', { error: error.message, stack: error.stack });
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor' });
});

// Reutilizamos un único server por proceso para que supertest no cree/destruya
// un server por request (eso causaba flakiness intermitente).
const testServer = app.listen(0);
export default testServer;
