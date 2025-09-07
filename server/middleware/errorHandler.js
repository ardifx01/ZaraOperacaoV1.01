const { captureException } = require('../config/sentry');

// Middleware de tratamento de erros
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log do erro
  console.error('❌ Erro capturado:', err);

  // Capturar no Sentry
  captureException(err, {
    url: req.url,
    method: req.method,
    user: req.user?.id,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Erro de validação do Mongoose
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message,
      code: 'VALIDATION_ERROR',
      statusCode: 400
    };
  }

  // Erro de cast do Mongoose (ID inválido)
  if (err.name === 'CastError') {
    error = {
      message: 'Recurso não encontrado',
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404
    };
  }

  // Erro de duplicação (código 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = {
      message: `${field} já existe`,
      code: 'DUPLICATE_FIELD',
      statusCode: 400,
      field
    };
  }

  // Erro do Prisma
  if (err.code && err.code.startsWith('P')) {
    switch (err.code) {
      case 'P2002':
        error = {
          message: 'Dados duplicados',
          code: 'DUPLICATE_DATA',
          statusCode: 400
        };
        break;
      case 'P2025':
        error = {
          message: 'Registro não encontrado',
          code: 'RECORD_NOT_FOUND',
          statusCode: 404
        };
        break;
      case 'P2003':
        error = {
          message: 'Violação de chave estrangeira',
          code: 'FOREIGN_KEY_VIOLATION',
          statusCode: 400
        };
        break;
      default:
        error = {
          message: 'Erro no banco de dados',
          code: 'DATABASE_ERROR',
          statusCode: 500
        };
    }
  }

  // Erro de JWT
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Token inválido',
      code: 'INVALID_TOKEN',
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expirado',
      code: 'TOKEN_EXPIRED',
      statusCode: 401
    };
  }

  // Erro de upload de arquivo
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'Arquivo muito grande',
      code: 'FILE_TOO_LARGE',
      statusCode: 413
    };
  }

  // Erro de rate limit
  if (err.status === 429) {
    error = {
      message: 'Muitas tentativas, tente novamente mais tarde',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429
    };
  }

  // Resposta de erro padronizada
  const response = {
    success: false,
    message: error.message || 'Erro interno do servidor',
    code: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: error
    })
  };

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json(response);
};

// Middleware para capturar erros assíncronos
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Classe para erros customizados
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError
};