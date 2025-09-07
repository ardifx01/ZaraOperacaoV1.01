const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body, param, query } = require('express-validator');
const NodeCache = require('node-cache');

const router = express.Router();
const prisma = new PrismaClient();
const cache = new NodeCache({ stdTTL: 300 }); // Cache por 5 minutos

// Middleware para verificar se o usuário pode gerenciar permissões
const canManagePermissions = (req, res, next) => {
  if (!['MANAGER', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas gestores e administradores podem gerenciar permissões.'
    });
  }
  next();
};

// GET /api/permissions - Listar todas as permissões
router.get('/', 
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
    query('userId').optional().isInt().withMessage('ID do usuário deve ser um número'),
    query('machineId').optional().isInt().withMessage('ID da máquina deve ser um número'),
    query('search').optional().isString().withMessage('Busca deve ser uma string')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { page = 1, limit = 10, userId, machineId, search } = req.query;
      const skip = (page - 1) * limit;

      // Verificar permissões de acesso
      if (req.user.role === 'OPERATOR') {
        // Operadores só podem ver suas próprias permissões
        if (userId && parseInt(userId) !== req.user.id) {
          return res.status(403).json({
            success: false,
            message: 'Operadores só podem visualizar suas próprias permissões'
          });
        }
        // Se não especificou userId, forçar para o próprio usuário
        if (!userId) {
          const userPermissions = await prisma.machinePermission.findMany({
            where: { userId: req.user.id },
            include: {
              machine: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  status: true,
                  location: true
                }
              }
            }
          });
          
          return res.json({
            success: true,
            data: userPermissions
          });
        }
      } else if (!['MANAGER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado. Apenas gestores e administradores podem gerenciar permissões.'
        });
      }

      // Construir filtros
      const where = {};
      if (userId) where.userId = parseInt(userId);
      if (machineId) where.machineId = parseInt(machineId);
      
      // Filtro de busca por nome do usuário ou máquina
      if (search) {
        where.OR = [
          {
            user: {
              name: {
                contains: search,
                mode: 'insensitive'
              }
            }
          },
          {
            machine: {
              name: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        ];
      }

      const [permissions, total] = await Promise.all([
        prisma.machinePermission.findMany({
          where,
          skip: parseInt(skip),
          take: parseInt(limit),
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                badgeNumber: true
              }
            },
            machine: {
              select: {
                id: true,
                name: true,
                code: true,
                status: true,
                location: true
              }
            }
          },
          orderBy: [
            { createdAt: 'desc' }
          ]
        }),
        prisma.machinePermission.count({ where })
      ]);

      res.json({
        success: true,
        data: permissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/permissions/user/:userId - Obter permissões de um usuário específico
router.get('/user/:userId',
  authenticateToken,
  canManagePermissions,
  [
    param('userId').isInt().withMessage('ID do usuário deve ser um número')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const cacheKey = `user_permissions_${userId}`;
      
      // Verificar cache
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Verificar se o usuário existe
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: { id: true, name: true, email: true, role: true }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      const permissions = await prisma.machinePermission.findMany({
        where: { userId: parseInt(userId) },
        include: {
          machine: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true,
              location: true
            }
          }
        },
        orderBy: { machine: { name: 'asc' } }
      });

      const result = {
        user,
        permissions
      };

      // Salvar no cache
      cache.set(cacheKey, result);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Erro ao buscar permissões do usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/permissions - Criar nova permissão
router.post('/',
  authenticateToken,
  canManagePermissions,
  [
    body('userId').isInt().withMessage('ID do usuário é obrigatório'),
    body('machineId').isInt().withMessage('ID da máquina é obrigatório'),
    body('canView').optional().isBoolean().withMessage('canView deve ser um boolean'),
    body('canOperate').optional().isBoolean().withMessage('canOperate deve ser um boolean'),
    body('canEdit').optional().isBoolean().withMessage('canEdit deve ser um boolean')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId, machineId, canView = true, canOperate = false, canEdit = false } = req.body;

      // Verificar se o usuário existe
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verificar se a máquina existe
      const machine = await prisma.machine.findUnique({
        where: { id: machineId }
      });

      if (!machine) {
        return res.status(404).json({
          success: false,
          message: 'Máquina não encontrada'
        });
      }

      // Verificar se a permissão já existe
      const existingPermission = await prisma.machinePermission.findUnique({
        where: {
          userId_machineId: {
            userId,
            machineId
          }
        }
      });

      if (existingPermission) {
        return res.status(409).json({
          success: false,
          message: 'Permissão já existe para este usuário e máquina'
        });
      }

      // Criar a permissão
      const permission = await prisma.machinePermission.create({
        data: {
          userId,
          machineId,
          canView,
          canOperate,
          canEdit,
          grantedBy: req.user.id
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          machine: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true
            }
          }
        }
      });

      // Limpar cache relacionado
      cache.del(`user_permissions_${userId}`);
      cache.del(`machine_permissions_${machineId}`);

      res.status(201).json({
        success: true,
        data: permission,
        message: 'Permissão criada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao criar permissão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// PUT /api/permissions/:id - Atualizar permissão
router.put('/:id',
  authenticateToken,
  canManagePermissions,
  [
    param('id').isInt().withMessage('ID da permissão deve ser um número'),
    body('canView').optional().isBoolean().withMessage('canView deve ser um boolean'),
    body('canOperate').optional().isBoolean().withMessage('canOperate deve ser um boolean'),
    body('canEdit').optional().isBoolean().withMessage('canEdit deve ser um boolean')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { canView, canOperate, canEdit } = req.body;

      // Verificar se a permissão existe
      const existingPermission = await prisma.machinePermission.findUnique({
        where: { id: parseInt(id) },
        include: {
          user: { select: { id: true, name: true } },
          machine: { select: { id: true, name: true } }
        }
      });

      if (!existingPermission) {
        return res.status(404).json({
          success: false,
          message: 'Permissão não encontrada'
        });
      }

      // Atualizar a permissão
      const updatedPermission = await prisma.machinePermission.update({
        where: { id: parseInt(id) },
        data: {
          ...(canView !== undefined && { canView }),
          ...(canOperate !== undefined && { canOperate }),
          ...(canEdit !== undefined && { canEdit })
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          machine: {
            select: {
              id: true,
              name: true,
              code: true,
              status: true
            }
          }
        }
      });

      // Limpar cache relacionado
      cache.del(`user_permissions_${existingPermission.userId}`);
      cache.del(`machine_permissions_${existingPermission.machineId}`);

      res.json({
        success: true,
        data: updatedPermission,
        message: 'Permissão atualizada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// DELETE /api/permissions/:id - Remover permissão
router.delete('/:id',
  authenticateToken,
  canManagePermissions,
  [
    param('id').isInt().withMessage('ID da permissão deve ser um número')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar se a permissão existe
      const existingPermission = await prisma.machinePermission.findUnique({
        where: { id: parseInt(id) }
      });

      if (!existingPermission) {
        return res.status(404).json({
          success: false,
          message: 'Permissão não encontrada'
        });
      }

      // Remover a permissão
      await prisma.machinePermission.delete({
        where: { id: parseInt(id) }
      });

      // Limpar cache relacionado
      cache.del(`user_permissions_${existingPermission.userId}`);
      cache.del(`machine_permissions_${existingPermission.machineId}`);

      res.json({
        success: true,
        message: 'Permissão removida com sucesso'
      });
    } catch (error) {
      console.error('Erro ao remover permissão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/permissions/bulk - Criar múltiplas permissões
router.post('/bulk',
  authenticateToken,
  canManagePermissions,
  [
    body('permissions').isArray().withMessage('Permissões devem ser um array'),
    body('permissions.*.userId').isInt().withMessage('ID do usuário é obrigatório'),
    body('permissions.*.machineId').isInt().withMessage('ID da máquina é obrigatório'),
    body('permissions.*.canView').optional().isBoolean(),
    body('permissions.*.canOperate').optional().isBoolean(),
    body('permissions.*.canEdit').optional().isBoolean()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { permissions } = req.body;

      // Validar se todos os usuários e máquinas existem
      const userIds = [...new Set(permissions.map(p => p.userId))];
      const machineIds = [...new Set(permissions.map(p => p.machineId))];

      const [users, machines] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true }
        }),
        prisma.machine.findMany({
          where: { id: { in: machineIds } },
          select: { id: true }
        })
      ]);

      const existingUserIds = users.map(u => u.id);
      const existingMachineIds = machines.map(m => m.id);

      // Verificar se todos os IDs existem
      const invalidUserIds = userIds.filter(id => !existingUserIds.includes(id));
      const invalidMachineIds = machineIds.filter(id => !existingMachineIds.includes(id));

      if (invalidUserIds.length > 0 || invalidMachineIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'IDs inválidos encontrados',
          details: {
            invalidUserIds,
            invalidMachineIds
          }
        });
      }

      // Criar as permissões
      const createdPermissions = await prisma.$transaction(
        permissions.map(permission => 
          prisma.machinePermission.upsert({
            where: {
              userId_machineId: {
                userId: permission.userId,
                machineId: permission.machineId
              }
            },
            update: {
              canView: permission.canView ?? true,
              canOperate: permission.canOperate ?? false,
              canEdit: permission.canEdit ?? false,
              grantedBy: req.user.id
            },
            create: {
              userId: permission.userId,
              machineId: permission.machineId,
              canView: permission.canView ?? true,
              canOperate: permission.canOperate ?? false,
              canEdit: permission.canEdit ?? false,
              grantedBy: req.user.id
            }
          })
        )
      );

      // Limpar cache relacionado
      userIds.forEach(userId => cache.del(`user_permissions_${userId}`));
      machineIds.forEach(machineId => cache.del(`machine_permissions_${machineId}`));

      res.status(201).json({
        success: true,
        data: createdPermissions,
        message: `${createdPermissions.length} permissões processadas com sucesso`
      });
    } catch (error) {
      console.error('Erro ao criar permissões em lote:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/permissions/operators - Listar operadores para seleção
router.get('/operators',
  authenticateToken,
  canManagePermissions,
  async (req, res) => {
    try {
      const operators = await prisma.user.findMany({
        where: {
          role: 'OPERATOR',
          isActive: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          badgeNumber: true,
          _count: {
            select: {
              machinePermissions: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      res.json({
        success: true,
        data: operators
      });
    } catch (error) {
      console.error('Erro ao buscar operadores:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/permissions/machines - Listar máquinas para seleção
router.get('/machines',
  authenticateToken,
  canManagePermissions,
  async (req, res) => {
    try {
      const machines = await prisma.machine.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          name: true,
          code: true,
          location: true,
          status: true,
          _count: {
            select: {
              permissions: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      res.json({
        success: true,
        data: machines
      });
    } catch (error) {
      console.error('Erro ao buscar máquinas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;