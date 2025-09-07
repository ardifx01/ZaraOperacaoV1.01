const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { requireLeader, requireManager, authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');

const router = express.Router();
const prisma = new PrismaClient();

// @desc    Listar usuários
// @route   GET /api/users
// @access  Private (Leader+)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
  query('role').optional().isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']).withMessage('Role inválido'),
  query('active').optional().isBoolean().withMessage('Active deve ser boolean'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Busca deve ter pelo menos 1 caractere')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const {
    page = 1,
    limit = 20,
    role,
    active,
    search
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};

  // Filtros
  if (role) where.role = role;
  if (active !== undefined) where.isActive = active === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        badgeNumber: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            machineOperations: true,
            qualityTests: true,
            teflonChanges: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.user.count({ where })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1
    }
  });
}));

// @desc    Obter usuário por ID
// @route   GET /api/users/:id
// @access  Private (Leader+)
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: parseInt(id) },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      badgeNumber: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          machineOperations: true,
          qualityTests: true,
          teflonChanges: true,
          notifications: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    data: user
  });
}));

// @desc    Criar novo usuário
// @route   POST /api/users
// @access  Private (Manager+)
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('badgeNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Número do crachá deve ter entre 1 e 20 caracteres'),
  body('role')
    .isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'])
    .withMessage('Role inválido'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser boolean')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { name, email, password, badgeNumber, role, isActive = true } = req.body;

  // Verificar se email já existe
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new AppError('Email já está em uso', 400, 'EMAIL_ALREADY_EXISTS');
  }

  // Verificar se número do crachá já existe (se fornecido)
  if (badgeNumber) {
    const existingBadge = await prisma.user.findUnique({
      where: { badgeNumber }
    });

    if (existingBadge) {
      throw new AppError('Número do crachá já está em uso', 400, 'BADGE_NUMBER_ALREADY_EXISTS');
    }
  }

  // Verificar permissões para criar usuário com role específico
  if (req.user.role === 'MANAGER' && ['ADMIN'].includes(role)) {
    throw new AppError('Sem permissão para criar usuário com este role', 403, 'INSUFFICIENT_PERMISSIONS');
  }

  // Hash da senha
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      badgeNumber,
      role,
      isActive
    },
    select: {
      id: true,
      name: true,
      email: true,
      badgeNumber: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'USER_CREATED',
      userId: req.user.id,
      details: JSON.stringify({
        createdUserId: user.id,
        createdUserEmail: user.email,
        createdUserRole: user.role
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(201).json({
    success: true,
    message: 'Usuário criado com sucesso',
    data: user
  });
}));

// @desc    Atualizar perfil do usuário logado
// @route   PUT /api/users/profile
// @access  Private (Qualquer usuário autenticado)
router.put('/profile', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { name, email } = req.body;
  const userId = req.user.id;

  // Verificar se email já existe (se fornecido)
  if (email) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: userId }
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email já está em uso por outro usuário',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }
  }

  // Atualizar dados do usuário
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name && { name }),
      ...(email && { email })
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      isActive: true,
      createdAt: true
    }
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'PROFILE_UPDATED',
      userId: req.user.id,
      details: JSON.stringify({
        updatedFields: Object.keys(req.body)
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Perfil atualizado com sucesso',
    data: updatedUser
  });
}));

// @desc    Atualizar usuário
// @route   PUT /api/users/:id
// @access  Private (Manager+)
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('role')
    .optional()
    .isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'])
    .withMessage('Role inválido'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser boolean')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { name, email, phone, role, badgeNumber, isActive, password } = req.body;
  
  // Construir objeto de atualização apenas com campos válidos e não nulos
  const updateData = {};
  
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined && phone !== null) updateData.phone = phone;
  if (role !== undefined) updateData.role = role;
  if (badgeNumber !== undefined && badgeNumber !== null) updateData.badgeNumber = badgeNumber;
  if (isActive !== undefined) updateData.isActive = isActive;
  
  // Adicionar senha apenas se foi fornecida
  if (password) {
    updateData.password = password;
  }

  // Verificar se usuário existe
  const existingUser = await prisma.user.findUnique({
    where: { id: parseInt(id) }
  });

  if (!existingUser) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  // Verificar se não está tentando atualizar próprio usuário para inativo
  if (id === req.user.id && updateData.isActive === false) {
    throw new AppError('Não é possível desativar sua própria conta', 400, 'CANNOT_DEACTIVATE_SELF');
  }

  // Verificar permissões para alterar role
  if (updateData.role) {
    if (req.user.role === 'MANAGER' && ['ADMIN'].includes(updateData.role)) {
      throw new AppError('Sem permissão para alterar para este role', 403, 'INSUFFICIENT_PERMISSIONS');
    }
    if (req.user.role === 'MANAGER' && existingUser.role === 'ADMIN') {
      throw new AppError('Sem permissão para alterar usuário ADMIN', 403, 'INSUFFICIENT_PERMISSIONS');
    }
  }

  // Verificar se email já existe (se estiver sendo alterado)
  if (updateData.email && updateData.email !== existingUser.email) {
    const emailExists = await prisma.user.findUnique({
      where: { 
        email: updateData.email,
        NOT: {
          id: parseInt(id)
        }
      }
    });

    if (emailExists) {
      throw new AppError('Email já está em uso', 400, 'EMAIL_ALREADY_EXISTS');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: parseInt(id) },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'USER_UPDATED',
      userId: req.user.id,
      details: JSON.stringify({
        updatedUserId: id,
        changes: updateData
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Usuário atualizado com sucesso',
    data: updatedUser
  });
}));

// @desc    Alterar senha do usuário
// @route   PATCH /api/users/:id/password
// @access  Private (Manager+ ou próprio usuário)
router.patch('/:id/password', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo'),
  body('currentPassword')
    .if((value, { req }) => req.user.id === req.params.id)
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Verificar permissões
  const isOwnAccount = req.user.id === parseInt(id);
  const hasManagerPermission = ['MANAGER', 'ADMIN'].includes(req.user.role);

  if (!isOwnAccount && !hasManagerPermission) {
    throw new AppError('Sem permissão para alterar senha deste usuário', 403, 'INSUFFICIENT_PERMISSIONS');
  }

  const user = await prisma.user.findUnique({
    where: { id: parseInt(id) }
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  // Se for própria conta, verificar senha atual
  if (isOwnAccount) {
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError('Senha atual incorreta', 400, 'INVALID_CURRENT_PASSWORD');
    }
  }

  // Hash da nova senha
  const salt = await bcrypt.genSalt(12);
  const hashedNewPassword = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({
    where: { id: parseInt(id) },
    data: { password: hashedNewPassword }
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'PASSWORD_CHANGED',
      userId: req.user.id,
      details: JSON.stringify({
        targetUserId: id,
        changedByOwner: isOwnAccount
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Senha alterada com sucesso'
  });
}));

// @desc    Desativar usuário
// @route   PATCH /api/users/:id/deactivate
// @access  Private (Manager+)
router.patch('/:id/deactivate', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;

  if (id === req.user.id) {
    throw new AppError('Não é possível desativar sua própria conta', 400, 'CANNOT_DEACTIVATE_SELF');
  }

  const user = await prisma.user.findUnique({
    where: { id: parseInt(id) }
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  if (!user.isActive) {
    return res.json({
      success: true,
      message: 'Usuário já estava desativado'
    });
  }

  await prisma.user.update({
    where: { id: parseInt(id) },
    data: { isActive: false }
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'USER_DEACTIVATED',
      userId: req.user.id,
      details: JSON.stringify({
        deactivatedUserId: id,
        deactivatedUserEmail: user.email
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Usuário desativado com sucesso'
  });
}));

// @desc    Reativar usuário
// @route   PATCH /api/users/:id/activate
// @access  Private (Manager+)
router.patch('/:id/activate', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: parseInt(id) }
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  if (user.isActive) {
    return res.json({
      success: true,
      message: 'Usuário já estava ativo'
    });
  }

  await prisma.user.update({
    where: { id: parseInt(id) },
    data: { isActive: true }
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'USER_ACTIVATED',
      userId: req.user.id,
      details: JSON.stringify({
        activatedUserId: id,
        activatedUserEmail: user.email
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Usuário reativado com sucesso'
  });
}));

// @desc    Atualizar perfil do usuário logado
// @route   PUT /api/users/profile
// @access  Private (Qualquer usuário autenticado)
router.put('/profile', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido')
], asyncHandler(async (req, res) => {
  console.log('PUT /profile - req.body:', req.body);
  console.log('PUT /profile - req.user:', req.user);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('PUT /profile - Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  // Filtrar apenas os campos que existem no modelo User
  const { name, email } = req.body;
  const updateData = {};
  
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;

  // Verificar se email já existe (se estiver sendo alterado)
  if (updateData.email) {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: updateData.email,
        id: { not: userId }
      }
    });

    if (existingUser) {
      throw new AppError('Email já está em uso', 400, 'EMAIL_ALREADY_EXISTS');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true
    }
  });

  res.json({
    success: true,
    message: 'Perfil atualizado com sucesso',
    data: updatedUser
  });
}));

// @desc    Obter estatísticas de usuários
// @route   GET /api/users/stats/summary
// @access  Private (Manager+)
router.get('/stats/summary', requireManager, asyncHandler(async (req, res) => {
  const [totalUsers, activeUsers, byRole, recentLogins] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } }
    }),
    Promise.resolve(0) // lastLogin field doesn't exist in schema
  ]);

  const stats = {
    summary: {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      recentLogins
    },
    byRole: byRole.map(item => ({
      role: item.role,
      count: item._count._all
    }))
  };

  res.json({
    success: true,
    data: stats
  });
}));

module.exports = router;