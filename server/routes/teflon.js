const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { requireOperator, requireLeader } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');

const router = express.Router();
const prisma = new PrismaClient();

// @desc    Listar trocas de teflon
// @route   GET /api/teflon
// @access  Private (Operator+)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('expired').optional().isBoolean().withMessage('Expired deve ser boolean'),
  query('expiringSoon').optional().isBoolean().withMessage('ExpiringSoon deve ser boolean')
], requireOperator, asyncHandler(async (req, res) => {
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
    machineId,
    expired,
    expiringSoon
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Filtros
  if (machineId) where.machineId = machineId;
  
  if (expired === 'true') {
    where.expiryDate = { lt: now };
  }
  
  if (expiringSoon === 'true') {
    where.expiryDate = {
      gte: now,
      lte: sevenDaysFromNow
    };
  }

  // Se for operador, mostrar apenas suas trocas
  if (req.user.role === 'OPERATOR') {
    where.userId = req.user.id;
  }

  const [changes, total] = await Promise.all([
    prisma.teflonChange.findMany({
      where,
      include: {
        machine: {
          select: { name: true, code: true, location: true }
        },
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { changeDate: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.teflonChange.count({ where })
  ]);

  // Adicionar status de expiração
  const changesWithStatus = changes.map(change => ({
    ...change,
    status: {
      expired: change.expiryDate < now,
      expiringSoon: change.expiryDate >= now && change.expiryDate <= sevenDaysFromNow,
      daysUntilExpiry: Math.ceil((change.expiryDate - now) / (1000 * 60 * 60 * 24))
    }
  }));

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: changesWithStatus,
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

// @desc    Obter troca de teflon por ID
// @route   GET /api/teflon/:id
// @access  Private (Operator+)
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID da troca inválido')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const where = { id };

  // Se for operador, só pode ver suas próprias trocas
  if (req.user.role === 'OPERATOR') {
    where.userId = req.user.id;
  }

  const change = await prisma.teflonChange.findFirst({
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

  if (!change) {
    throw new AppError('Troca de teflon não encontrada', 404, 'TEFLON_CHANGE_NOT_FOUND');
  }

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const changeWithStatus = {
    ...change,
    status: {
      expired: change.expiryDate < now,
      expiringSoon: change.expiryDate >= now && change.expiryDate <= sevenDaysFromNow,
      daysUntilExpiry: Math.ceil((change.expiryDate - now) / (1000 * 60 * 60 * 24))
    }
  };

  res.json({
    success: true,
    data: changeWithStatus
  });
}));

// @desc    Registrar nova troca de teflon
// @route   POST /api/teflon
// @access  Private (Operator+)
router.post('/', [
  body('machineId')
    .isInt({ min: 1 })
    .withMessage('ID da máquina inválido'),
  body('expiryDate')
    .isISO8601()
    .withMessage('Data de validade inválida')
    .custom((value) => {
      const expiryDate = new Date(value);
      const now = new Date();
      if (expiryDate <= now) {
        throw new Error('Data de validade deve ser futura');
      }
      return true;
    }),
  body('teflonType')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Tipo de teflon é obrigatório'),
  body('observations')
    .optional()
    .trim(),
  body('photos').isArray().withMessage('Fotos devem ser um array').custom((photos) => {
    if (photos.length === 0) {
      throw new Error('Pelo menos uma foto é obrigatória');
    }
    return true;
  })
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { machineId, expiryDate, teflonType, observations, photos } = req.body;
  
  const changeData = {
    machineId: parseInt(machineId),
    expiryDate: new Date(expiryDate),
    teflonType,
    observations,
    photos: JSON.stringify(photos),
    userId: req.user.id
  };

  // Verificar se máquina existe e está ativa
  const machine = await prisma.machine.findUnique({
    where: { id: changeData.machineId }
  });

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  if (!machine.isActive) {
    throw new AppError('Máquina inativa', 400, 'MACHINE_INACTIVE');
  }

  // Criar registro de troca
  const change = await prisma.teflonChange.create({
    data: changeData,
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
  await deleteCache(`machine:${changeData.machineId}`);

  // Notificar via Socket.IO
  req.io.emit('teflon:changed', {
    change,
    machine: machine.name,
    operator: req.user.name
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'TEFLON_CHANGED',
      userId: req.user.id,
      details: JSON.stringify({
        changeId: change.id,
        machineId: changeData.machineId,
        teflonType: change.teflonType,
        expiryDate: change.expiryDate
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(201).json({
    success: true,
    message: 'Troca de teflon registrada com sucesso',
    data: change
  });
}));

// @desc    Atualizar troca de teflon
// @route   PUT /api/teflon/:id
// @access  Private (Leader+)
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID da troca inválido'),
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Data de validade inválida'),
  body('teflonType')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Tipo de teflon não pode estar vazio'),
  body('observations')
    .optional()
    .trim()
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

  if (updateData.expiryDate) {
    updateData.expiryDate = new Date(updateData.expiryDate);
    
    // Verificar se data é futura
    if (updateData.expiryDate <= new Date()) {
      throw new AppError('Data de validade deve ser futura', 400, 'INVALID_EXPIRY_DATE');
    }
  }

  const change = await prisma.teflonChange.findUnique({
    where: { id },
    include: {
      machine: { select: { name: true } }
    }
  });

  if (!change) {
    throw new AppError('Troca de teflon não encontrada', 404, 'TEFLON_CHANGE_NOT_FOUND');
  }

  const updatedChange = await prisma.teflonChange.update({
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

  // Invalidar cache
  await deleteCache(`machine:${change.machineId}`);

  // Notificar via Socket.IO
  req.io.emit('teflon:updated', {
    change: updatedChange,
    changes: updateData,
    updatedBy: req.user.name
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'TEFLON_UPDATED',
      userId: req.user.id,
      details: JSON.stringify({
        changeId: id,
        changes: updateData
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Troca de teflon atualizada com sucesso',
    data: updatedChange
  });
}));

// @desc    Obter trocas expirando em breve
// @route   GET /api/teflon/expiring-soon
// @access  Private (Operator+)
router.get('/alerts/expiring-soon', requireOperator, asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const expiringChanges = await prisma.teflonChange.findMany({
    where: {
      expiryDate: {
        gte: now,
        lte: sevenDaysFromNow
      },
      alertSent: false
    },
    include: {
      machine: {
        select: { name: true, code: true, location: true }
      },
      user: {
        select: { name: true, email: true }
      }
    },
    orderBy: { expiryDate: 'asc' }
  });

  // Adicionar dias restantes
  const changesWithDays = expiringChanges.map(change => ({
    ...change,
    daysUntilExpiry: Math.ceil((change.expiryDate - now) / (1000 * 60 * 60 * 24))
  }));

  res.json({
    success: true,
    data: changesWithDays,
    count: changesWithDays.length
  });
}));

// @desc    Obter trocas expiradas
// @route   GET /api/teflon/expired
// @access  Private (Leader+)
router.get('/alerts/expired', requireLeader, asyncHandler(async (req, res) => {
  const now = new Date();

  const expiredChanges = await prisma.teflonChange.findMany({
    where: {
      expiryDate: { lt: now }
    },
    include: {
      machine: {
        select: { name: true, code: true, location: true }
      },
      user: {
        select: { name: true, email: true }
      }
    },
    orderBy: { expiryDate: 'desc' }
  });

  // Adicionar dias de atraso
  const changesWithDelay = expiredChanges.map(change => ({
    ...change,
    daysOverdue: Math.ceil((now - change.expiryDate) / (1000 * 60 * 60 * 24))
  }));

  res.json({
    success: true,
    data: changesWithDelay,
    count: changesWithDelay.length
  });
}));

// @desc    Marcar alerta como enviado
// @route   PATCH /api/teflon/:id/alert-sent
// @access  Private (System)
router.patch('/:id/alert-sent', [
  param('id').isInt({ min: 1 }).withMessage('ID da troca inválido')
], requireOperator, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const change = await prisma.teflonChange.update({
    where: { id },
    data: { alertSent: true }
  });

  res.json({
    success: true,
    message: 'Alerta marcado como enviado',
    data: change
  });
}));

// @desc    Obter estatísticas de teflon
// @route   GET /api/teflon/stats/summary
// @access  Private (Leader+)
router.get('/stats/summary', requireLeader, asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [total, expired, expiringSoon, recentChanges, byMachine] = await Promise.all([
    prisma.teflonChange.count(),
    prisma.teflonChange.count({
      where: { expiryDate: { lt: now } }
    }),
    prisma.teflonChange.count({
      where: {
        expiryDate: {
          gte: now,
          lte: sevenDaysFromNow
        }
      }
    }),
    prisma.teflonChange.count({
      where: {
        changeDate: { gte: thirtyDaysAgo }
      }
    }),
    prisma.teflonChange.groupBy({
      by: ['machineId'],
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
      take: 10
    })
  ]);

  // Buscar nomes das máquinas
  const machineIds = byMachine.map(m => m.machineId);
  const machines = await prisma.machine.findMany({
    where: { id: { in: machineIds } },
    select: { id: true, name: true, code: true }
  });

  const machineStats = byMachine.map(stat => {
    const machine = machines.find(m => m.id === stat.machineId);
    return {
      machine,
      totalChanges: stat._count._all
    };
  });

  const stats = {
    summary: {
      total,
      expired,
      expiringSoon,
      recentChanges,
      alertsNeeded: expired + expiringSoon
    },
    topMachines: machineStats
  };

  res.json({
    success: true,
    data: stats
  });
}));

module.exports = router;