const emailService = require('./emailService');
const pushService = require('./pushService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class NotificationService {
  constructor() {
    this.emailEnabled = !!process.env.EMAIL_USER;
    this.pushEnabled = !!process.env.FIREBASE_PROJECT_ID;
    this.io = null; // Socket.IO instance
    
    console.log(`📧 Email notifications: ${this.emailEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`📱 Push notifications: ${this.pushEnabled ? 'Enabled' : 'Disabled'}`);
  }

  // Método para definir a instância do Socket.IO
  setSocketIO(io) {
    this.io = io;
    console.log('🔌 Socket.IO configurado no NotificationService');
  }

  async getUserEmailsByRole(roles) {
    try {
      const users = await prisma.user.findMany({
        where: {
          role: {
            in: Array.isArray(roles) ? roles : [roles]
          },
          active: true,
          email: {
            not: null
          }
        },
        select: {
          email: true,
          name: true,
          role: true
        }
      });

      return users.map(user => user.email).filter(email => email);
    } catch (error) {
      console.error('❌ Erro ao buscar emails dos usuários:', error);
      return [];
    }
  }

  async getUsersByRole(roles) {
    try {
      console.log('👥 Buscando usuários por role:', roles);
      
      const users = await prisma.user.findMany({
        where: {
          role: {
            in: Array.isArray(roles) ? roles : [roles]
          },
          isActive: true
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      });

      console.log(`📊 Usuários encontrados: ${users.length}`);
      users.forEach(user => {
        console.log(`   - ${user.name} (${user.role}) - ID: ${user.id} - Email: ${user.email}`);
      });
      
      return users;
    } catch (error) {
      console.error('❌ Erro ao buscar usuários por papel:', error);
      console.error('❌ Stack trace:', error.stack);
      return [];
    }
  }

  async saveNotification(data) {
    try {
      console.log('💾 Salvando notificação no banco...');
      console.log('📋 Dados recebidos:', JSON.stringify(data, null, 2));
      
      const notificationData = {
        type: data.type,
        title: data.title,
        message: data.message,
        userId: data.userId || null,
        machineId: data.machineId || null,
        testId: data.testId || null,
        changeId: data.changeId || null,
        priority: data.priority || 'MEDIUM',
        channels: Array.isArray(data.channels) ? JSON.stringify(data.channels) : JSON.stringify(['SYSTEM']),
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        read: false
      };
      
      console.log('🔄 Dados preparados para o Prisma:', JSON.stringify(notificationData, null, 2));
      
      const notification = await prisma.notification.create({
        data: notificationData
      });

      console.log('✅ Notificação salva com sucesso - ID:', notification.id);
      
      // Emitir evento WebSocket para notificação em tempo real
      if (this.io) {
        console.log('📡 Emitindo notificação via WebSocket...');
        
        // Emitir para usuário específico se houver userId
        if (data.userId) {
          this.io.to(`user:${data.userId}`).emit('new-notification', notification);
        } else {
          // Emitir para todos os usuários baseado no tipo de notificação
          if (data.type === 'QUALITY_TEST' || data.type === 'MACHINE_STATUS') {
            this.io.to('leadership').emit('new-notification', notification);
          } else if (data.type === 'TEFLON_CHANGE') {
            this.io.to('operators').emit('new-notification', notification);
            this.io.to('leadership').emit('new-notification', notification);
          } else {
            // Notificação geral para todos
            this.io.emit('new-notification', notification);
          }
        }
      } else {
        console.log('⚠️ Socket.IO não configurado - notificação não enviada em tempo real');
      }
      
      return notification;
    } catch (error) {
      console.error('❌ Erro ao salvar notificação:', error);
      console.error('❌ Código do erro:', error.code);
      console.error('❌ Mensagem do erro:', error.message);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Dados da notificação:', JSON.stringify(data, null, 2));
      return null;
    }
  }

  async sendQualityTestNotification(testData) {
    try {
      console.log('📧 Enviando notificação de teste de qualidade...');
      
      // Salvar notificação no banco
      await this.saveNotification({
        type: 'QUALITY_TEST',
        title: `Teste de Qualidade ${testData.result === 'APPROVED' ? 'Aprovado' : 'Reprovado'}`,
        message: `Máquina: ${testData.machine?.name} - Resultado: ${testData.result}`,
        testId: testData.id,
        machineId: testData.machineId,
        priority: testData.result === 'REJECTED' ? 'HIGH' : 'MEDIUM',
        channels: ['EMAIL', 'PUSH', 'SYSTEM'],
        metadata: {
          result: testData.result,
          machineName: testData.machine?.name,
          operatorName: testData.user?.name
        }
      });

      const results = {};

      // Enviar email
      if (this.emailEnabled) {
        const recipients = await this.getUserEmailsByRole(['LEADER', 'MANAGER', 'ADMIN']);
        if (recipients.length > 0) {
          results.email = await emailService.sendQualityTestAlert(testData, recipients);
        }
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendQualityTestAlert(testData);
      }

      console.log('✅ Notificação de teste de qualidade enviada');
      return { success: true, results };
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de teste:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTeflonChangeNotification(changeData) {
    try {
      console.log('📧 Enviando notificação de troca de teflon...');
      
      const daysUntilExpiry = Math.ceil((new Date(changeData.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntilExpiry <= 0;
      
      // Salvar notificação no banco
      await this.saveNotification({
        type: 'TEFLON_CHANGE',
        title: isExpired ? 'Teflon Vencido' : 'Lembrete de Troca de Teflon',
        message: `${changeData.machine?.name} - ${isExpired ? 'Vencido' : `${daysUntilExpiry} dias restantes`}`,
        changeId: changeData.id,
        machineId: changeData.machineId,
        priority: isExpired ? 'HIGH' : 'MEDIUM',
        channels: ['EMAIL', 'PUSH', 'SYSTEM'],
        metadata: {
          daysUntilExpiry,
          isExpired,
          machineName: changeData.machine?.name,
          expiryDate: changeData.expiryDate
        }
      });

      const results = {};

      // Enviar email
      if (this.emailEnabled) {
        const recipients = await this.getUserEmailsByRole(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']);
        if (recipients.length > 0) {
          results.email = await emailService.sendTeflonChangeReminder(changeData, recipients);
        }
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendTeflonChangeAlert(changeData);
      }

      console.log('✅ Notificação de troca de teflon enviada');
      return { success: true, results };
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de teflon:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMachineStatusNotification(machineId, status, previousStatus, operatorName, reason, notes) {
    try {
      console.log('📧 Enviando notificação de status de máquina...');
      console.log('🏭 Parâmetros recebidos:', { machineId, status, previousStatus, operatorName, reason, notes });
      
      // Buscar dados da máquina
      const machine = await prisma.machine.findUnique({
        where: { id: machineId }
      });
      
      if (!machine) {
        console.log('❌ Máquina não encontrada');
        return { success: false, error: 'Máquina não encontrada' };
      }
      
      console.log('🏭 Dados da máquina encontrada:', JSON.stringify(machine, null, 2));
      
      // Buscar usuários que devem receber a notificação
      const targetUsers = await this.getUsersByRole(['LEADER', 'MANAGER', 'ADMIN']);
      console.log(`📋 Criando notificações para ${targetUsers.length} usuários`);
      targetUsers.forEach(user => {
        console.log(`   - ${user.name} (${user.role}) - ID: ${user.id}`);
      });
      
      if (targetUsers.length === 0) {
        console.log('⚠️ Nenhum usuário encontrado para enviar notificações');
        return { success: false, error: 'Nenhum usuário encontrado' };
      }
      
      // Criar notificação individual para cada usuário
      let createdNotifications = 0;
      for (const user of targetUsers) {
        console.log(`\n🔄 Criando notificação para: ${user.name} (ID: ${user.id})`);
        
        const notificationData = {
          type: 'MACHINE_STATUS',
          title: 'Status da Máquina Alterado',
          message: `${machine.name} - Status: ${status}${reason ? ` (${reason})` : ''}`,
          userId: user.id,
          machineId: machineId,
          priority: status === 'ERROR' || status === 'PARADA' ? 'HIGH' : 'MEDIUM',
          channels: ['EMAIL', 'PUSH', 'SYSTEM'],
          metadata: {
            status: status,
            previousStatus: previousStatus,
            machineName: machine.name,
            location: machine.location,
            operatorName: operatorName,
            reason: reason,
            notes: notes
          }
        };
        
        console.log(`📋 Dados da notificação para ${user.name}:`, JSON.stringify(notificationData, null, 2));
        
        const notification = await this.saveNotification(notificationData);
        if (notification) {
          console.log(`✅ Notificação criada com sucesso para ${user.name} - ID: ${notification.id}`);
          createdNotifications++;
        } else {
          console.log(`❌ Falha ao criar notificação para ${user.name}`);
        }
      }
      
      console.log(`📊 Notificações criadas: ${createdNotifications}/${targetUsers.length}`);

      const results = {};

      // Enviar email
      if (this.emailEnabled) {
        const recipients = await this.getUserEmailsByRole(['LEADER', 'MANAGER', 'ADMIN']);
        if (recipients.length > 0) {
          results.email = await emailService.sendMachineStatusAlert(machineData, recipients);
        }
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendMachineStatusAlert(machineData);
      }

      console.log('✅ Notificação de status de máquina enviada');
      return { success: true, results };
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de máquina:', error);
      console.error('❌ Stack trace:', error.stack);
      return { success: false, error: error.message };
    }
  }

  async sendDailyReport() {
    try {
      console.log('📊 Gerando e enviando relatório diário...');
      
      // Calcular dados do relatório
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const [qualityTests, machines, teflonChanges] = await Promise.all([
        prisma.qualityTest.findMany({
          where: {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        }),
        prisma.machine.findMany({
          where: {
            status: 'ACTIVE'
          }
        }),
        prisma.teflonChange.findMany({
          where: {
            changeDate: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        })
      ]);

      const approvedTests = qualityTests.filter(test => test.result === 'APPROVED').length;
      const rejectedTests = qualityTests.filter(test => test.result === 'REJECTED').length;
      const totalTests = qualityTests.length;
      const qualityRate = totalTests > 0 ? Math.round((approvedTests / totalTests) * 100) : 0;

      const reportData = {
        date: today.toISOString().split('T')[0],
        approvedTests,
        rejectedTests,
        totalTests,
        qualityRate,
        activeMachines: machines.length,
        teflonChanges: teflonChanges.length
      };

      // Salvar notificação no banco
      await this.saveNotification({
        type: 'DAILY_REPORT',
        title: 'Relatório Diário Disponível',
        message: `Taxa de qualidade: ${qualityRate}% - ${totalTests} testes realizados`,
        priority: 'LOW',
        channels: ['EMAIL', 'PUSH', 'SYSTEM'],
        metadata: reportData
      });

      const results = {};

      // Enviar email
      if (this.emailEnabled) {
        const recipients = await this.getUserEmailsByRole(['MANAGER', 'ADMIN']);
        if (recipients.length > 0) {
          results.email = await emailService.sendDailyReport(reportData, recipients);
        }
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendDailyReportNotification(reportData);
      }

      console.log('✅ Relatório diário enviado');
      return { success: true, results, reportData };
    } catch (error) {
      console.error('❌ Erro ao enviar relatório diário:', error);
      return { success: false, error: error.message };
    }
  }

  async getNotifications(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        type = null
      } = options;

      const where = {
        OR: [
          { userId },
          { userId: null } // Notificações globais
        ]
      };

      if (unreadOnly) {
        where.read = false;
      }

      if (type) {
        where.type = type;
      }

      const notifications = await prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          machine: {
            select: {
              name: true,
              location: true
            }
          },
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      });

      const total = await prisma.notification.count({ where });

      return {
        success: true,
        data: notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ Erro ao buscar notificações:', error);
      return { success: false, error: error.message };
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      await prisma.notification.updateMany({
        where: {
          id: notificationId,
          OR: [
            { userId },
            { userId: null }
          ]
        },
        data: {
          read: true,
          readAt: new Date()
        }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao marcar notificação como lida:', error);
      return { success: false, error: error.message };
    }
  }

  async markAllAsRead(userId) {
    try {
      await prisma.notification.updateMany({
        where: {
          OR: [
            { userId },
            { userId: null }
          ],
          read: false
        },
        data: {
          read: true,
          readAt: new Date()
        }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao marcar todas as notificações como lidas:', error);
      return { success: false, error: error.message };
    }
  }

  // Método para notificações de vencimento de teflon
  async sendTeflonExpiryNotification(teflonData) {
    try {
      console.log('📧 Enviando notificação de vencimento de teflon...');
      
      const { machine, user, daysUntilExpiry, expiryDate } = teflonData;
      const isExpired = daysUntilExpiry <= 0;
      const urgencyLevel = daysUntilExpiry <= 1 ? 'HIGH' : 'MEDIUM';
      
      const title = isExpired 
        ? '🚨 Teflon Vencido'
        : `⚠️ Teflon Vencerá em ${daysUntilExpiry} dia(s)`;
        
      const message = isExpired
        ? `O teflon da máquina ${machine.name} está vencido desde ${expiryDate.toLocaleDateString('pt-BR')}`
        : `O teflon da máquina ${machine.name} vencerá em ${daysUntilExpiry} dia(s) (${expiryDate.toLocaleDateString('pt-BR')})`;
      
      // Salvar notificação no banco
      await this.saveNotification({
        type: 'TEFLON_CHANGE',
        title,
        message,
        machineId: machine.id,
        changeId: teflonData.id,
        priority: urgencyLevel,
        channels: ['EMAIL', 'PUSH', 'SYSTEM'],
        metadata: {
          machineName: machine.name,
          teflonType: teflonData.teflonType,
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry,
          isExpired,
          operatorName: user.name
        }
      });

      const results = {};

      // Enviar para operadores, líderes e gestores
      const recipients = await this.getUserEmailsByRole(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']);
      
      // Enviar email
      if (this.emailEnabled && recipients.length > 0) {
        results.email = await emailService.sendTeflonExpiryAlert({
          machine: machine.name,
          teflonType: teflonData.teflonType,
          expiryDate: expiryDate.toLocaleDateString('pt-BR'),
          daysUntilExpiry,
          isExpired,
          operatorName: user.name
        }, recipients);
      }

      // Enviar push notification
      if (this.pushEnabled) {
        results.push = await pushService.sendTeflonExpiryAlert({
          title,
          message,
          machineId: machine.id,
          urgencyLevel
        });
      }

      console.log('✅ Notificação de vencimento de teflon enviada');
      return { success: true, results };
    } catch (error) {
      console.error('❌ Erro ao enviar notificação de teflon:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();