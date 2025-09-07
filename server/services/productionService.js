const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Calcula a produção baseada na velocidade configurada e tempo de operação
 * @param {number} machineId - ID da máquina
 * @param {Date} startTime - Hora de início do período
 * @param {Date} endTime - Hora de fim do período
 * @returns {Object} Dados de produção calculados
 */
async function calculateProduction(machineId, startTime, endTime) {
  try {
    // Buscar máquina com velocidade de produção
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: {
        id: true,
        name: true,
        code: true,
        productionSpeed: true,
        statusHistory: {
          where: {
            createdAt: {
              gte: startTime,
              lte: endTime
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!machine) {
      throw new Error('Máquina não encontrada');
    }

    if (!machine.productionSpeed || machine.productionSpeed <= 0) {
      return {
        machineId,
        period: { startTime, endTime },
        productionSpeed: 0,
        totalMinutes: 0,
        runningMinutes: 0,
        stoppedMinutes: 0,
        maintenanceMinutes: 0,
        estimatedProduction: 0,
        efficiency: 0,
        statusBreakdown: []
      };
    }

    // Calcular tempo total do período em minutos
    const totalMinutes = Math.floor((endTime - startTime) / (1000 * 60));

    // Se não há histórico de status, usar dados reais de produção do banco
    if (!machine.statusHistory || machine.statusHistory.length === 0) {
      // Buscar status atual da máquina
      const currentMachine = await prisma.machine.findUnique({
        where: { id: machineId },
        select: { status: true }
      });
      
      const currentStatus = currentMachine?.status || 'PARADA';
      const isRunning = currentStatus === 'FUNCIONANDO';
      const isOffShift = currentStatus === 'FORA_DE_TURNO';
      
      // Buscar produção real do banco de dados ao invés de recalcular
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const shiftData = await prisma.shiftData.findFirst({
        where: {
          machineId: machineId,
          shiftDate: today
        }
      });
      
      const estimatedProduction = shiftData ? shiftData.totalProduction : 0;
      const runningMinutes = (isRunning && !isOffShift) ? totalMinutes : 0;
      const efficiency = totalMinutes > 0 ? Math.round((runningMinutes / totalMinutes) * 100) : 0;
      
      return {
        machineId,
        period: { startTime, endTime },
        productionSpeed: machine.productionSpeed,
        totalMinutes,
        runningMinutes,
        stoppedMinutes: isRunning ? 0 : totalMinutes,
        maintenanceMinutes: 0,
        estimatedProduction,
        efficiency,
        statusBreakdown: [{
          status: currentStatus,
          minutes: totalMinutes,
          percentage: 100
        }]
      };
    }

    // Analisar histórico de status para calcular tempo em cada estado
    const statusBreakdown = {
      FUNCIONANDO: 0,
      PARADA: 0,
      MANUTENCAO: 0,
      FORA_DE_TURNO: 0
    };

    let currentStatus = 'FUNCIONANDO'; // Status padrão
    let currentTime = startTime;

    // Processar cada mudança de status
    for (const statusChange of machine.statusHistory) {
      const changeTime = new Date(statusChange.createdAt);
      
      // Calcular tempo no status anterior
      if (changeTime > currentTime) {
        const minutes = Math.floor((changeTime - currentTime) / (1000 * 60));
        statusBreakdown[currentStatus] += minutes;
      }
      
      currentStatus = statusChange.newStatus;
      currentTime = changeTime;
    }

    // Adicionar tempo restante até o fim do período
    if (currentTime < endTime) {
      const minutes = Math.floor((endTime - currentTime) / (1000 * 60));
      statusBreakdown[currentStatus] += minutes;
    }

    // Buscar produção real do banco de dados ao invés de recalcular
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const shiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: machineId,
        shiftDate: today
      }
    });
    
    const estimatedProduction = shiftData ? shiftData.totalProduction : 0;
    const runningMinutes = statusBreakdown.FUNCIONANDO;

    // Calcular eficiência (tempo funcionando / tempo total)
    const efficiency = totalMinutes > 0 ? Math.round((runningMinutes / totalMinutes) * 100) : 0;

    // Preparar breakdown para resposta
    const statusBreakdownArray = Object.entries(statusBreakdown)
      .filter(([status, minutes]) => minutes > 0)
      .map(([status, minutes]) => ({
        status,
        minutes,
        percentage: totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0
      }));

    return {
      machineId,
      period: { startTime, endTime },
      productionSpeed: machine.productionSpeed,
      totalMinutes,
      runningMinutes: statusBreakdown.FUNCIONANDO,
      stoppedMinutes: statusBreakdown.PARADA,
      maintenanceMinutes: statusBreakdown.MANUTENCAO,
      estimatedProduction,
      efficiency,
      statusBreakdown: statusBreakdownArray
    };

  } catch (error) {
    console.error('Erro ao calcular produção:', error);
    throw error;
  }
}

/**
 * Calcula produção para múltiplas máquinas
 * @param {number[]} machineIds - Array de IDs das máquinas
 * @param {Date} startTime - Hora de início do período
 * @param {Date} endTime - Hora de fim do período
 * @returns {Object[]} Array com dados de produção de cada máquina
 */
async function calculateMultipleProduction(machineIds, startTime, endTime) {
  const results = [];
  
  for (const machineId of machineIds) {
    try {
      const production = await calculateProduction(machineId, startTime, endTime);
      results.push(production);
    } catch (error) {
      console.error(`Erro ao calcular produção da máquina ${machineId}:`, error);
      results.push({
        machineId,
        error: error.message,
        period: { startTime, endTime }
      });
    }
  }
  
  return results;
}

/**
 * Calcula produção do turno atual
 * @param {number} machineId - ID da máquina
 * @returns {Object} Dados de produção do turno atual
 */
async function calculateCurrentShiftProduction(machineId) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Determinar turno atual baseado na hora
  const hour = now.getHours();
  let shiftStart, shiftEnd;
  
  if (hour >= 6 && hour < 14) {
    // Turno manhã: 06:00 - 14:00
    shiftStart = new Date(today.getTime() + 6 * 60 * 60 * 1000);
    shiftEnd = new Date(today.getTime() + 14 * 60 * 60 * 1000);
  } else if (hour >= 14 && hour < 22) {
    // Turno tarde: 14:00 - 22:00
    shiftStart = new Date(today.getTime() + 14 * 60 * 60 * 1000);
    shiftEnd = new Date(today.getTime() + 22 * 60 * 60 * 1000);
  } else {
    // Turno noite: 22:00 - 06:00 (próximo dia)
    if (hour >= 22) {
      shiftStart = new Date(today.getTime() + 22 * 60 * 60 * 1000);
      shiftEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000);
    } else {
      // Ainda é o turno da noite do dia anterior
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      shiftStart = new Date(yesterday.getTime() + 22 * 60 * 60 * 1000);
      shiftEnd = new Date(today.getTime() + 6 * 60 * 60 * 1000);
    }
  }
  
  // Se ainda estamos no turno, usar hora atual como fim
  if (now < shiftEnd) {
    shiftEnd = now;
  }
  
  // Buscar dados da máquina incluindo status atual
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      productionSpeed: true
    }
  });

  if (!machine) {
    throw new Error('Máquina não encontrada');
  }

  // Calcular produção com dados em tempo real
  const production = await calculateProduction(machineId, shiftStart, shiftEnd);
  
  // Adicionar informações de tempo real
  production.currentStatus = machine.status;
  production.isCurrentlyRunning = machine.status === 'FUNCIONANDO';
  production.lastUpdate = now;
  
  return production;
}

/**
 * Calcula produção diária
 * @param {number} machineId - ID da máquina
 * @param {Date} date - Data para calcular (opcional, padrão hoje)
 * @returns {Object} Dados de produção do dia
 */
async function calculateDailyProduction(machineId, date = new Date()) {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  return await calculateProduction(machineId, startOfDay, endOfDay);
}

module.exports = {
  calculateProduction,
  calculateMultipleProduction,
  calculateCurrentShiftProduction,
  calculateDailyProduction
};