const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { publishEvent } = require('../config/redis');

const prisma = new PrismaClient();

// Armazenar conexões ativas
const activeConnections = new Map();
const userSockets = new Map(); // userId -> Set of socket IDs

// Middleware de autenticação para Socket.IO
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Token não fornecido'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar se é um dos usuários de teste
    const testUsers = {
      '507f1f77bcf86cd799439011': {
        id: '507f1f77bcf86cd799439011',
        email: 'operador@zara.com',
        name: 'Operador Teste',
        role: 'OPERATOR',
        isActive: true
      },
      '507f1f77bcf86cd799439012': {
        id: '507f1f77bcf86cd799439012',
        email: 'leader@zara.com',
        name: 'Líder Teste',
        role: 'LEADER',
        isActive: true
      },
      '507f1f77bcf86cd799439013': {
        id: '507f1f77bcf86cd799439013',
        email: 'manager@zara.com',
        name: 'Gestor Teste',
        role: 'MANAGER',
        isActive: true
      },
      '507f1f77bcf86cd799439014': {
        id: '507f1f77bcf86cd799439014',
        email: 'admin@zara.com',
        name: 'Admin Teste',
        role: 'ADMIN',
        isActive: true
      }
    };
    
    if (testUsers[decoded.id]) {
      socket.user = testUsers[decoded.id];
      return next();
    }
    
    // Buscar usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return next(new Error('Usuário não encontrado ou inativo'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Token inválido'));
  }
};

// Gerenciar salas baseadas em roles
const joinRoleRooms = (socket) => {
  const { role } = socket.user;
  
  // Todos os usuários entram na sala geral
  socket.join('general');
  
  // Salas específicas por role
  socket.join(`role:${role}`);
  
  // Operadores entram na sala de operadores
  if (role === 'OPERATOR') {
    socket.join('operators');
  }
  
  // Líderes e superiores entram na sala de liderança
  if (['LEADER', 'MANAGER', 'ADMIN'].includes(role)) {
    socket.join('leadership');
  }
  
  // Gestores e admins entram na sala de gestão
  if (['MANAGER', 'ADMIN'].includes(role)) {
    socket.join('management');
  }
  
  // Sala pessoal do usuário
  socket.join(`user:${socket.user.id}`);
};

// Atualizar status de usuário online
const updateUserStatus = async (userId, isOnline) => {
  try {
    // Não atualizar usuários de teste
    const testUserIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'];
    if (testUserIds.includes(userId)) {
      return;
    }
    
    // Validar se o userId é válido
    const userIdInt = parseInt(userId);
    if (!userId || isNaN(userIdInt) || userIdInt <= 0) {
      console.warn('ID de usuário inválido:', userId);
      return;
    }
    
    // Note: lastSeen field doesn't exist in schema
    // await prisma.user.update({
    //   where: { id: userIdInt },
    //   data: { 
    //     lastSeen: new Date()
    //   }
    // });
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
  }
};

// Handler principal do Socket.IO
const socketHandler = (io) => {
  // Middleware de autenticação
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { user } = socket;
    console.log(`Usuário conectado: ${user.name} (${user.email}) - Socket: ${socket.id}`);

    // Armazenar conexão
    activeConnections.set(socket.id, {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      connectedAt: new Date()
    });

    // Mapear usuário para sockets
    if (!userSockets.has(user.id)) {
      userSockets.set(user.id, new Set());
    }
    userSockets.get(user.id).add(socket.id);

    // Entrar nas salas apropriadas
    joinRoleRooms(socket);

    // Atualizar status online
    updateUserStatus(user.id, true);

    // Notificar outros usuários sobre conexão (apenas para liderança)
    socket.to('leadership').emit('user:connected', {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      timestamp: new Date()
    });

    // Enviar dados iniciais
    socket.emit('connection:established', {
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      timestamp: new Date()
    });

    // === EVENTOS DE MÁQUINAS ===
    
    // Atualização de status de máquina
    socket.on('machine:status:update', async (data) => {
      try {
        const { machineId, status } = data;
        
        // Verificar permissões
        if (!['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'].includes(user.role)) {
          socket.emit('error', { message: 'Sem permissão para atualizar status de máquina' });
          return;
        }

        // Atualizar no banco
        const machine = await prisma.machine.update({
          where: { id: machineId },
          data: { status },
          include: {
            operations: {
              where: { status: 'RUNNING' },
              include: { user: { select: { name: true } } }
            }
          }
        });

        // Notificar todos os usuários
        io.emit('machine:status:changed', {
          machineId,
          machineName: machine.name,
          status,
          updatedBy: user.name,
          timestamp: new Date(),
          currentOperation: machine.operations[0] || null
        });

        // Publicar no Redis para outros serviços
        await publishEvent('machine:status:changed', {
          machineId,
          status,
          updatedBy: user.id,
          timestamp: new Date()
        });

        // Broadcast atualização de produção em tempo real
        if (status === 'FUNCIONANDO' || status === 'PARADA' || status === 'MANUTENCAO') {
          io.emit('production:update', {
            machineId,
            status,
            timestamp: new Date()
          });
        }

      } catch (error) {
        socket.emit('error', { message: 'Erro ao atualizar status da máquina' });
      }
    });

    // === EVENTOS DE OPERAÇÕES ===
    
    // Início de operação
    socket.on('operation:start', async (data) => {
      try {
        const { machineId } = data;
        
        if (user.role !== 'OPERATOR') {
          socket.emit('error', { message: 'Apenas operadores podem iniciar operações' });
          return;
        }

        // Buscar máquina
        const machine = await prisma.machine.findUnique({
          where: { id: machineId }
        });

        if (!machine) {
          socket.emit('error', { message: 'Máquina não encontrada' });
          return;
        }

        // Atualizar status da máquina para FUNCIONANDO
        await prisma.machine.update({
          where: { id: machineId },
          data: { status: 'FUNCIONANDO' }
        });

        // Notificar todos sobre mudança de status
        io.emit('machine:status:changed', {
          machineId,
          machineName: machine.name,
          status: 'FUNCIONANDO',
          updatedBy: user.name,
          timestamp: new Date()
        });

        // Emitir evento de atualização de produção
        io.emit('production:update', {
          machineId,
          status: 'FUNCIONANDO',
          timestamp: new Date()
        });

        // Notificar liderança sobre operação iniciada
        socket.to('leadership').emit('operation:started', {
          machineId,
          machineName: machine.name,
          operatorId: user.id,
          operatorName: user.name,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Erro ao processar início de operação' });
      }
    });

    // === EVENTOS DE TESTES DE QUALIDADE ===
    
    // Teste de qualidade criado
    socket.on('quality-test:created', async (data) => {
      try {
        const { testId, machineId, approved } = data;
        
        // Buscar dados completos
        const test = await prisma.qualityTest.findUnique({
          where: { id: testId },
          include: {
            machine: { select: { name: true } },
            user: { select: { name: true } }
          }
        });

        if (!test) return;

        // Notificar liderança
        socket.to('leadership').emit('quality-test:new', {
          testId,
          machineId,
          machineName: test.machine.name,
          operatorName: test.user.name,
          approved,
          timestamp: new Date()
        });

        // Se reprovado, notificar com prioridade
        if (!approved) {
          socket.to('leadership').emit('quality-test:failed', {
            testId,
            machineId,
            machineName: test.machine.name,
            operatorName: test.user.name,
            timestamp: new Date()
          });
        }

      } catch (error) {
        console.error('Erro ao processar teste de qualidade:', error);
      }
    });

    // === EVENTOS DE TEFLON ===
    
    // Alerta de teflon expirando
    socket.on('teflon:expiring:check', async () => {
      try {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const expiringTeflon = await prisma.teflonChange.findMany({
          where: {
            expiryDate: {
              gte: now,
              lte: sevenDaysFromNow
            },
            alertSent: false
          },
          include: {
            machine: { select: { name: true } }
          }
        });

        if (expiringTeflon.length > 0) {
          // Notificar operadores
          socket.to('operators').emit('teflon:expiring:alert', {
            count: expiringTeflon.length,
            items: expiringTeflon.map(t => ({
              machineId: t.machineId,
              machineName: t.machine.name,
              expiryDate: t.expiryDate,
              daysLeft: Math.ceil((t.expiryDate - now) / (1000 * 60 * 60 * 24))
            })),
            timestamp: new Date()
          });

          // Notificar liderança
          socket.to('leadership').emit('teflon:expiring:summary', {
            count: expiringTeflon.length,
            timestamp: new Date()
          });
        }

      } catch (error) {
        console.error('Erro ao verificar teflon expirando:', error);
      }
    });

    // === EVENTOS DE NOTIFICAÇÕES ===
    
    // Marcar notificação como lida
    socket.on('notification:read', async (data) => {
      try {
        const { notificationId } = data;
        
        await prisma.notification.update({
          where: {
            id: notificationId,
            userId: user.id
          },
          data: {
            read: true,
            readAt: new Date()
          }
        });

        socket.emit('notification:read:confirmed', { notificationId });

      } catch (error) {
        socket.emit('error', { message: 'Erro ao marcar notificação como lida' });
      }
    });

    // === EVENTOS DE CHAT/COMUNICAÇÃO ===
    
    // Mensagem para sala específica
    socket.on('message:send', async (data) => {
      try {
        const { room, message, type = 'text' } = data;
        
        // Validar permissões para a sala
        const allowedRooms = {
          'general': ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
          'operators': ['OPERATOR'],
          'leadership': ['LEADER', 'MANAGER', 'ADMIN'],
          'management': ['MANAGER', 'ADMIN']
        };

        if (!allowedRooms[room] || !allowedRooms[room].includes(user.role)) {
          socket.emit('error', { message: 'Sem permissão para enviar mensagem nesta sala' });
          return;
        }

        const messageData = {
          id: Date.now().toString(),
          room,
          message,
          type,
          sender: {
            id: user.id,
            name: user.name,
            role: user.role
          },
          timestamp: new Date()
        };

        // Enviar para a sala
        socket.to(room).emit('message:received', messageData);
        
        // Confirmar envio
        socket.emit('message:sent', messageData);

      } catch (error) {
        socket.emit('error', { message: 'Erro ao enviar mensagem' });
      }
    });

    // === EVENTOS DE SISTEMA ===
    
    // Ping/Pong para manter conexão
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Solicitar estatísticas em tempo real
    socket.on('stats:request', async () => {
      try {
        if (!['LEADER', 'MANAGER', 'ADMIN'].includes(user.role)) {
          socket.emit('error', { message: 'Sem permissão para acessar estatísticas' });
          return;
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [activeMachines, runningOperations, todayTests, pendingNotifications] = await Promise.all([
          prisma.machine.count({ where: { isActive: true } }),
          prisma.machineOperation.count({ where: { status: 'RUNNING' } }),
          prisma.qualityTest.count({ where: { createdAt: { gte: today } } }),
          prisma.notification.count({ where: { read: false } })
        ]);

        socket.emit('stats:update', {
          activeMachines,
          runningOperations,
          todayTests,
          pendingNotifications,
          onlineUsers: activeConnections.size,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Erro ao buscar estatísticas' });
      }
    });

    // === EVENTOS DE DESCONEXÃO ===
    
    socket.on('disconnect', (reason) => {
      console.log(`Usuário desconectado: ${user.name} - Motivo: ${reason}`);
      
      // Remover da lista de conexões ativas
      activeConnections.delete(socket.id);
      
      // Remover do mapeamento de usuário
      if (userSockets.has(user.id)) {
        userSockets.get(user.id).delete(socket.id);
        if (userSockets.get(user.id).size === 0) {
          userSockets.delete(user.id);
          // Atualizar status offline apenas se não há outras conexões
          updateUserStatus(user.id, false);
        }
      }

      // Notificar liderança sobre desconexão
      socket.to('leadership').emit('user:disconnected', {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        reason,
        timestamp: new Date()
      });
    });

    // Tratamento de erros
    socket.on('error', (error) => {
      console.error(`Erro no socket ${socket.id}:`, error);
    });
  });

  // Função para enviar notificação para usuário específico
  io.sendToUser = (userId, event, data) => {
    if (userSockets.has(userId)) {
      userSockets.get(userId).forEach(socketId => {
        io.to(socketId).emit(event, data);
      });
    }
  };

  // Função para enviar para role específico
  io.sendToRole = (role, event, data) => {
    io.to(`role:${role}`).emit(event, data);
  };

  // Função para obter estatísticas de conexões
  io.getConnectionStats = () => {
    const stats = {
      totalConnections: activeConnections.size,
      uniqueUsers: userSockets.size,
      byRole: {}
    };

    activeConnections.forEach(conn => {
      if (!stats.byRole[conn.userRole]) {
        stats.byRole[conn.userRole] = 0;
      }
      stats.byRole[conn.userRole]++;
    });

    return stats;
  };

  return io;
};

module.exports = socketHandler;