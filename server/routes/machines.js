const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireLeader, requireOperator, requireMachinePermission } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');
const ShiftMiddleware = require('../middleware/shiftMiddleware');
const {
  calculateProduction,
  calculateCurrentShiftProduction,
  calculateDailyProduction
} = require('../services/productionService');
const notificationService = require('../services/notificationService');

const router = express.Router();
const prisma = new PrismaClient();

// @desc    Listar todas as máquinas
// @route   GET /api/machines
// @access  Private (Operator+)
router.get('/', requireOperator, asyncHandler(async (req, res) => {
  const { status, active } = req.query;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  // Para operadores, incluir o userId no cache key para cache específico por usuário
  const cacheKey = userRole === 'OPERATOR' 
    ? `machines:${status || 'all'}:${active || 'all'}:user:${userId}`
    : `machines:${status || 'all'}:${active || 'all'}`;

  // Tentar buscar do cache
  let machines = await getCache(cacheKey);
  
  if (!machines) {
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    // Para operadores, filtrar apenas máquinas com permissão
    if (userRole === 'OPERATOR') {
      // Buscar IDs das máquinas que o operador tem permissão
      const userPermissions = await prisma.machinePermission.findMany({
        where: {
          userId: userId,
          canView: true
        },
        select: {
          machineId: true
        }
      });

      const allowedMachineIds = userPermissions.map(p => p.machineId);
      
      // Se não tem permissão para nenhuma máquina, retornar array vazio
      if (allowedMachineIds.length === 0) {
        machines = [];
      } else {
        where.id = {
          in: allowedMachineIds
        };
      }
    }

    // Buscar máquinas apenas se não for operador sem permissões
    if (userRole !== 'OPERATOR' || where.id) {
      machines = await prisma.machine.findMany({
        where,
        include: {
          operations: {
            where: { status: 'ACTIVE' },
            include: {
              user: {
                select: { name: true, email: true }
              }
            }
          },
          _count: {
            select: {
              qualityTests: true,
              teflonChanges: true,
              operations: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });
      
      // Adicionar informação do operador atual para cada máquina
      machines = machines.map(machine => ({
        ...machine,
        operator: machine.operations?.[0]?.user?.name || 'Não atribuído'
      }));
    }

    // Cache por 5 minutos (menor para operadores para refletir mudanças de permissão)
    const cacheTime = userRole === 'OPERATOR' ? 180 : 300;
    await setCache(cacheKey, machines || [], cacheTime);
  }

  res.json({
    success: true,
    data: machines || [],
    count: (machines || []).length
  });
}));

// @desc    Obter máquina por ID ou código
// @route   GET /api/machines/:id
// @access  Private (Operator+) with machine permission
router.get('/:id', requireOperator, requireMachinePermission('canView'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `machine:${id}`;

  // Tentar buscar do cache
  let machine = await getCache(cacheKey);
  
  if (!machine) {
    // Tentar buscar por ID numérico primeiro, depois por código
    const isNumericId = /^\d+$/.test(id);
    
    if (isNumericId) {
      machine = await prisma.machine.findUnique({
        where: { id: parseInt(id) },
        include: {
          qualityTests: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: { name: true, email: true }
              }
            }
          },
          teflonChanges: {
            take: 5,
            orderBy: { changeDate: 'desc' },
            include: {
              user: {
                select: { name: true, email: true }
              }
            }
          },
          operations: {
            where: { status: 'ACTIVE' },
            include: {
              user: {
                select: { name: true, email: true }
              }
            }
          },
          _count: {
            select: {
              qualityTests: true,
              teflonChanges: true,
              operations: true
            }
          }
        }
      });
    } else {
      machine = await prisma.machine.findUnique({
        where: { code: id },
        include: {
          qualityTests: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        teflonChanges: {
          take: 5,
          orderBy: { changeDate: 'desc' },
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        operations: {
          where: { status: 'ACTIVE' },
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        },
        _count: {
          select: {
            qualityTests: true,
            teflonChanges: true,
            operations: true
          }
        }
      }
    });
    }

    if (!machine) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }

    // Cache por 2 minutos
    await setCache(cacheKey, machine, 120);
  }

  res.json({
    success: true,
    data: machine
  });
}));

// @desc    Criar nova máquina
// @route   POST /api/machines
// @access  Private (Leader+)
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nome da máquina deve ter pelo menos 2 caracteres'),
  body('code')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Código da máquina deve ter pelo menos 2 caracteres'),
  body('location')
    .optional()
    .trim(),
  body('description')
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

  const { name, code, location, description } = req.body;

  // Verificar se código já existe
  const existingMachine = await prisma.machine.findUnique({
    where: { code }
  });

  if (existingMachine) {
    throw new AppError('Código da máquina já existe', 400, 'MACHINE_CODE_EXISTS');
  }

  const machine = await prisma.machine.create({
    data: {
      name,
      code,
      location,
      description
    }
  });

  // Invalidar cache
  await deleteCache('machines:all:all');

  // Notificar via Socket.IO
  req.io.emit('machine:created', {
    machine,
    user: req.user.name
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'MACHINE_CREATED',
      userId: req.user.id,
      details: JSON.stringify({ machineId: machine.id, name, code }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.status(201).json({
    success: true,
    message: 'Máquina criada com sucesso',
    data: machine
  });
}));

// @desc    Atualizar máquina
// @route   PUT /api/machines/:id
// @access  Private (Leader+)
router.put('/:id', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nome da máquina deve ter pelo menos 2 caracteres'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Código da máquina deve ter pelo menos 2 caracteres'),
  body('status')
    .optional()
    .isIn(['STOPPED', 'RUNNING', 'MAINTENANCE', 'ERROR', 'FORA_DE_TURNO', 'OFF_SHIFT'])
    .withMessage('Status inválido'),
  body('location')
    .optional()
    .trim(),
  body('description')
    .optional()
    .trim(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser boolean')
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

  // Verificar se máquina existe - buscar por ObjectId ou código
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  let existingMachine;
  
  if (isObjectId) {
    existingMachine = await prisma.machine.findUnique({
      where: { id }
    });
  } else {
    existingMachine = await prisma.machine.findUnique({
      where: { code: id }
    });
  }

  if (!existingMachine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  // Se alterando código, verificar duplicação
  if (updateData.code && updateData.code !== existingMachine.code) {
    const codeExists = await prisma.machine.findUnique({
      where: { code: updateData.code }
    });

    if (codeExists) {
      throw new AppError('Código da máquina já existe', 400, 'MACHINE_CODE_EXISTS');
    }
  }

  const machine = await prisma.machine.update({
    where: { id: existingMachine.id },
    data: updateData
  });

  // Invalidar cache
  await deleteCache(`machine:${existingMachine.id}`);
  await deleteCache(`machine:${id}`);
  await deleteCache('machines:all:all');

  // Notificar via Socket.IO
  req.io.emit('machine:updated', {
    machine,
    changes: updateData,
    user: req.user.name
  });

  // Log da ação
  await prisma.systemLog.create({
    data: {
      action: 'MACHINE_UPDATED',
      userId: req.user.id,
      details: JSON.stringify({ machineId: id, changes: updateData }),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  });

  res.json({
    success: true,
    message: 'Máquina atualizada com sucesso',
    data: machine
  });
}));

// @desc    Iniciar operação em máquina
// @route   POST /api/machines/:id/start-operation
// @access  Private (Operator+)
router.post('/:id/start-operation', [
  body('notes').optional().trim()
], requireOperator, 
  ShiftMiddleware.checkShiftChange,
  ShiftMiddleware.validateOperationTime,
  ShiftMiddleware.trackMachineOperation,
  ShiftMiddleware.updateShiftData,
  asyncHandler(async (req, res) => {
  console.log('🚀 INÍCIO DO ENDPOINT START-OPERATION');
  console.log('📋 Parâmetros recebidos:', req.params);
  console.log('📋 Body recebido:', req.body);
  console.log('👤 Usuário completo:', JSON.stringify(req.user, null, 2));
  console.log('👤 Nome do usuário:', req.user?.name);
  console.log('👤 ID do usuário:', req.user?.id);
  
  const { id } = req.params;
  const { notes } = req.body;

  // Verificar se máquina existe e está disponível - buscar por ID numérico ou código
  const isNumericId = /^\d+$/.test(id);
  let machine;
  
  console.log(`🔍 Buscando máquina - ID: ${id}, É numérico: ${isNumericId}`);
  
  if (isNumericId) {
    const numericId = parseInt(id);
    console.log(`🔍 Buscando por ID numérico: ${numericId}`);
    machine = await prisma.machine.findUnique({
      where: { id: numericId },
      include: {
        operations: {
          where: { status: 'ACTIVE' }
        }
      }
    });
  } else {
    console.log(`🔍 Buscando por código: ${id}`);
    machine = await prisma.machine.findUnique({
      where: { code: id },
      include: {
        operations: {
          where: { status: 'ACTIVE' }
        }
      }
    });
  }

  console.log(`🔍 Máquina encontrada:`, machine ? `Sim - ${machine.name}` : 'Não');
  if (machine) {
    console.log(`📊 Dados completos da máquina:`, JSON.stringify(machine, null, 2));
    console.log(`📊 Nome da máquina: ${machine.name}`);
    console.log(`📊 Status da máquina: ${machine.status}`);
    console.log(`📊 isActive: ${machine.isActive}`);
    console.log(`📊 Operações ativas: ${machine.operations.length}`);
  }

  if (!machine) {
    console.log(`❌ Máquina não encontrada - ID: ${id}, isNumericId: ${isNumericId}`);
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  // Continuar verificações de disponibilidade
  console.log('🔍 Verificando se máquina está ativa...');
  if (!machine.isActive) {
    console.log('❌ Máquina inativa');
    throw new AppError('Máquina inativa', 400, 'MACHINE_INACTIVE');
  }

  console.log('🔍 Verificando se máquina já está em operação...');
  if (machine.operations.length > 0) {
    console.log('❌ Máquina já está em operação');
    throw new AppError('Máquina já está em operação', 400, 'MACHINE_IN_USE');
  }

  // Verificar se operador já tem operação ativa
  const activeOperation = await prisma.machineOperation.findFirst({
    where: {
      userId: req.user.id,
      status: 'ACTIVE'
    }
  });

  if (activeOperation) {
    throw new AppError('Operador já possui operação ativa', 400, 'OPERATOR_BUSY');
  }

  // Criar operação
  const operation = await prisma.machineOperation.create({
    data: {
      machineId: machine.id,
      userId: req.user.id,
      notes
    },
    include: {
      machine: true,
      user: {
        select: { name: true, email: true }
      }
    }
  });

  // Atualizar status da máquina
  await prisma.machine.update({
    where: { id: machine.id },
    data: { status: 'FUNCIONANDO' }
  });

  // Inicializar dados de produção do turno
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Determinar tipo de turno atual
    const now = new Date();
    const currentHour = now.getHours();
    const shiftType = (currentHour >= 7 && currentHour < 19) ? 'DAY' : 'NIGHT';
    
    // Calcular horários do turno
    const shiftStartTime = new Date(today);
    const shiftEndTime = new Date(today);
    
    if (shiftType === 'DAY') {
      shiftStartTime.setHours(7, 0, 0, 0);
      shiftEndTime.setHours(19, 0, 0, 0);
    } else {
      shiftStartTime.setHours(19, 0, 0, 0);
      shiftEndTime.setDate(shiftEndTime.getDate() + 1);
      shiftEndTime.setHours(7, 0, 0, 0);
    }
    
    // Verificar se já existe registro de turno para hoje
    const existingShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: machine.id,
        operatorId: req.user.id,
        shiftDate: today
      }
    });
    
    if (!existingShiftData) {
      // Criar registro inicial de dados de turno
      await prisma.shiftData.create({
        data: {
          machineId: machine.id,
          operatorId: req.user.id,
          shiftDate: today,
          shiftType: shiftType,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
          totalProduction: 0,
          targetProduction: machine.targetProduction || 0,
          efficiency: 0,
          downtime: 0,
          qualityScore: 100
        }
      });
      
      console.log(`✅ Dados de turno inicializados - Máquina: ${machine.name}, Operador: ${req.user.name}, Turno: ${shiftType}`);
    } else {
      console.log(`ℹ️ Dados de turno já existem para hoje - Máquina: ${machine.name}, Operador: ${req.user.name}`);
    }
  } catch (shiftError) {
    console.error('Erro ao inicializar dados de turno:', shiftError);
    // Não falhar a operação por causa disso
  }

  // Invalidar cache
  await deleteCache(`machine:${machine.id}`);
  await deleteCache(`machine:${id}`);

  // Notificar via Socket.IO
  const eventData = {
    machineId: machine.id,
    machineName: machine.name,
    operatorId: req.user.id,
    operatorName: req.user.name,
    operation,
    timestamp: new Date()
  };
  
  console.log('🚀 Enviando evento machine:operation-started:', eventData);
  req.io.emit('machine:operation-started', eventData);
  
  // Emitir evento de atualização de produção para sincronização em tempo real
  req.io.emit('production:update', {
    machineId: machine.id,
    status: 'FUNCIONANDO',
    timestamp: new Date()
  });

  // Enviar notificação para líderes e gestores
  try {
    const leaders = await prisma.user.findMany({
      where: {
        role: { in: ['LEADER', 'MANAGER', 'ADMIN'] },
        isActive: true
      }
    });

    const notifications = leaders.map(leader => ({
      userId: leader.id,
      title: 'Operação Iniciada',
      message: `${req.user.name} iniciou operação na máquina ${machine.name}`,
      type: 'MACHINE_STATUS',
      priority: 'MEDIUM',
      data: {
        machineId: machine.id,
        operatorId: req.user.id,
        operationId: operation.id,
        action: 'operation_started'
      }
    }));

    await prisma.notification.createMany({
      data: notifications
    });
  } catch (notificationError) {
    console.error('Erro ao enviar notificação de início de operação:', notificationError);
  }

  res.status(201).json({
    success: true,
    message: 'Operação iniciada com sucesso',
    data: operation
  });
}));

// @desc    Finalizar operação em máquina
// @route   POST /api/machines/:id/end-operation
// @access  Private (Operator+)
router.post('/:id/end-operation', [
  body('notes').optional().trim()
], requireOperator,
  ShiftMiddleware.trackMachineOperation,
  ShiftMiddleware.updateShiftData,
  asyncHandler(async (req, res) => {
  console.log('🛑 INÍCIO DO ENDPOINT END-OPERATION');
  console.log('📋 Parâmetros recebidos:', req.params);
  console.log('📋 Body recebido:', req.body);
  console.log('👤 Usuário completo:', JSON.stringify(req.user, null, 2));
  console.log('👤 Nome do usuário:', req.user?.name);
  console.log('👤 ID do usuário:', req.user?.id);
  
  const { id } = req.params;
  const { notes } = req.body;

  // Verificar se máquina existe e está disponível - buscar por ID numérico ou código
  const isNumericId = /^\d+$/.test(id);
  let machine;
  
  console.log(`🔍 Finalizando operação - ID: ${id}, É numérico: ${isNumericId}`);
  
  if (isNumericId) {
    const numericId = parseInt(id);
    console.log(`🔍 Buscando por ID numérico: ${numericId}`);
    machine = await prisma.machine.findUnique({
      where: { id: numericId },
      include: {
        operations: {
          where: { status: 'ACTIVE' }
        }
      }
    });
  } else {
    console.log(`🔍 Buscando por código: ${id}`);
    machine = await prisma.machine.findUnique({
      where: { code: id },
      include: {
        operations: {
          where: { status: 'ACTIVE' }
        }
      }
    });
  }

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  // Buscar operação ativa nesta máquina
  // Managers podem finalizar operações de qualquer usuário
  const whereCondition = {
    machineId: machine.id,
    status: 'ACTIVE'
  };
  
  // Se não for manager, só pode finalizar suas próprias operações
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    whereCondition.userId = req.user.id;
  }
  
  const operation = await prisma.machineOperation.findFirst({
    where: whereCondition,
    include: {
      machine: true,
      user: {
        select: { name: true, email: true }
      }
    }
  });

  if (!operation) {
    throw new AppError('Operação ativa não encontrada', 404, 'OPERATION_NOT_FOUND');
  }

  // Finalizar operação
  const updatedOperation = await prisma.machineOperation.update({
    where: { id: operation.id },
    data: {
      status: 'COMPLETED',
      endTime: new Date(),
      notes: notes || operation.notes
    },
    include: {
      machine: true,
      user: {
        select: { name: true, email: true }
      }
    }
  });

  // Atualizar status da máquina
  await prisma.machine.update({
    where: { id: machine.id },
    data: { status: 'STOPPED' }
  });

  // Invalidar cache
  await deleteCache(`machine:${id}`);

  // Notificar via Socket.IO
  const eventData = {
    machineId: machine.id,
    machineName: machine.name,
    operatorId: req.user.id,
    operatorName: req.user.name,
    operation: updatedOperation,
    timestamp: new Date()
  };
  
  console.log('🛑 Enviando evento machine:operation-ended:', eventData);
  req.io.emit('machine:operation-ended', eventData);

  // Enviar notificação para líderes e gestores
  try {
    const leaders = await prisma.user.findMany({
      where: {
        role: { in: ['LEADER', 'MANAGER', 'ADMIN'] },
        isActive: true
      }
    });

    const notifications = leaders.map(leader => ({
      userId: leader.id,
      title: 'Operação Finalizada',
      message: `${req.user.name} finalizou operação na máquina ${operation.machine.name}`,
      type: 'MACHINE_STATUS',
      priority: 'MEDIUM',
      data: {
        machineId: operation.machine.id,
        operatorId: req.user.id,
        operationId: updatedOperation.id,
        action: 'operation_ended'
      }
    }));

    await prisma.notification.createMany({
      data: notifications
    });
  } catch (notificationError) {
    console.error('Erro ao enviar notificação de fim de operação:', notificationError);
  }

  res.json({
    success: true,
    message: 'Operação finalizada com sucesso',
    data: updatedOperation
  });
}));

// @desc    Obter configurações da máquina
// @route   GET /api/machines/:id/config
// @access  Private (Manager+)
router.get('/:id/config', requireLeader, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `machine-config:${id}`;

  // Tentar buscar do cache
  let config = await getCache(cacheKey);
  
  if (!config) {
    // Tentar buscar por ID numérico primeiro, depois por código
    const isNumericId = /^\d+$/.test(id);
    let machine;
    
    if (isNumericId) {
      machine = await prisma.machine.findUnique({
        where: { id: parseInt(id) },
        include: { config: true }
      });
    } else {
      machine = await prisma.machine.findUnique({
        where: { code: id },
        include: { config: true }
      });
    }

    if (!machine) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }

    // Buscar configuração da máquina
    config = machine.config;

    // Se não há configuração, criar uma padrão
    if (!config) {
      const defaultConfigData = {
        general: JSON.stringify({
          name: machine.name,
          model: machine.model || '',
          location: machine.location || '',
          capacity: '',
          description: machine.description || ''
        }),
        operational: JSON.stringify({
          maxTemperature: null, // Será configurado pelo administrador
          minTemperature: null,
          maxPressure: null,
          minPressure: null,
          cycleTime: null,
          maintenanceInterval: null,
          qualityCheckInterval: null
        }),
        alerts: JSON.stringify({
          temperatureAlert: true,
          pressureAlert: true,
          maintenanceAlert: true,
          qualityAlert: true,
          teflonAlert: true,
          emailNotifications: true,
          smsNotifications: false
        }),
        quality: JSON.stringify({
          defectThreshold: null, // Será configurado pelo administrador
          autoReject: false,
          requirePhotos: true,
          minSampleSize: null
        }),
        maintenance: JSON.stringify({
          preventiveEnabled: true,
          predictiveEnabled: false,
          autoSchedule: false,
          reminderDays: null
        })
      };
      
      // Usar Prisma para criar configuração
      config = await prisma.machineConfig.create({
        data: {
          machineId: machine.id,
          ...defaultConfigData
        }
      });
      
      // Converter strings JSON de volta para objetos
      config.general = JSON.parse(config.general);
      config.operational = JSON.parse(config.operational);
      config.alerts = JSON.parse(config.alerts);
      config.quality = JSON.parse(config.quality);
      config.maintenance = JSON.parse(config.maintenance);
    } else {
      // Converter strings JSON para objetos se a configuração já existe
      if (typeof config.general === 'string') config.general = JSON.parse(config.general);
      if (typeof config.operational === 'string') config.operational = JSON.parse(config.operational);
      if (typeof config.alerts === 'string') config.alerts = JSON.parse(config.alerts);
      if (typeof config.quality === 'string') config.quality = JSON.parse(config.quality);
      if (typeof config.maintenance === 'string') config.maintenance = JSON.parse(config.maintenance);
    }
  }

  // Cache por 10 minutos
  await setCache(cacheKey, config, 600);

  res.json({
    success: true,
    data: {
      machine: {
        id: id,
        name: config.general?.name || 'Máquina',
        model: config.general?.model || '',
        location: config.general?.location || ''
      },
      config: {
        general: config.general || {},
        operational: config.operational || {},
        alerts: config.alerts || {},
        quality: config.quality || {},
        maintenance: config.maintenance || {}
      }
    }
  });
}));

// @desc    Atualizar configurações da máquina
// @route   PUT /api/machines/:id/config
// @access  Private (Manager+)
router.put('/:id/config', [
  body('general').optional().isObject().withMessage('Configurações gerais devem ser um objeto'),
  body('operational').optional().isObject().withMessage('Configurações operacionais devem ser um objeto'),
  body('alerts').optional().isObject().withMessage('Configurações de alertas devem ser um objeto'),
  body('quality').optional().isObject().withMessage('Configurações de qualidade devem ser um objeto'),
  body('maintenance').optional().isObject().withMessage('Configurações de manutenção devem ser um objeto')
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
  const { general, operational, alerts, quality, maintenance } = req.body;

  // Verificar se máquina existe - buscar por ID numérico ou código
  const isNumericId = /^\d+$/.test(id);
  let machine;
  
  if (isNumericId) {
    machine = await prisma.machine.findUnique({
      where: { id: parseInt(id) },
      include: { config: true }
    });
  } else {
    machine = await prisma.machine.findUnique({
      where: { code: id },
      include: { config: true }
    });
  }

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  // Preparar dados de atualização
  const updateData = {};
  if (general) updateData.general = general;
  if (operational) updateData.operational = operational;
  if (alerts) updateData.alerts = alerts;
  if (quality) updateData.quality = quality;
  if (maintenance) updateData.maintenance = maintenance;

  // Converter strings JSON para objetos se necessário
  const configData = {};
  if (general) configData.general = JSON.stringify(general);
  if (operational) configData.operational = JSON.stringify(operational);
  if (alerts) configData.alerts = JSON.stringify(alerts);
  if (quality) configData.quality = JSON.stringify(quality);
  if (maintenance) configData.maintenance = JSON.stringify(maintenance);

  let config;
  if (machine.config) {
    // Atualizar configuração existente
    config = await prisma.machineConfig.update({
      where: { machineId: machine.id },
      data: configData
    });
  } else {
    // Criar nova configuração
    config = await prisma.machineConfig.create({
      data: {
        machineId: machine.id,
        ...configData
      }
    });
  }

  // Atualizar dados básicos da máquina se fornecidos
  if (general) {
    const machineUpdateData = {};
    if (general.name) machineUpdateData.name = general.name;
    if (general.model) machineUpdateData.model = general.model;
    if (general.location) machineUpdateData.location = general.location;
    if (general.description) machineUpdateData.description = general.description;

    if (Object.keys(machineUpdateData).length > 0) {
      await prisma.machine.update({
        where: { id: machine.id },
        data: machineUpdateData
      });
    }
  }

  // Log da ação
  try {
    await prisma.systemLog.create({
      data: {
        action: 'MACHINE_CONFIG_UPDATED',
        userId: req.user.id,
        details: JSON.stringify({ machineId: id, changes: updateData }),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
  } catch (logError) {
    console.error('Erro ao criar log:', logError);
    // Não falhar a operação por causa do log
  }

  // Invalidar cache
  await deleteCache(`machine-config:${machine.id}`);
  await deleteCache(`machine-config:${id}`);
  await deleteCache(`machine:${machine.id}`);
  await deleteCache(`machine:${id}`);
  await deleteCache('machines:all:all');

  // Notificar via Socket.IO
  req.io.emit('machine:config-updated', {
    machineId: machine.id,
    config,
    user: req.user.name
  });

  res.json({
    success: true,
    message: 'Configurações atualizadas com sucesso',
    data: config
  });
}));

// @desc    Alterar status da máquina
// @route   PUT /api/machines/:id/status
// @access  Private (Operator+)
router.put('/:id/status', [
  requireOperator,
  param('id').isInt().withMessage('ID da máquina deve ser um número'),
  body('status').isIn(['FUNCIONANDO', 'PARADA', 'MANUTENCAO', 'FORA_DE_TURNO']).withMessage('Status deve ser FUNCIONANDO, PARADA, MANUTENCAO ou FORA_DE_TURNO'),
  body('reason').optional().isString().withMessage('Motivo deve ser uma string'),
  body('notes').optional().isString().withMessage('Observações devem ser uma string')
], 
  ShiftMiddleware.checkShiftChange,
  ShiftMiddleware.trackMachineOperation,
  ShiftMiddleware.updateShiftData,
  asyncHandler(async (req, res) => {
  console.log('🚀 Iniciando PUT /:id/status - req.user:', req.user);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Dados inválidos', 400, errors.array());
  }

  const { id } = req.params;
  const { status, reason, notes } = req.body;
  
  // Mapear IDs de teste para números inteiros válidos
  const testUserIdMap = {
    '507f1f77bcf86cd799439011': 1, // Operador
    '507f1f77bcf86cd799439012': 2, // Líder
    '507f1f77bcf86cd799439013': 3, // Gestor
    '507f1f77bcf86cd799439014': 4  // Admin
  };
  
  let userId = req.user.id;
  console.log('🔍 Debug - userId original:', req.user.id, 'tipo:', typeof req.user.id);
  console.log('🔍 Debug - testUserIdMap[userId]:', testUserIdMap[userId]);
  
  if (typeof userId === 'string' && testUserIdMap[userId]) {
    userId = testUserIdMap[userId];
    console.log('🔍 Debug - userId mapeado para:', userId);
  } else if (typeof userId === 'string') {
    userId = parseInt(userId);
    console.log('🔍 Debug - userId convertido com parseInt:', userId);
  }
  
  console.log('🔍 Debug - userId final:', userId, 'tipo:', typeof userId);

  // Verificar se a máquina existe
  const machine = await prisma.machine.findUnique({
    where: { id: parseInt(id) }
  });

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404);
  }

  const previousStatus = machine.status;

  // Atualizar status da máquina
  const updatedMachine = await prisma.machine.update({
    where: { id: parseInt(id) },
    data: { status }
  });

  // Registrar histórico de mudança de status
  await prisma.machineStatusHistory.create({
    data: {
      machineId: parseInt(id),
      userId,
      previousStatus,
      newStatus: status,
      reason,
      notes
    }
  });

  // Invalidar cache
  await deleteCache(`machine:${id}`);
  await deleteCache('machines:all:all');
  await deleteCache(`machine-production-current-shift:${id}`);
  await deleteCache(`machine-production-current-shift:${id}`);
  await deleteCache(`machine-production:${id}`);
  await deleteCache(`machine-production-daily:${id}`);
  await deleteCache(`machines:${status}:all`);
  if (previousStatus) {
    await deleteCache(`machines:${previousStatus}:all`);
  }

  // Notificar via Socket.IO
  req.io.emit('machine:status:changed', {
    machineId: parseInt(id),
    machineName: machine.name,
    previousStatus,
    newStatus: status,
    user: req.user.name,
    reason,
    notes
  });

  // Enviar notificação para líderes e gestores
  console.log('🔔 Iniciando envio de notificação de status...');
  console.log('📋 Parâmetros:', { id: parseInt(id), status, previousStatus, operatorName: req.user.name, reason, notes });
  
  try {
    console.log('🚀 Chamando sendMachineStatusNotification...');
    const result = await notificationService.sendMachineStatusNotification(
      parseInt(id),
      status,
      previousStatus,
      req.user.name,
      reason,
      notes
    );
    console.log('✅ Resultado da notificação:', result);
  } catch (notificationError) {
    console.error('❌ Erro ao enviar notificação de status:', notificationError);
    console.error('❌ Stack trace:', notificationError.stack);
    // Não falhar a operação por causa da notificação
  }
  
  console.log('🏁 Finalizando processamento de notificação...');

  res.json({
    success: true,
    message: 'Status da máquina alterado com sucesso',
    data: {
      machine: updatedMachine,
      previousStatus,
      newStatus: status
    }
  });
}));

// @desc    Configurar velocidade de produção da máquina
// @route   PUT /api/machines/:id/production-speed
// @access  Private (Leader+)
router.put('/:id/production-speed', [
  requireLeader,
  param('id').isInt().withMessage('ID da máquina deve ser um número'),
  body('productionSpeed').isFloat({ min: 0 }).withMessage('Velocidade de produção deve ser um número positivo'),
  body('targetProduction').optional().isFloat({ min: 0 }).withMessage('Meta de produção deve ser um número positivo')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Dados inválidos', 400, errors.array());
  }

  const { id } = req.params;
  const { productionSpeed, targetProduction } = req.body;

  // Verificar se a máquina existe
  const machine = await prisma.machine.findUnique({
    where: { id: parseInt(id) }
  });

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404);
  }

  // Atualizar velocidade de produção
  const updatedMachine = await prisma.machine.update({
    where: { id: parseInt(id) },
    data: {
      productionSpeed,
      ...(targetProduction !== undefined && { targetProduction })
    }
  });

  // Invalidar cache
  await deleteCache(`machine:${id}`);
  await deleteCache('machines:all:all');

  // Notificar via Socket.IO
  req.io.emit('machine:production-speed-updated', {
    machineId: parseInt(id),
    productionSpeed,
    targetProduction,
    user: req.user.name
  });

  res.json({
    success: true,
    message: 'Velocidade de produção configurada com sucesso',
    data: updatedMachine
  });
}));

// @desc    Obter histórico de status da máquina
// @route   GET /api/machines/:id/status-history
// @access  Private (Operator+)
router.get('/:id/status-history', [
  requireOperator,
  param('id').isInt().withMessage('ID da máquina deve ser um número')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Dados inválidos', 400, errors.array());
  }

  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const cacheKey = `machine-status-history:${id}:${page}:${limit}`;
  let history = await getCache(cacheKey);

  if (!history) {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [statusHistory, total] = await Promise.all([
      prisma.machineStatusHistory.findMany({
        where: { machineId: parseInt(id) },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.machineStatusHistory.count({
        where: { machineId: parseInt(id) }
      })
    ]);

    history = {
      data: statusHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };

    // Cache por 2 minutos
    await setCache(cacheKey, history, 120);
  }

  res.json({
    success: true,
    message: 'Histórico de status obtido com sucesso',
    ...history
  });
}));

// Endpoint para calcular produção de uma máquina em período específico
router.get('/:id/production', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime } = req.query;

  if (!startTime || !endTime) {
    throw new AppError('Parâmetros startTime e endTime são obrigatórios', 400);
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError('Formato de data inválido', 400);
  }

  if (start >= end) {
    throw new AppError('Data de início deve ser anterior à data de fim', 400);
  }

  const machineId = parseInt(id);
  if (isNaN(machineId)) {
    throw new AppError('ID da máquina inválido', 400);
  }

  const production = await calculateProduction(machineId, start, end);

  res.json({
    success: true,
    message: 'Produção calculada com sucesso',
    data: production
  });
}));

// Endpoint para calcular produção do turno atual
router.get('/:id/production/current-shift', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const machineId = parseInt(id);
  
  if (isNaN(machineId)) {
    throw new AppError('ID da máquina inválido', 400);
  }

  // Cache com TTL de 5 segundos para dados de produção em tempo real
  const cacheKey = `machine-production-current-shift:${machineId}`;
  let production = await getCache(cacheKey);

  if (!production) {
    production = await calculateCurrentShiftProduction(machineId);
    // Cache por 5 segundos para dados mais atualizados
    await setCache(cacheKey, production, 5);
  }

  res.json({
    success: true,
    message: 'Produção do turno atual calculada com sucesso',
    data: production
  });
}));

// Endpoint para calcular produção diária
router.get('/:id/production/daily', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  
  const machineId = parseInt(id);
  if (isNaN(machineId)) {
    throw new AppError('ID da máquina inválido', 400);
  }

  let targetDate = new Date();
  if (date) {
    targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new AppError('Formato de data inválido', 400);
    }
  }

  const production = await calculateDailyProduction(machineId, targetDate);

  res.json({
    success: true,
    message: 'Produção diária calculada com sucesso',
    data: production
  });
}));

module.exports = router;