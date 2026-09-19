export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Credenciales inválidas') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'No autorizado para realizar esta acción') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404, 'NOT_FOUND_ERROR');
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly details?: Record<string, string[]>;

  constructor(message = 'Error de validación', details?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto: el recurso ya existe') {
    super(message, 409, 'CONFLICT_ERROR');
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class PaymentError extends AppError {
  constructor(message = 'Error en el procesamiento del pago') {
    super(message, 402, 'PAYMENT_ERROR');
    Object.setPrototypeOf(this, PaymentError.prototype);
  }
}

export class SchoolDisabledError extends AppError {
  constructor(message = 'Esta escuela está deshabilitada por el administrador') {
    super(message, 403, 'SCHOOL_DISABLED');
    Object.setPrototypeOf(this, SchoolDisabledError.prototype);
  }
}

export class PosDisabledError extends AppError {
  constructor(message = 'Este punto de venta está deshabilitado por el administrador') {
    super(message, 403, 'POS_DISABLED');
    Object.setPrototypeOf(this, PosDisabledError.prototype);
  }
}

export const errorCodes = {
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND_ERROR: 404,
  VALIDATION_ERROR: 400,
  CONFLICT_ERROR: 409,
  PAYMENT_ERROR: 402,
  SCHOOL_DISABLED: 403,
  POS_DISABLED: 403,
} as const;