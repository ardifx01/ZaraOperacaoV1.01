const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Rate limiting específico para autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas de login por IP
  message: {
    error: 'Muitas tentativas de login',
    message: 'Tente novamente em 15 minutos',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting para upload de arquivos
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 uploads por minuto
  message: {
    error: 'Muitos uploads',
    message: 'Aguarde um momento antes de fazer outro upload',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware para validar headers de segurança
const validateSecurityHeaders = (req, res, next) => {
  // Verificar User-Agent suspeito
  const userAgent = req.get('User-Agent');
  if (!userAgent || userAgent.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'User-Agent inválido'
    });
  }

  // Verificar Content-Type para requisições POST/PUT
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
      return res.status(400).json({
        success: false,
        message: 'Content-Type inválido'
      });
    }
  }

  next();
};

// Middleware para sanitizar entrada de dados
const sanitizeInput = (req, res, next) => {
  // Remover caracteres perigosos de strings
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript:
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  };

  // Sanitizar recursivamente objetos
  const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  // Aplicar sanitização
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);

  next();
};

// Middleware para detectar tentativas de SQL injection
const detectSQLInjection = (req, res, next) => {
  const sqlPatterns = [
    /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
    /(union|select|insert|delete|update|drop|create|alter|exec|execute)/i,
    /(script|javascript|vbscript|onload|onerror|onclick)/i
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(checkValue);
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  const suspicious = [
    ...Object.values(req.query || {}),
    ...Object.values(req.body || {}),
    ...Object.values(req.params || {})
  ].some(checkValue);

  if (suspicious) {
    console.warn(`🚨 Possível SQL Injection detectado:`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query
    });

    return res.status(400).json({
      success: false,
      message: 'Requisição inválida detectada'
    });
  }

  next();
};

// Middleware para log de segurança
const securityLogger = (req, res, next) => {
  // Log apenas em produção ou quando explicitamente habilitado
  if (process.env.NODE_ENV === 'production' || process.env.SECURITY_LOGGING === 'true') {
    const securityInfo = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      origin: req.get('Origin')
    };

    // Log requisições suspeitas
    const suspiciousPatterns = [
      /\.\.\//,  // Path traversal
      /\beval\b/i,  // eval()
      /\bexec\b/i,  // exec()
      /\bsystem\b/i,  // system()
      /\bpasswd\b/i,  // passwd file
      /\betc\/passwd/i,  // /etc/passwd
      /\bproc\/self/i   // /proc/self
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(req.originalUrl) || 
      pattern.test(JSON.stringify(req.body || {})) ||
      pattern.test(JSON.stringify(req.query || {}))
    );

    if (isSuspicious) {
      console.warn('🚨 Requisição suspeita detectada:', securityInfo);
    }
  }

  next();
};

// Middleware para adicionar headers de segurança customizados
const addSecurityHeaders = (req, res, next) => {
  // Headers de segurança adicionais
  res.setHeader('X-Powered-By', 'ZARA-System'); // Mascarar tecnologia
  res.setHeader('X-Request-ID', req.id || Math.random().toString(36).substr(2, 9));
  
  // Política de referrer mais restritiva
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Prevenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Controle de cache para dados sensíveis
  if (req.originalUrl.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
};

module.exports = {
  authLimiter,
  uploadLimiter,
  validateSecurityHeaders,
  sanitizeInput,
  detectSQLInjection,
  securityLogger,
  addSecurityHeaders
};