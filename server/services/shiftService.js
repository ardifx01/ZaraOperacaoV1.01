const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

class ShiftService {
  constructor() {
    this.SHIFT_HOURS = {
      MORNING: { start: 7, end: 19 },
      NIGHT: { start: 19, end: 7 }
    };
  }

  /**
   * Determina o tipo de turno baseado na hora atual
   * @param {Date} date - Data para verificar
   * @returns {string} 'MORNING' ou 'NIGHT'
   */
  getShiftType(date = new Date()) {
    const hour = date.getHours();
    return (hour >= 7 && hour < 19) ? 'MORNING' : 'NIGHT';
  }

  /**
   * Calcula os horários de início e fim do turno
   * @param {Date} date - Data de referência
   * @param {string} shiftType - Tipo do turno
   * @returns {Object} { startTime, endTime }
   */
  getShiftTimes(date, shiftType) {
    const baseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (shiftType === 'MORNING') {
      const startTime = new Date(baseDate.getTime() + 7 * 60 * 60 * 1000); // 7:00
      const endTime = new Date(baseDate.getTime() + 19 * 60 * 60 * 1000);   // 19:00
      return { startTime, endTime };
    } else {
      const startTime = new Date(baseDate.getTime() + 19 * 60 * 60 * 1000); // 19:00
      const endTime = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000); // 7:00 do próximo dia
      return { startTime, endTime };
    }
  }

  /**
   * Cria ou atualiza dados do turno atual
   * @param {number} machineId - ID da máquina
   * @param {number} operatorId - ID do operador
   * @param {Object} productionData - Dados de produção
   * @returns {Object} Dados do turno
   */
  async createOrUpdateShiftData(machineId, operatorId, productionData = {}) {
    try {
      const now = new Date();
      const shiftType = this.getShiftType(now);
      const { startTime, endTime } = this.getShiftTimes(now, shiftType);
      const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Verificar se já existe dados para este turno
      let shiftData = await prisma.shiftData.findFirst({
        where: {
          machineId,
          operatorId,
          shiftDate,
          shiftType,
          isActive: true
        }
      });

      if (shiftData) {
        // Atualizar dados existentes
        shiftData = await prisma.shiftData.update({
          where: { id: shiftData.id },
          data: {
            // Preservar produção existente para evitar recálculo incorreto
            totalProduction: shiftData.totalProduction,
            efficiency: productionData.efficiency || shiftData.efficiency,
            downtime: productionData.downtime || shiftData.downtime,
            qualityTests: productionData.qualityTests || shiftData.qualityTests,
            approvedTests: productionData.approvedTests || shiftData.approvedTests,
            rejectedTests: productionData.rejectedTests || shiftData.rejectedTests,
            productionData: productionData.detailedData ? JSON.stringify(productionData.detailedData) : shiftData.productionData,
            updatedAt: now
          }
        });
      } else {
        // Criar novos dados de turno
        shiftData = await prisma.shiftData.create({
          data: {
            machineId,
            operatorId,
            shiftType,
            shiftDate,
            startTime,
            endTime,
            totalProduction: productionData.totalProduction || 0,
            targetProduction: productionData.targetProduction || 0,
            efficiency: productionData.efficiency || 0,
            downtime: productionData.downtime || 0,
            qualityTests: productionData.qualityTests || 0,
            approvedTests: productionData.approvedTests || 0,
            rejectedTests: productionData.rejectedTests || 0,
            productionData: productionData.detailedData ? JSON.stringify(productionData.detailedData) : null
          }
        });
      }

      return shiftData;
    } catch (error) {
      console.error('Erro ao criar/atualizar dados do turno:', error);
      throw error;
    }
  }

  /**
   * Arquiva dados do turno quando ele termina
   * @param {number} shiftDataId - ID dos dados do turno
   * @returns {Object} Dados arquivados
   */
  async archiveShiftData(shiftDataId) {
    try {
      // Buscar dados completos do turno
      const shiftData = await prisma.shiftData.findUnique({
        where: { id: shiftDataId },
        include: {
          machine: true,
          operator: true
        }
      });

      if (!shiftData) {
        throw new Error('Dados do turno não encontrados');
      }

      if (shiftData.isArchived) {
        throw new Error('Dados do turno já foram arquivados');
      }

      // Preparar dados para arquivamento
      const archiveData = {
        shiftInfo: {
          id: shiftData.id,
          machineId: shiftData.machineId,
          machineName: shiftData.machine.name,
          operatorId: shiftData.operatorId,
          operatorName: shiftData.operator.name,
          shiftType: shiftData.shiftType,
          shiftDate: shiftData.shiftDate,
          startTime: shiftData.startTime,
          endTime: shiftData.endTime
        },
        productionMetrics: {
          totalProduction: shiftData.totalProduction,
          targetProduction: shiftData.targetProduction,
          efficiency: shiftData.efficiency,
          downtime: shiftData.downtime
        },
        qualityMetrics: {
          qualityTests: shiftData.qualityTests,
          approvedTests: shiftData.approvedTests,
          rejectedTests: shiftData.rejectedTests,
          approvalRate: shiftData.qualityTests > 0 ? (shiftData.approvedTests / shiftData.qualityTests) * 100 : 0
        },
        detailedData: {
          productionData: shiftData.productionData ? JSON.parse(shiftData.productionData) : null,
          qualityData: shiftData.qualityData ? JSON.parse(shiftData.qualityData) : null,
          maintenanceData: shiftData.maintenanceData ? JSON.parse(shiftData.maintenanceData) : null
        },
        archivedAt: new Date()
      };

      const archivedDataString = JSON.stringify(archiveData);
      const dataSize = Buffer.byteLength(archivedDataString, 'utf8');
      const checksum = crypto.createHash('md5').update(archivedDataString).digest('hex');

      // Criar arquivo
      const archive = await prisma.productionArchive.create({
        data: {
          shiftDataId: shiftData.id,
          machineId: shiftData.machineId,
          operatorId: shiftData.operatorId,
          archivedData: archivedDataString,
          dataSize,
          checksum
        }
      });

      // Marcar dados do turno como arquivados e inativos
      await prisma.shiftData.update({
        where: { id: shiftDataId },
        data: {
          isActive: false,
          isArchived: true,
          archivedAt: new Date()
        }
      });

      console.log(`✅ Dados do turno ${shiftData.shiftType} arquivados para máquina ${shiftData.machine.name}`);
      return archive;
    } catch (error) {
      console.error('Erro ao arquivar dados do turno:', error);
      throw error;
    }
  }

  /**
   * Reseta dados do operador para novo turno
   * @param {number} machineId - ID da máquina
   * @param {number} operatorId - ID do operador
   * @returns {Object} Novos dados do turno
   */
  async resetOperatorData(machineId, operatorId) {
    try {
      const now = new Date();
      const currentShiftType = this.getShiftType(now);
      
      // Buscar turno ativo anterior
      const previousShift = await prisma.shiftData.findFirst({
        where: {
          machineId,
          operatorId,
          isActive: true,
          isArchived: false
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Se existe turno anterior e é diferente do atual, arquivar
      if (previousShift && previousShift.shiftType !== currentShiftType) {
        await this.archiveShiftData(previousShift.id);
      }

      // Criar novo turno
      const newShiftData = await this.createOrUpdateShiftData(machineId, operatorId, {
        totalProduction: 0,
        efficiency: 0,
        downtime: 0,
        qualityTests: 0,
        approvedTests: 0,
        rejectedTests: 0
      });

      console.log(`🔄 Dados resetados para novo turno ${currentShiftType} - Máquina: ${machineId}, Operador: ${operatorId}`);
      return newShiftData;
    } catch (error) {
      console.error('Erro ao resetar dados do operador:', error);
      throw error;
    }
  }

  /**
   * Busca dados do turno atual
   * @param {number} machineId - ID da máquina
   * @param {number} operatorId - ID do operador
   * @returns {Object} Dados do turno atual
   */
  async getCurrentShiftData(machineId, operatorId) {
    try {
      const now = new Date();
      const shiftType = this.getShiftType(now);
      const shiftDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const shiftData = await prisma.shiftData.findFirst({
        where: {
          machineId,
          operatorId,
          shiftDate,
          shiftType,
          isActive: true
        },
        include: {
          machine: true,
          operator: true
        }
      });

      return shiftData;
    } catch (error) {
      console.error('Erro ao buscar dados do turno atual:', error);
      throw error;
    }
  }

  /**
   * Busca dados arquivados por período
   * @param {Object} filters - Filtros de busca
   * @returns {Array} Lista de dados arquivados
   */
  async getArchivedData(filters = {}) {
    try {
      const where = {};
      
      if (filters.machineId) where.machineId = filters.machineId;
      if (filters.operatorId) where.operatorId = filters.operatorId;
      if (filters.startDate || filters.endDate) {
        where.archiveDate = {};
        if (filters.startDate) where.archiveDate.gte = new Date(filters.startDate);
        if (filters.endDate) where.archiveDate.lte = new Date(filters.endDate);
      }

      const archives = await prisma.productionArchive.findMany({
        where,
        include: {
          machine: { select: { name: true, code: true } },
          operator: { select: { name: true, email: true } },
          shiftData: { select: { shiftType: true, shiftDate: true } }
        },
        orderBy: {
          archiveDate: 'desc'
        }
      });

      return archives.map(archive => ({
        ...archive,
        archivedData: JSON.parse(archive.archivedData)
      }));
    } catch (error) {
      console.error('Erro ao buscar dados arquivados:', error);
      throw error;
    }
  }

  /**
   * Verifica e arquiva turnos que terminaram
   * Função para ser executada automaticamente
   */
  async archiveCompletedShifts() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Verificar se estamos no horário de mudança de turno (7:00 ou 19:00)
      if (currentHour !== 7 && currentHour !== 19) {
        return { message: 'Não é horário de mudança de turno' };
      }

      // Buscar turnos ativos que deveriam ter terminado
      const activeShifts = await prisma.shiftData.findMany({
        where: {
          isActive: true,
          isArchived: false,
          endTime: {
            lte: now
          }
        }
      });

      console.log(`🔍 Encontrados ${activeShifts.length} turnos para arquivar`);

      const results = [];
      for (const shift of activeShifts) {
        try {
          const archive = await this.archiveShiftData(shift.id);
          results.push({ success: true, shiftId: shift.id, archiveId: archive.id });
        } catch (error) {
          console.error(`Erro ao arquivar turno ${shift.id}:`, error);
          results.push({ success: false, shiftId: shift.id, error: error.message });
        }
      }

      return {
        message: `Processados ${activeShifts.length} turnos`,
        archived: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      console.error('Erro ao verificar turnos para arquivar:', error);
      throw error;
    }
  }

  /**
   * Atualiza dados do turno atual com informações de produção
   */
  async updateCurrentShiftData() {
    try {
      // Buscar todos os turnos ativos
      const activeShifts = await prisma.shiftData.findMany({
        where: {
          isActive: true,
          isArchived: false
        },
        include: {
          machine: true,
          operator: true
        }
      });

      const results = [];
      for (const shift of activeShifts) {
        try {
          // Calcular dados atualizados de produção
          const productionData = await this.calculateCurrentProductionData(shift.machineId, shift.operatorId);
          
          // Atualizar turno
          await this.createOrUpdateShiftData(shift.machineId, shift.operatorId, productionData);
          
          results.push({ success: true, shiftId: shift.id });
        } catch (error) {
          console.error(`Erro ao atualizar turno ${shift.id}:`, error);
          results.push({ success: false, shiftId: shift.id, error: error.message });
        }
      }

      return {
        message: `Atualizados ${results.filter(r => r.success).length} de ${activeShifts.length} turnos`,
        results
      };
    } catch (error) {
      console.error('Erro ao atualizar dados de turno:', error);
      throw error;
    }
  }

  /**
   * Calcula dados de produção atuais para um turno
   */
  async calculateCurrentProductionData(machineId, operatorId) {
    try {
      const now = new Date();
      const currentShift = await this.getCurrentShiftData(machineId, operatorId);
      const shiftStartTime = currentShift ? currentShift.startTime : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0);
      
      // Buscar dados da máquina
      const machine = await prisma.machine.findUnique({
        where: { id: machineId },
        include: {
          machine_operations: {
            where: {
              startTime: {
                gte: shiftStartTime
              }
            },
            orderBy: {
              startTime: 'desc'
            }
          },
          quality_tests: {
            where: {
              createdAt: {
                gte: shiftStartTime
              }
            }
          }
        }
      });

      if (!machine) {
        return { totalProduction: 0, efficiency: 0, downtime: 0, qualityTests: 0, approvedTests: 0, rejectedTests: 0 };
      }

      // Buscar produção real do banco ao invés de recalcular baseado na velocidade atual
      // Isso evita o bug de salto instantâneo quando a velocidade muda
      const existingShiftData = await this.getCurrentShiftData(machineId, operatorId);
      const totalProduction = existingShiftData ? existingShiftData.totalProduction : 0;
      
      // Calcular tempo total de operação para eficiência
      let totalOperationTime = 0;
      machine.machine_operations.forEach(operation => {
        const startTime = new Date(operation.startTime);
        const endTime = operation.endTime ? new Date(operation.endTime) : now;
        const duration = (endTime - startTime) / (1000 * 60 * 60); // horas
        totalOperationTime += duration;
      });

      // Calcular eficiência
      const shiftDuration = (now - shiftStartTime) / (1000 * 60 * 60); // horas
      const efficiency = shiftDuration > 0 ? Math.min(100, (totalOperationTime / shiftDuration) * 100) : 0;
      const downtime = Math.max(0, shiftDuration - totalOperationTime);

      // Dados de qualidade
      const qualityTests = machine.quality_tests.length;
      const approvedTests = machine.quality_tests.filter(test => test.result === 'APPROVED').length;
      const rejectedTests = machine.quality_tests.filter(test => test.result === 'REJECTED').length;

      return {
        totalProduction,
        efficiency: Math.round(efficiency * 100) / 100,
        downtime: Math.round(downtime * 100) / 100,
        qualityTests,
        approvedTests,
        rejectedTests,
        detailedData: {
          lastUpdate: now,
          machineStatus: machine.status,
          operationsCount: machine.machine_operations.length,
          totalOperationTime: Math.round(totalOperationTime * 100) / 100
        }
      };
    } catch (error) {
      console.error('Erro ao calcular dados de produção:', error);
      return { totalProduction: 0, efficiency: 0, downtime: 0, qualityTests: 0, approvedTests: 0, rejectedTests: 0 };
    }
  }
}

module.exports = new ShiftService();