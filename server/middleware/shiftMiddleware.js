const shiftService = require('../services/shiftService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware para interceptar operações de produção e atualizar dados de turno
 */
class ShiftMiddleware {
  /**
   * Middleware para operações de máquina
   * Atualiza dados do turno quando há mudanças na produção
   */
  static async trackMachineOperation(req, res, next) {
    console.log('🔍 MIDDLEWARE trackMachineOperation - INÍCIO');
    try {
      // Armazenar dados originais para comparação
      req.originalBody = { ...req.body };
      req.shiftTrackingEnabled = true;
      
      console.log('✅ trackMachineOperation - Dados armazenados, continuando...');
      // Continuar com a requisição
      next();
    } catch (error) {
      console.error('❌ Erro no middleware de turno:', error);
      next(error);
    }
  }

  /**
   * Middleware pós-processamento para atualizar dados de turno
   */
  static async updateShiftData(req, res, next) {
    // Interceptar a resposta original
    const originalSend = res.send;
    
    res.send = async function(data) {
      try {
        // Se a operação foi bem-sucedida e temos dados de máquina
        if (res.statusCode >= 200 && res.statusCode < 300 && req.shiftTrackingEnabled) {
          await ShiftMiddleware.processShiftUpdate(req, data);
        }
      } catch (error) {
        console.error('Erro ao atualizar dados de turno:', error);
      }
      
      // Chamar o send original
      originalSend.call(this, data);
    };
    
    next();
  }

  /**
   * Processa atualização dos dados de turno
   */
  static async processShiftUpdate(req, responseData) {
    try {
      const { machineId, operatorId } = req.body || {};
      const { user } = req;
      
      if (!machineId) return;
      
      // Determinar operador (do body ou do usuário logado)
      const finalOperatorId = operatorId || (user && user.role === 'OPERATOR' ? user.id : null);
      
      if (!finalOperatorId) return;

      // Buscar dados atuais da máquina para calcular produção
      const machineData = await prisma.machine.findUnique({
        where: { id: machineId },
        include: {
          machine_operations: {
            where: {
              endTime: null // Operações ativas
            },
            orderBy: {
              startTime: 'desc'
            },
            take: 1
          },
          quality_tests: {
            where: {
              createdAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)) // Hoje
              }
            }
          }
        }
      });

      if (!machineData) return;

      // Calcular dados de produção para o turno
      const productionData = await ShiftMiddleware.calculateProductionData(machineData, finalOperatorId);
      
      // Atualizar dados do turno
      await shiftService.createOrUpdateShiftData(machineId, finalOperatorId, productionData);
      
      console.log(`🔄 Dados de turno atualizados - Máquina: ${machineId}, Operador: ${finalOperatorId}`);
    } catch (error) {
      console.error('Erro ao processar atualização de turno:', error);
    }
  }

  /**
   * Calcula dados de produção baseado no estado atual da máquina
   */
  static async calculateProductionData(machineData, operatorId) {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Buscar dados do turno atual
      const currentShift = await shiftService.getCurrentShiftData(machineData.id, operatorId);
      const shiftStartTime = currentShift ? currentShift.startTime : todayStart;
      
      // Calcular produção baseada nas operações ativas
      let totalProduction = 0;
      let efficiency = 0;
      let downtime = 0;
      
      if (machineData.machine_operations && machineData.machine_operations.length > 0) {
        const operation = machineData.machine_operations[0];
        const operationDuration = (now - new Date(operation.startTime)) / (1000 * 60 * 60); // horas
        
        // Buscar produção real do banco ao invés de recalcular baseado na velocidade atual
        // Isso evita o bug de salto instantâneo quando a velocidade muda
        const existingShiftData = await shiftService.getCurrentShiftData(machineData.id, operatorId);
        totalProduction = existingShiftData ? existingShiftData.totalProduction : 0;
        
        // Calcular eficiência baseada no status
        const shiftDuration = (now - shiftStartTime) / (1000 * 60 * 60); // horas
        if (shiftDuration > 0) {
          const productiveTime = operationDuration;
          efficiency = Math.min(100, (productiveTime / shiftDuration) * 100);
          downtime = Math.max(0, shiftDuration - productiveTime);
        }
      }
      
      // Calcular dados de qualidade
      const qualityTests = machineData.quality_tests || [];
      const todayTests = qualityTests.filter(test => 
        new Date(test.createdAt) >= shiftStartTime
      );
      
      const approvedTests = todayTests.filter(test => test.result === 'APPROVED').length;
      const rejectedTests = todayTests.filter(test => test.result === 'REJECTED').length;
      
      return {
        totalProduction,
        efficiency: Math.round(efficiency * 100) / 100,
        downtime: Math.round(downtime * 100) / 100,
        qualityTests: todayTests.length,
        approvedTests,
        rejectedTests,
        detailedData: {
          lastUpdate: now,
          machineStatus: machineData.status,
          currentOperation: machineData.machine_operations[0] || null,
          qualityMetrics: {
            approvalRate: todayTests.length > 0 ? (approvedTests / todayTests.length) * 100 : 0,
            testsToday: todayTests.length
          }
        }
      };
    } catch (error) {
      console.error('Erro ao calcular dados de produção:', error);
      return {
        totalProduction: 0,
        efficiency: 0,
        downtime: 0,
        qualityTests: 0,
        approvedTests: 0,
        rejectedTests: 0
      };
    }
  }

  /**
   * Middleware para verificar mudança de turno
   */
  static async checkShiftChange(req, res, next) {
    console.log('🔍 MIDDLEWARE checkShiftChange - INÍCIO');
    try {
      const { machineId, operatorId } = req.body || {};
      const { user } = req;
      
      console.log('📋 checkShiftChange - machineId:', machineId, 'operatorId:', operatorId, 'user:', user?.id);
      
      if (!machineId) {
        console.log('⚠️ checkShiftChange - Sem machineId, continuando...');
        return next();
      }
      
      const finalOperatorId = operatorId || (user && user.role === 'OPERATOR' ? user.id : null);
      
      if (!finalOperatorId) {
        console.log('⚠️ checkShiftChange - Sem operatorId, continuando...');
        return next();
      }

      // Verificar se houve mudança de turno
      const currentShift = await shiftService.getCurrentShiftData(machineId, finalOperatorId);
      const now = new Date();
      const currentShiftType = shiftService.getShiftType(now);
      
      // Se não há turno ativo ou o tipo de turno mudou, resetar dados
      if (!currentShift || (currentShift && currentShift.shiftType !== currentShiftType)) {
        console.log(`🔄 Mudança de turno detectada para máquina ${machineId}`);
        await shiftService.resetOperatorData(machineId, finalOperatorId);
        
        // Adicionar informação à requisição
        req.shiftChanged = true;
        req.newShiftType = currentShiftType;
      }
      
      console.log('✅ checkShiftChange - Concluído, continuando...');
      next();
    } catch (error) {
      console.error('❌ Erro ao verificar mudança de turno:', error);
      next(error);
    }
  }

  /**
   * Middleware para validar horário de operação
   */
  static validateOperationTime(req, res, next) {
    console.log('🔍 MIDDLEWARE validateOperationTime - INÍCIO');
    try {
      const now = new Date();
      const hour = now.getHours();
      
      console.log('⏰ validateOperationTime - Hora atual:', hour, 'Minutos:', now.getMinutes());
      
      // Verificar se está dentro do horário de operação (6:30 - 19:30)
      if (hour < 6 || (hour >= 19 && now.getMinutes() > 30)) {
        // Permitir operações, mas marcar como fora de turno
        req.outsideShiftHours = true;
        console.log(`⚠️ Operação fora do horário de turno: ${now.toLocaleTimeString()}`);
      }
      
      console.log('✅ validateOperationTime - Concluído, continuando...');
      next();
    } catch (error) {
      console.error('❌ Erro ao validar horário de operação:', error);
      next(error);
    }
  }
}

module.exports = ShiftMiddleware;