const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const productionService = require('../services/productionService');

const prisma = new PrismaClient();

// GET /api/machines/production/aggregate - Dados agregados de produção para Dashboard
router.get('/aggregate', authenticateToken, async (req, res) => {
  try {
    // Buscar todas as máquinas ativas
    const machines = await prisma.machine.findMany({
      where: {
        isActive: true
      },
      include: {
        shiftData: {
          where: {
            isActive: true
          },
          orderBy: {
            id: 'desc'
          },
          take: 1
        }
      }
    });

    let totalProduction = 0;
    let totalRunningTime = 0;
    let totalEfficiency = 0;
    let totalDowntime = 0;
    let machinesWithData = 0;
    let runningMachines = 0;

    // Processar cada máquina
    for (const machine of machines) {
      try {
        // Usar o serviço de produção para obter dados reais
        const productionData = await productionService.calculateCurrentShiftProduction(machine.id);
        
        if (productionData) {
          totalProduction += productionData.estimatedProduction || 0;
          totalRunningTime += productionData.runningTime || 0;
          
          if (productionData.efficiency !== undefined && productionData.efficiency > 0) {
            totalEfficiency += productionData.efficiency;
            machinesWithData++;
          }
          
          // Calcular downtime baseado no status
          const isRunning = machine.status === 'FUNCIONANDO' || machine.status === 'RUNNING';
          if (isRunning) {
            runningMachines++;
          } else if (machine.status !== 'FORA_DE_TURNO' && machine.status !== 'OFF_SHIFT') {
            // Calcular downtime real baseado no último status change
            const now = new Date();
            const shiftStart = new Date();
            shiftStart.setHours(6, 0, 0, 0); // Assumir turno inicia às 6h
            
            if (now > shiftStart) {
              const totalShiftMinutes = (now - shiftStart) / (1000 * 60);
              const runningMinutes = productionData.runningTime || 0;
              totalDowntime += Math.max(0, totalShiftMinutes - runningMinutes);
            }
          }
        }
      } catch (error) {
        console.error(`Erro ao calcular produção da máquina ${machine.id}:`, error);
        // Continuar com próxima máquina em caso de erro
      }
    }

    const aggregatedData = {
      totalProduction: Math.round(totalProduction),
      totalRunningTime: Math.round(totalRunningTime),
      averageEfficiency: machinesWithData > 0 ? Math.round(totalEfficiency / machinesWithData) : 0,
      totalDowntime: Math.round(totalDowntime),
      runningMachines,
      totalMachines: machines.length,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: aggregatedData
    });

  } catch (error) {
    console.error('Erro ao buscar dados agregados de produção:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// GET /api/reports/production-summary - Dados de produção para Reports
router.get('/reports/production-summary', authenticateToken, async (req, res) => {
  try {
    const { dateRange = 'TODAY', machineId, operatorId } = req.query;
    
    // Calcular período baseado no dateRange
    const now = new Date();
    let startDate = new Date();
    
    switch (dateRange) {
      case 'TODAY':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'WEEK':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'MONTH':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'QUARTER':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'YEAR':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    // Filtros para a consulta
    const whereClause = {
      isActive: true,
      ...(machineId && machineId !== 'ALL' && { id: parseInt(machineId) })
    };

    // Buscar máquinas com dados de shift no período
    const machines = await prisma.machine.findMany({
      where: whereClause,
      include: {
        shiftData: {
          where: {
            shiftDate: {
              gte: startDate,
              lte: now
            },
            ...(operatorId && operatorId !== 'ALL' && { operatorId: parseInt(operatorId) })
          },
          include: {
            operator: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    let totalProduction = 0;
    let totalRunningTime = 0;
    let totalEfficiency = 0;
    let totalDowntime = 0;
    let qualityTests = 0;
    let passedTests = 0;
    const machinePerformance = [];
    let shiftsWithData = 0;

    // Processar dados de cada máquina
    machines.forEach(machine => {
      let machineProduction = 0;
      let machineRunningTime = 0;
      let machineEfficiency = 0;
      let machineDowntime = 0;
      let machineShifts = 0;

      machine.shiftData.forEach(shift => {
        machineProduction += shift.totalProduction || 0;
        machineRunningTime += shift.runningTime || 0;
        machineDowntime += shift.downtime || 0;
        
        // Calcular eficiência do shift
        const shiftTotalTime = shift.runningTime + shift.downtime;
        if (shiftTotalTime > 0) {
          machineEfficiency += (shift.runningTime / shiftTotalTime) * 100;
          machineShifts++;
        }
        
        // Dados de qualidade (se disponíveis)
        if (shift.qualityTests) {
          qualityTests += shift.qualityTests;
          passedTests += shift.passedTests || 0;
        }
        
        shiftsWithData++;
      });

      totalProduction += machineProduction;
      totalRunningTime += machineRunningTime;
      totalDowntime += machineDowntime;
      
      if (machineShifts > 0) {
        totalEfficiency += machineEfficiency / machineShifts;
      }

      // Performance individual da máquina
      machinePerformance.push({
        machine: machine.name || `Máquina ${machine.code}`,
        production: machineProduction,
        efficiency: machineShifts > 0 ? Math.round((machineEfficiency / machineShifts) * 10) / 10 : 0,
        downtime: Math.round((machineDowntime / 60) * 10) / 10 // converter para horas
      });
    });

    const reportsData = {
      totalProduction: Math.round(totalProduction),
      totalRunningTime: Math.round(totalRunningTime),
      averageEfficiency: machines.length > 0 ? Math.round(totalEfficiency / machines.length) : 0,
      totalDowntime: Math.round(totalDowntime / 60), // em horas
      qualityRate: qualityTests > 0 ? Math.round((passedTests / qualityTests) * 100 * 10) / 10 : 95,
      machinePerformance,
      period: {
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        range: dateRange
      },
      summary: {
        totalMachines: machines.length,
        shiftsAnalyzed: shiftsWithData,
        qualityTests,
        passedTests
      }
    };

    res.json({
      success: true,
      data: reportsData
    });

  } catch (error) {
    console.error('Erro ao buscar dados de relatório de produção:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;