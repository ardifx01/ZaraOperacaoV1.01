const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { generateToken, verifyToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { captureException } = require('../config/sentry');

const router = express.Router();
const prisma = new PrismaClient();

// @desc    Registrar novo usuário
// @route   POST /api/auth/register
// @access  Public (apenas para desenvolvimento/admin)
router.post('/register', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email válido é obrigatório'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('role')
    .optional()
    .isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'])
    .withMessage('Role inválido')
], asyncHandler(async (req, res) => {
  // Verificar erros de validação
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { email, password, name, role = 'OPERATOR' } = req.body;

  try {
    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new AppError('Usuário já existe com este email', 400, 'USER_EXISTS');
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role
      }
    });

    // Buscar usuário criado para retornar dados seguros
    const createdUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    // Gerar token
    const token = generateToken(createdUser.id);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: createdUser,
        token
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError('Email já está em uso', 400, 'EMAIL_IN_USE');
    }
    throw error;
  }
}));

// @desc    Login do usuário
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email válido é obrigatório'),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
], asyncHandler(async (req, res) => {
  // Verificar erros de validação
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  // Buscar usuário no banco
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AppError('Usuário inativo', 401, 'USER_INACTIVE');
  }

  // Verificar senha
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
  }

  // Gerar token
  const token = generateToken(user.id);

  // Log de acesso
  await prisma.systemLog.create({
    data: {
      action: 'LOGIN',
      userId: user.id,
      details: JSON.stringify({
        email: user.email,
        role: user.role
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Login realizado com sucesso',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      },
      token
    }
  });
}));

// @desc    Verificar token
// @route   GET /api/auth/verify
// @access  Public
router.get('/verify', asyncHandler(async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token não fornecido',
      code: 'NO_TOKEN'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }

  // Buscar usuário no banco de dados
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true
    }
  });

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não encontrado ou inativo',
      code: 'USER_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    message: 'Token válido',
    data: { user }
  });
}));

// @desc    Logout do usuário
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', asyncHandler(async (req, res) => {
  // O logout é principalmente gerenciado pelo frontend (limpeza do localStorage)
  // O servidor apenas confirma que recebeu a solicitação
  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
}));

// @desc    Alterar senha
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', [
  body('currentPassword')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
], asyncHandler(async (req, res) => {
  // Verificar token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    throw new AppError('Token não fornecido', 401, 'NO_TOKEN');
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    throw new AppError('Token inválido', 401, 'INVALID_TOKEN');
  }

  // Verificar erros de validação
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;

  // Buscar usuário
  const user = await prisma.user.findUnique({
    where: { id: decoded.id }
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  // Verificar senha atual
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new AppError('Senha atual incorreta', 400, 'INVALID_CURRENT_PASSWORD');
  }

  // Hash da nova senha
  const salt = await bcrypt.genSalt(12);
  const hashedNewPassword = await bcrypt.hash(newPassword, salt);

  // Atualizar senha
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedNewPassword }
  });

  // Log da alteração
  await prisma.systemLog.create({
    data: {
      action: 'PASSWORD_CHANGE',
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Senha alterada com sucesso'
  });
}));

module.exports = router;