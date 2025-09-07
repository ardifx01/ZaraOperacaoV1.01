const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { requireOperator, requireLeader, requireRole } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');
const NotificationService = require('../services/notificationService');

const router = express.Router();
const prisma = new PrismaClient();

// @desc    Listar notificações do usuário
// @route   GET /api/notifications
// @access  Private (Operator+)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
  query('read').optional().isBoolean().withMessage('Read deve ser boolean'),
  query('type').optional().isIn(['QUALITY_TEST_MISSING', 'TEFLON_EXPIRING', 'TEFLON_EXPIRED', 'MACHINE_ALERT', 'MACHINE_STATUS', 'SYSTEM_ALERT']).withMessage('Tipo de notificação inválido'),
  query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Prioridade inválida')
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
    read,
    type,
    priority
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  // Garantir que userId seja um número
  const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
  
  const where = {
    userId
  };

  // Filtros
  if (read !== undefined) where.read = read === 'true';
  if (type) where.type = type;
  if (priority) where.priority = priority;

  // Buscar notificações
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    },
    skip,
    take: parseInt(limit)
  });

  // Contar total
  const total = await prisma.notification.count({ where });

  // Contar não lidas
   const unreadCount = await prisma.notification.count({
     where: {
       userId,
       read: false
     }
   });

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount
    },
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

// @desc    Obter configurações de notificação do usuário
// @route   GET /api/notifications/settings
// @access  Private (Operator+)
router.get('/settings', requireOperator, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Configurações de notificação obtidas com sucesso',
    data: {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      },
      emailNotifications: true, // Configuração padrão
      pushNotifications: true   // Configuração padrão
    }
  });
}));

// @desc    Teste simples
// @route   GET /api/notifications/test-simple
// @access  Private (Operator+)
router.get('/test-simple', requireOperator, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Teste funcionando',
    user: req.user
  });
}));

// @desc    Obter notificação por ID
// @route   GET /api/notifications/:id
// @access  Private (Operator+)
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID da notificação inválido')
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
  const notificationId = parseInt(id);
  const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;

  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: userId
    }
  });

  if (!notification) {
    throw new AppError('Notificação não encontrada', 404, 'NOTIFICATION_NOT_FOUND');
  }

  res.json({
    success: true,
    data: notification
  });
}));

// @desc    Criar nova notificação
// @route   POST /api/notifications
// @access  Private (Leader+)
router.post('/', [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('ID do usuário inválido'),
  body('type')
    .isIn(['QUALITY_TEST_MISSING', 'TEFLON_EXPIRING', 'TEFLON_EXPIRED', 'MACHINE_ALERT', 'SYSTEM_ALERT'])
    .withMessage('Tipo de notificação inválido'),
  body('priority')
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Prioridade inválida'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Título deve ter entre 1 e 200 caracteres'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Mensagem deve ter entre 1 e 1000 caracteres'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data deve ser um objeto')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const notificationData = {
    ...req.body,
    createdBy: req.user.id
  };

  // Verificar se usuário existe
  const user = await prisma.user.findUnique({
    where: { id: notificationData.userId },
    select: { id: true, name: true, email: true }
  });

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  const notification = await prisma.notification.create({
    data: notificationData
  });

  // Notificar via Socket.IO
  req.io.to(`user:${notificationData.userId}`).emit('notification:new', {
    notification,
    user: user.name
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'NOTIFICATION_CREATED',
      userId: req.user.id,
      details: JSON.stringify({
        notificationId: notification.id,
        targetUserId: notificationData.userId,
        type: notification.type,
        priority: notification.priority
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(201).json({
    success: true,
    message: 'Notificação criada com sucesso',
    data: notification
  });
}));

// @desc    Marcar notificação como lida
// @route   PATCH /api/notifications/:id/read
// @access  Private (Operator+)
router.patch('/:id/read', [
  param('id').isInt({ min: 1 }).withMessage('ID da notificação inválido')
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

  const notification = await prisma.notification.findFirst({
    where: {
      id,
      userId: req.user.id
    }
  });

  if (!notification) {
    throw new AppError('Notificação não encontrada', 404, 'NOTIFICATION_NOT_FOUND');
  }

  if (notification.read) {
    return res.json({
      success: true,
      message: 'Notificação já estava marcada como lida',
      data: notification
    });
  }

  const updatedNotification = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      readAt: new Date()
    }
  });

  // Notificar via Socket.IO
  req.io.to(`user:${req.user.id}`).emit('notification:read', {
    notificationId: id
  });

  res.json({
    success: true,
    message: 'Notificação marcada como lida',
    data: updatedNotification
  });
}));

// @desc    Marcar todas as notificações como lidas
// @route   PATCH /api/notifications/read-all
// @access  Private (Operator+)
router.patch('/read-all', requireOperator, asyncHandler(async (req, res) => {
  const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
  
  const result = await prisma.notification.updateMany({
    where: {
      userId: userId,
      read: false
    },
    data: {
      read: true,
      readAt: new Date()
    }
  });

  // Notificar via Socket.IO
  req.io.to(`user:${req.user.id}`).emit('notification:read-all');

  res.json({
    success: true,
    message: `${result.count} notificações marcadas como lidas`,
    count: result.count
  });
}));

// @desc    Deletar notificação
// @route   DELETE /api/notifications/:id
// @access  Private (Operator+)
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID da notificação inválido')
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

  const notification = await prisma.notification.findFirst({
    where: {
      id,
      userId: req.user.id
    }
  });

  if (!notification) {
    throw new AppError('Notificação não encontrada', 404, 'NOTIFICATION_NOT_FOUND');
  }

  await prisma.notification.delete({
    where: { id }
  });

  // Notificar via Socket.IO
  req.io.to(`user:${req.user.id}`).emit('notification:deleted', {
    notificationId: id
  });

  res.json({
    success: true,
    message: 'Notificação deletada com sucesso'
  });
}));

// @desc    Obter contagem de notificações não lidas
// @route   GET /api/notifications/unread/count
// @access  Private (Operator+)
router.get('/unread/count', requireOperator, asyncHandler(async (req, res) => {
  const cacheKey = `unread_notifications:${req.user.id}`;
  let count = await getCache(cacheKey);

  if (count === null) {
    count = await prisma.notification.count({
      where: {
        userId: req.user.id,
        read: false
      }
    });

    // Cache por 1 minuto
    await setCache(cacheKey, count, 60);
  }

  res.json({
    success: true,
    data: { count: parseInt(count) }
  });
}));

// @desc    Obter notificações por tipo
// @route   GET /api/notifications/type/:type
// @access  Private (Operator+)
router.get('/type/:type', [
  param('type').isIn(['QUALITY_TEST_MISSING', 'TEFLON_EXPIRING', 'TEFLON_EXPIRED', 'MACHINE_ALERT', 'SYSTEM_ALERT']).withMessage('Tipo de notificação inválido'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { type } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    userId: req.user.id,
    type
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: parseInt(limit)
    }),
    prisma.notification.count({ where })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: notifications,
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

// @desc    Obter estatísticas de notificações
// @route   GET /api/notifications/stats/summary
// @access  Private (Leader+)
router.get('/stats/summary', requireLeader, asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalNotifications, unreadNotifications, recentNotifications, byType, byPriority] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { read: false } }),
    prisma.notification.count({
      where: { createdAt: { gte: sevenDaysAgo } }
    }),
    prisma.notification.groupBy({
      by: ['type'],
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } }
    }),
    prisma.notification.groupBy({
      by: ['priority'],
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } }
    })
  ]);

  const stats = {
    summary: {
      total: totalNotifications,
      unread: unreadNotifications,
      recent: recentNotifications,
      readRate: totalNotifications > 0 ? ((totalNotifications - unreadNotifications) / totalNotifications * 100).toFixed(1) : 0
    },
    byType: byType.map(item => ({
      type: item.type,
      count: item._count._all
    })),
    byPriority: byPriority.map(item => ({
      priority: item.priority,
      count: item._count._all
    }))
  };

  res.json({
    success: true,
    data: stats
  });
}));

// @desc    Criar notificação em lote
// @route   POST /api/notifications/batch
// @access  Private (Leader+)
router.post('/batch', [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('Lista de usuários deve ter pelo menos 1 item'),
  body('userIds.*')
    .isInt({ min: 1 })
    .withMessage('ID de usuário inválido'),
  body('type')
    .isIn(['QUALITY_TEST_MISSING', 'TEFLON_EXPIRING', 'TEFLON_EXPIRED', 'MACHINE_ALERT', 'SYSTEM_ALERT'])
    .withMessage('Tipo de notificação inválido'),
  body('priority')
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Prioridade inválida'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Título deve ter entre 1 e 200 caracteres'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Mensagem deve ter entre 1 e 1000 caracteres')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { userIds, type, priority, title, message, data } = req.body;

  // Verificar se todos os usuários existem
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true }
  });

  if (users.length !== userIds.length) {
    throw new AppError('Alguns usuários não foram encontrados', 400, 'USERS_NOT_FOUND');
  }

  // Criar notificações em lote
  const notificationsData = userIds.map(userId => ({
    userId,
    type,
    priority,
    title,
    message,
    data,
    createdBy: req.user.id
  }));

  const notifications = await prisma.notification.createMany({
    data: notificationsData
  });

  // Notificar via Socket.IO
  userIds.forEach(userId => {
    req.io.to(`user:${userId}`).emit('notification:new', {
      type,
      priority,
      title,
      message
    });
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'NOTIFICATIONS_BATCH_CREATED',
      userId: req.user.id,
      details: JSON.stringify({
        count: notifications.count,
        userIds,
        type,
        priority
      }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(201).json({
    success: true,
    message: `${notifications.count} notificações criadas com sucesso`,
    count: notifications.count
  });
}));

// @desc    Registrar token de dispositivo para push notifications
// @route   POST /api/notifications/device-token
// @access  Private (Operator+)
router.post('/device-token', [
  body('token').notEmpty().withMessage('Token do dispositivo é obrigatório'),
  body('deviceType').optional().isIn(['web', 'android', 'ios']).withMessage('Tipo de dispositivo inválido')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { token, deviceType = 'web' } = req.body;
  const userId = req.user.id;

  // Verificar se o token já existe
  const existingDevice = await prisma.userDevice.findFirst({
    where: { token, userId }
  });

  if (existingDevice) {
    // Atualizar último acesso
    await prisma.userDevice.update({
      where: { id: existingDevice.id },
      data: { lastUsed: new Date() }
    });
  } else {
    // Criar novo registro
    await prisma.userDevice.create({
      data: {
        userId,
        token,
        deviceType,
        isActive: true,
        lastUsed: new Date()
      }
    });
  }

  res.json({
    success: true,
    message: 'Token registrado com sucesso'
  });
}));

// @desc    Enviar notificação de teste
// @route   POST /api/notifications/test
// @access  Private (Admin)
router.post('/test', [
  body('title').notEmpty().withMessage('Título é obrigatório'),
  body('message').notEmpty().withMessage('Mensagem é obrigatória'),
  body('type').optional().isIn(['INFO', 'WARNING', 'ERROR', 'SUCCESS']).withMessage('Tipo inválido'),
  body('targetUserId').optional().isInt().withMessage('ID do usuário deve ser um número'),
  body('targetRole').optional().isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']).withMessage('Papel inválido')
], requireRole(['ADMIN']), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { type, title, message, targetUserId, targetRole } = req.body;

  const notificationData = {
    type: type || 'INFO',
    title,
    message,
    priority: 'MEDIUM',
    channels: ['EMAIL', 'PUSH', 'IN_APP']
  };

  if (targetUserId) {
    await NotificationService.sendToUser(targetUserId, notificationData);
  } else if (targetRole) {
    await NotificationService.sendToRole(targetRole, notificationData);
  } else {
    return res.status(400).json({
      success: false,
      message: 'Especifique um usuário ou papel de destino'
    });
  }

  res.json({
    success: true,
    message: 'Notificação de teste enviada com sucesso'
  });
}));



// @desc    Atualizar configurações de notificação
// @route   PATCH /api/notifications/settings
// @access  Private (Operator+)
router.patch('/settings', [
  body('emailNotifications').optional().isBoolean().withMessage('emailNotifications deve ser boolean'),
  body('pushNotifications').optional().isBoolean().withMessage('pushNotifications deve ser boolean')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const { emailNotifications, pushNotifications } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      emailNotifications: emailNotifications ?? undefined,
      pushNotifications: pushNotifications ?? undefined
    },
    select: {
      emailNotifications: true,
      pushNotifications: true
    }
  });

  res.json({
    success: true,
    data: updatedUser
  });
}));

module.exports = router;