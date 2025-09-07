const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class RealTimeProductionService {
  constructor(io) {
    this.io = io;
    this.updateInterval = null;
    this.isRunning = false;
  }

  /**
   * Inicia o serviço de atualização em tempo real
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Serviço de produção em tempo real já está rodando');
      return;
    }

    console.log('🚀 Iniciando serviço de produção em tempo real...');
    this.isRunning = true;
    
    // Atualizar a cada 30 segundos
    this.updateInterval = setInterval(() => {
      this.updateProduction();
    }, 30000);

    // Primeira execução imediata
    this.updateProduction();
  }

  /**
   * Para o serviço de atualização
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Serviço de produção em tempo real parado');
  }

  /**
   * Atualiza dados de produção para todas as máquinas ativas
   */
  async updateProduction() {
    try {
      console.log('🔄 RealTimeProductionService: Executando updateProduction...');
      // Buscar máquinas com status FUNCIONANDO
      const runningMachines = await prisma.machine.findMany({
        where: {
          status: 'FUNCIONANDO'
        },
        include: {
          operations: {
            where: {
              status: {
                in: ['ACTIVE', 'RUNNING']
              },
              endTime: null
            },
            include: {
              user: true
            },
            orderBy: {
              startTime: 'desc'
            },
            take: 1
          }
        }
      });

      console.log(`🔄 Atualizando produção para ${runningMachines.length} máquinas funcionando`);

      for (const machine of runningMachines) {
        if (machine.operations.length > 0) {
          const operation = machine.operations[0];
          await this.updateMachineProduction(machine, operation);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao atualizar produção:', error);
    }
  }

  /**
   * Atualiza produção de uma máquina específica
   */
  async updateMachineProduction(machine, operation) {
    try {
      const now = new Date();
      const startTime = new Date(operation.startTime);
      const operationDurationMinutes = Math.floor((now - startTime) / (1000 * 60));
      
      // Buscar dados do turno atual
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let shiftData = await prisma.shiftData.findFirst({
        where: {
          machineId: machine.id,
          operatorId: operation.userId,
          shiftDate: today
        }
      });

      if (shiftData) {
        // Calcular produção incremental desde a última atualização
        const lastUpdateTime = new Date(shiftData.updatedAt || shiftData.createdAt);
        const incrementalMinutes = Math.max(0, Math.floor((now - lastUpdateTime) / (1000 * 60)));
        
        // Usar a velocidade atual da máquina para calcular produção incremental
        // Isso garante que mudanças de velocidade afetem apenas a produção futura
        const currentSpeed = machine.productionSpeed || 1;
        const incrementalProduction = Math.max(0, Math.floor(incrementalMinutes * currentSpeed));
        
        // Só atualizar se houve incremento real de tempo
        if (incrementalMinutes > 0) {
          const newTotalProduction = shiftData.totalProduction + incrementalProduction;
          
          await prisma.shiftData.update({
            where: { id: shiftData.id },
            data: {
              totalProduction: newTotalProduction,
              updatedAt: now
            }
          });
          
          console.log(`📈 Produção incremental - ${machine.name}: +${incrementalProduction} peças (${incrementalMinutes}min a ${currentSpeed}/min) = ${newTotalProduction} total`);
        }
      } else {
        // Criar novos dados de turno
        const shiftType = this.getCurrentShiftType();
        const shiftStartTime = this.getShiftStartTime(shiftType, today);
        const shiftEndTime = this.getShiftEndTime(shiftType, today);
        
        // Iniciar produção do zero para novo turno (não recalcular baseado na velocidade atual)
        const totalProduction = 0;
        
        await prisma.shiftData.create({
          data: {
            machineId: machine.id,
            operatorId: operation.userId,
            shiftDate: today,
            shiftType: shiftType,
            startTime: shiftStartTime,
            endTime: shiftEndTime,
            totalProduction: totalProduction,
            targetProduction: machine.targetProduction || 0,
            efficiency: machine.targetProduction ? (totalProduction / machine.targetProduction) * 100 : 0
          }
        });
        
        console.log(`🆕 Novo turno criado - ${machine.name}: ${totalProduction} peças`);
      }

      // Buscar dados atualizados do turno para emitir via WebSocket
      const updatedShiftData = await prisma.shiftData.findFirst({
        where: {
          machineId: machine.id,
          operatorId: operation.userId,
          shiftDate: today
        }
      });
      
      const currentTotalProduction = updatedShiftData ? updatedShiftData.totalProduction : 0;
      
      // Emitir atualização via WebSocket
      if (this.io) {
        this.io.emit('production:update', {
          machineId: machine.id,
          machineName: machine.name,
          operatorName: operation.user.name,
          totalProduction: currentTotalProduction,
          operationDuration: operationDurationMinutes,
          productionSpeed: machine.productionSpeed,
          lastUpdate: now
        });
      }

      console.log(`✅ Produção atualizada - ${machine.name}: ${currentTotalProduction} peças (${operationDurationMinutes}min)`);

    } catch (error) {
      console.error(`❌ Erro ao atualizar produção da máquina ${machine.name}:`, error);
    }
  }

  /**
   * Determina o tipo de turno atual
   */
  getCurrentShiftType() {
    const now = new Date();
    const hour = now.getHours();
    
    // Turno da manhã: 7h às 19h
    // Turno da noite: 19h às 7h do dia seguinte
    return (hour >= 7 && hour < 19) ? 'MORNING' : 'NIGHT';
  }

  /**
   * Calcula horário de início do turno
   */
  getShiftStartTime(shiftType, date) {
    const startTime = new Date(date);
    if (shiftType === 'MORNING') {
      startTime.setHours(7, 0, 0, 0);
    } else {
      startTime.setHours(19, 0, 0, 0);
    }
    return startTime;
  }

  /**
   * Calcula horário de fim do turno
   */
  getShiftEndTime(shiftType, date) {
    const endTime = new Date(date);
    if (shiftType === 'MORNING') {
      endTime.setHours(19, 0, 0, 0);
    } else {
      endTime.setDate(endTime.getDate() + 1);
      endTime.setHours(7, 0, 0, 0);
    }
    return endTime;
  }

  /**
   * Busca a velocidade de produção que estava ativa em um momento específico
   */
  async getPreviousProductionSpeed(machineId, timestamp) {
    try {
      // Buscar a velocidade atual da máquina como aproximação
      // TODO: Implementar tabela de histórico de velocidades para precisão total
      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        select: { productionSpeed: true }
      });
      
      return machine?.productionSpeed || 1;
    } catch (error) {
      console.error(`❌ Erro ao buscar velocidade anterior da máquina ${machineId}:`, error);
      return 1; // Velocidade padrão segura
    }
  }

  /**
   * Força atualização imediata para uma máquina específica
   */
  async forceUpdateMachine(machineId) {
    try {
      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        include: {
          operations: {
            where: {
              status: 'ACTIVE',
              endTime: null
            },
            include: {
              user: true
            },
            orderBy: {
              startTime: 'desc'
            },
            take: 1
          }
        }
      });

      if (machine && machine.status === 'FUNCIONANDO' && machine.operations.length > 0) {
        await this.updateMachineProduction(machine, machine.operations[0]);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Erro ao forçar atualização da máquina ${machineId}:`, error);
      return false;
    }
  }
}

module.exports = RealTimeProductionService;