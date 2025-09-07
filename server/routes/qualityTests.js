const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { requireOperator, requireLeader } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');
const notificationService = require('../services/notificationService');

const router = express.Router();
const prisma = new PrismaClient();

// @desc    Listar testes de qualidade
// @route   GET /api/quality-tests
// @access  Private (Operator+)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('approved').optional().isBoolean().withMessage('Approved deve ser boolean'),
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== Erros de validação ===');
    console.log('Errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const {
    page = 1,
    limit = 20,
    machineId,
    approved,
    startDate,
    endDate,
    product,
    lot
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};

  // Filtros
  if (machineId) where.machineId = machineId;
  if (approved !== undefined) where.approved = approved === 'true';
  if (product) where.product = { contains: product, mode: 'insensitive' };
  if (lot) where.lot = { contains: lot, mode: 'insensitive' };
  
  if (startDate || endDate) {
    where.testDate = {};
    if (startDate) where.testDate.gte = new Date(startDate);
    if (endDate) where.testDate.lte = new Date(endDate);
  }

  // Se for operador, mostrar apenas seus testes
  if (req.user.role === 'OPERATOR') {
    where.userId = req.user.id;
  }

  const [tests, total] = await Promise.all([
    prisma.qualityTest.findMany({
      where,
      include: {
        machine: {
          select: { name: true, code: true }
        },
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { testDate: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.qualityTest.count({ where })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: tests,
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

// @desc    Obter teste de qualidade por ID
// @route   GET /api/quality-tests/:id
// @access  Private (Operator+)
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID do teste inválido')
], requireOperator, asyncHandler(async (req, res) => {
  // Debug: Log received data
  console.log('=== GET /api/quality-tests/:id - Dados recebidos ===');
  console.log('req.params.id:', req.params.id);
  
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== Erros de validação ===');
    console.log('errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const where = { id: parseInt(id) };

  // Se for operador, só pode ver seus próprios testes
  if (req.user.role === 'OPERATOR') {
    where.userId = req.user.id;
  }

  const test = await prisma.qualityTest.findFirst({
    where,
    include: {
      machine: {
        select: { name: true, code: true, location: true }
      },
      user: {
        select: { name: true, email: true, role: true }
      }
    }
  });

  if (!test) {
    throw new AppError('Teste não encontrado', 404, 'TEST_NOT_FOUND');
  }

  res.json({
    success: true,
    data: test
  });
}));

// @desc    Criar novo teste de qualidade
// @route   POST /api/quality-tests
// @access  Private (Operator+)
router.post('/', [
  // Log dos dados recebidos para debug
  (req, res, next) => {
    console.log('=== POST /api/quality-tests - Dados recebidos ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    next();
  },
  body('machineId')
    .notEmpty()
    .withMessage('ID da máquina é obrigatório')
    .custom((value) => {
      // Aceitar tanto IDs inteiros quanto ObjectIds
      if (typeof value === 'string' && value.trim() === '') {
        throw new Error('ID da máquina não pode estar vazio');
      }
      return true;
    }),
  body('product')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Produto é obrigatório'),
  body('lot')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Lote é obrigatório'),
  body('boxNumber')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Número da caixa é obrigatório'),
  body('packageSize')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Tamanho da embalagem é obrigatório'),
  body('packageWidth')
    .isFloat({ min: 0 })
    .withMessage('Largura da embalagem deve ser um número positivo'),
  body('bottomSize')
    .isFloat({ min: 0 })
    .withMessage('Tamanho do fundo deve ser um número positivo'),
  body('sideSize')
    .isFloat({ min: 0 })
    .withMessage('Tamanho da lateral deve ser um número positivo'),
  body('zipperDistance')
    .isFloat({ min: 0 })
    .withMessage('Distância do zíper deve ser um número positivo'),
  body('facilitatorDistance')
    .isFloat({ min: 0 })
    .withMessage('Distância do facilitador deve ser um número positivo'),
  body('rulerTestDone')
    .isBoolean()
    .withMessage('Teste da régua deve ser boolean'),
  body('hermeticityTestDone')
    .isBoolean()
    .withMessage('Teste de hermeticidade deve ser boolean'),
  // Validação dos novos campos de inspeção de qualidade
  body('visualInspection')
    .optional()
    .isBoolean()
    .withMessage('Inspeção visual deve ser boolean'),
  body('dimensionalCheck')
    .optional()
    .isBoolean()
    .withMessage('Verificação dimensional deve ser boolean'),
  body('colorConsistency')
    .optional()
    .isBoolean()
    .withMessage('Consistência de cor deve ser boolean'),
  body('surfaceQuality')
    .optional()
    .isBoolean()
    .withMessage('Qualidade da superfície deve ser boolean'),
  body('adhesionTest')
    .optional()
    .isBoolean()
    .withMessage('Teste de aderência deve ser boolean'),
  body('approved')
    .isBoolean()
    .withMessage('Aprovado deve ser boolean'),
  body('observations')
    .optional()
    .trim(),
  body('images')
    .isArray()
    .withMessage('Imagens deve ser um array')
    .custom((images) => {
      if (images.length === 0) {
        throw new Error('Pelo menos uma imagem é obrigatória');
      }
      return true;
    }),
  body('videos')
    .optional()
    .isArray()
    .withMessage('Vídeos deve ser um array')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== POST /api/quality-tests - Erros de validação ===');
    console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const testData = {
    ...req.body,
    userId: req.user.id,
    images: JSON.stringify(req.body.images || []),
    videos: JSON.stringify(req.body.videos || [])
  };

  // Verificar se máquina existe e está ativa
  const machine = await prisma.machine.findUnique({
    where: { id: testData.machineId }
  });

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  if (!machine.isActive) {
    throw new AppError('Máquina inativa', 400, 'MACHINE_INACTIVE');
  }

  // Verificar se operador tem operação ativa nesta máquina
  let activeOperation = await prisma.machineOperation.findFirst({
    where: {
      machineId: testData.machineId,
      userId: req.user.id,
      status: 'ACTIVE'
    }
  });
  
  // Se não encontrou operação do usuário atual, verificar se é ADMIN/MANAGER e se existe alguma operação ativa na máquina
  if (!activeOperation && (req.user.role === 'ADMIN' || req.user.role === 'MANAGER')) {
    activeOperation = await prisma.machineOperation.findFirst({
      where: {
        machineId: testData.machineId,
        status: 'ACTIVE'
      }
    });
  }

  if (!activeOperation) {
    throw new AppError('Operação ativa não encontrada nesta máquina', 400, 'NO_ACTIVE_OPERATION');
  }

  // Verificar se operação não passou de 20 minutos
  const operationTime = new Date() - new Date(activeOperation.startTime);
  const twentyMinutes = 20 * 60 * 1000;
  
  if (operationTime > twentyMinutes) {
    // Cancelar operação automaticamente
    await prisma.machineOperation.update({
      where: { id: activeOperation.id },
      data: { status: 'CANCELLED' }
    });
    
    throw new AppError('Tempo limite de 20 minutos excedido para esta operação', 400, 'OPERATION_TIMEOUT');
  }

  // Criar teste de qualidade
  const test = await prisma.qualityTest.create({
    data: testData,
    include: {
      machine: {
        select: { name: true, code: true }
      },
      user: {
        select: { name: true, email: true }
      }
    }
  });

  // Invalidar cache relacionado
  await deleteCache(`machine:${testData.machineId}`);

  // Notificar líderes e gestores via Socket.IO
  req.io.emit('quality-test:created', {
    test,
    machine: machine.name,
    operator: req.user.name,
    approved: test.approved
  });

  // Enviar notificações para líderes e gestores
  try {
    // Notificação geral para criação de teste
    const leaders = await prisma.user.findMany({
      where: {
        role: { in: ['LEADER', 'MANAGER', 'ADMIN'] },
        isActive: true
      }
    });

    const generalNotifications = leaders.map(leader => ({
      userId: leader.id,
      title: 'Teste de Qualidade Realizado',
      message: `${req.user.name} realizou teste de qualidade na máquina ${machine.name} - ${test.approved ? 'Aprovado' : 'Reprovado'}`,
      type: 'QUALITY_TEST',
      priority: test.approved ? 'MEDIUM' : 'HIGH',
      data: {
        testId: test.id,
        machineId: machine.id,
        operatorId: req.user.id,
        approved: test.approved
      }
    }));

    await prisma.notification.createMany({
      data: generalNotifications
    });

    // Se reprovado, enviar alerta específico via Socket.IO
    if (!test.approved) {
      req.io.emit('quality-test:failed', {
        test,
        machine: machine.name,
        operator: req.user.name
      });
    }
  } catch (notificationError) {
    console.error('Erro ao enviar notificação de teste de qualidade:', notificationError);
  }

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'QUALITY_TEST_CREATED',
      userId: req.user.id,
      details: JSON.stringify({
        testId: test.id,
        machineId: testData.machineId,
        approved: test.approved,
        product: test.product,
        lot: test.lot
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(201).json({
    success: true,
    message: 'Teste de qualidade criado com sucesso',
    data: test
  });
}));

// @desc    Atualizar teste de qualidade
// @route   PUT /api/quality-tests/:id
// @access  Private (Leader+)
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID do teste inválido'),
  body('approved').optional().isBoolean().withMessage('Aprovado deve ser boolean'),
  body('observations').optional().trim()
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
  const updateData = req.body;

  const test = await prisma.qualityTest.findUnique({
    where: { id },
    include: {
      machine: { select: { name: true } },
      user: { select: { name: true } }
    }
  });

  if (!test) {
    throw new AppError('Teste não encontrado', 404, 'TEST_NOT_FOUND');
  }

  const updatedTest = await prisma.qualityTest.update({
    where: { id },
    data: updateData,
    include: {
      machine: {
        select: { name: true, code: true }
      },
      user: {
        select: { name: true, email: true }
      }
    }
  });

  // Notificar via Socket.IO
  req.io.emit('quality-test:updated', {
    test: updatedTest,
    changes: updateData,
    updatedBy: req.user.name
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'QUALITY_TEST_UPDATED',
      userId: req.user.id,
      details: JSON.stringify({
        testId: id,
        changes: updateData
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Teste atualizado com sucesso',
    data: updatedTest
  });
}));

// @desc    Obter estatísticas de testes
// @route   GET /api/quality-tests/stats
// @access  Private (Leader+)
router.get('/stats/summary', requireLeader, asyncHandler(async (req, res) => {
  const { startDate, endDate, machineId } = req.query;
  
  const where = {};
  
  if (startDate || endDate) {
    where.testDate = {};
    if (startDate) where.testDate.gte = new Date(startDate);
    if (endDate) where.testDate.lte = new Date(endDate);
  }
  
  if (machineId) where.machineId = machineId;

  const [total, approved, rejected, byMachine, byOperator] = await Promise.all([
    prisma.qualityTest.count({ where }),
    prisma.qualityTest.count({ where: { ...where, approved: true } }),
    prisma.qualityTest.count({ where: { ...where, approved: false } }),
    prisma.qualityTest.groupBy({
      by: ['machineId'],
      where,
      _count: { _all: true },
      _sum: { approved: true }
    }),
    prisma.qualityTest.groupBy({
      by: ['userId'],
      where,
      _count: { _all: true },
      _sum: { approved: true }
    })
  ]);

  // Buscar nomes das máquinas e operadores
  const machineIds = byMachine.map(m => m.machineId);
  const userIds = byOperator.map(o => o.userId);

  const [machines, users] = await Promise.all([
    prisma.machine.findMany({
      where: { id: { in: machineIds } },
      select: { id: true, name: true, code: true }
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true }
    })
  ]);

  // Mapear dados com nomes
  const machineStats = byMachine.map(stat => {
    const machine = machines.find(m => m.id === stat.machineId);
    return {
      machine,
      total: stat._count._all,
      approved: stat._sum.approved || 0,
      rejected: stat._count._all - (stat._sum.approved || 0),
      approvalRate: stat._count._all > 0 ? ((stat._sum.approved || 0) / stat._count._all * 100).toFixed(2) : 0
    };
  });

  const operatorStats = byOperator.map(stat => {
    const user = users.find(u => u.id === stat.userId);
    return {
      operator: user,
      total: stat._count._all,
      approved: stat._sum.approved || 0,
      rejected: stat._count._all - (stat._sum.approved || 0),
      approvalRate: stat._count._all > 0 ? ((stat._sum.approved || 0) / stat._count._all * 100).toFixed(2) : 0
    };
  });

  const stats = {
    summary: {
      total,
      approved,
      rejected,
      approvalRate: total > 0 ? (approved / total * 100).toFixed(2) : 0
    },
    byMachine: machineStats,
    byOperator: operatorStats
  };

  res.json({
    success: true,
    data: stats
  });
}));

module.exports = router;