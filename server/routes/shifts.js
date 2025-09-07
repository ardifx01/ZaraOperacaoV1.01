const express = require('express');
const router = express.Router();
const shiftService = require('../services/shiftService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * GET /api/shifts/current
 * Busca dados do turno atual para uma máquina e operador
 */
router.get('/current', async (req, res) => {
  try {
    const { machineId, operatorId } = req.query;
    const userId = req.user.id;
    
    // Se não especificado operador e usuário é operador, usar o próprio usuário
    const finalOperatorId = operatorId || (req.user.role === 'OPERATOR' ? userId : null);
    
    if (!machineId || !finalOperatorId) {
      return res.status(400).json({
        success: false,
        message: 'machineId e operatorId são obrigatórios'
      });
    }

    const shiftData = await shiftService.getCurrentShiftData(
      parseInt(machineId), 
      parseInt(finalOperatorId)
    );
    
    if (!shiftData) {
      // Criar novo turno se não existir
      const newShiftData = await shiftService.createOrUpdateShiftData(
        parseInt(machineId), 
        parseInt(finalOperatorId)
      );
      
      return res.json({
        success: true,
        data: newShiftData,
        message: 'Novo turno criado'
      });
    }
    
    res.json({
      success: true,
      data: shiftData
    });
  } catch (error) {
    console.error('Erro ao buscar turno atual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/shifts/update
 * Atualiza dados do turno atual
 */
router.post('/update', async (req, res) => {
  try {
    const { machineId, operatorId, productionData } = req.body;
    const userId = req.user.id;
    
    const finalOperatorId = operatorId || (req.user.role === 'OPERATOR' ? userId : null);
    
    if (!finalOperatorId) {
      return res.status(400).json({
        success: false,
        message: 'operatorId é obrigatório'
      });
    }

    const updatedShift = await shiftService.createOrUpdateShiftData(
      parseInt(machineId),
      parseInt(finalOperatorId),
      productionData
    );
    
    res.json({
      success: true,
      data: updatedShift,
      message: 'Dados do turno atualizados com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar turno:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/shifts/reset
 * Reseta dados do operador para novo turno
 */
router.post('/reset', async (req, res) => {
  try {
    const { machineId, operatorId } = req.body;
    const userId = req.user.id;
    
    const finalOperatorId = operatorId || (req.user.role === 'OPERATOR' ? userId : null);
    
    if (!finalOperatorId) {
      return res.status(400).json({
        success: false,
        message: 'operatorId é obrigatório'
      });
    }

    const newShiftData = await shiftService.resetOperatorData(
      parseInt(machineId),
      parseInt(finalOperatorId)
    );
    
    res.json({
      success: true,
      data: newShiftData,
      message: 'Dados do operador resetados para novo turno'
    });
  } catch (error) {
    console.error('Erro ao resetar dados do operador:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/history
 * Busca histórico de turnos
 */
router.get('/history', async (req, res) => {
  try {
    const { 
      machineId, 
      operatorId, 
      startDate, 
      endDate, 
      shiftType,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const where = {
      isArchived: false
    };
    
    if (machineId) where.machineId = parseInt(machineId);
    if (operatorId) where.operatorId = parseInt(operatorId);
    if (shiftType) where.shiftType = shiftType;
    
    if (startDate || endDate) {
      where.shiftDate = {};
      if (startDate) where.shiftDate.gte = new Date(startDate);
      if (endDate) where.shiftDate.lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [shifts, total] = await Promise.all([
      prisma.shiftData.findMany({
        where,
        include: {
          machine: { select: { name: true, code: true } },
          operator: { select: { name: true, email: true } }
        },
        orderBy: {
          shiftDate: 'desc'
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.shiftData.count({ where })
    ]);
    
    res.json({
      success: true,
      data: shifts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erro ao buscar histórico de turnos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/archives
 * Busca dados arquivados
 */
router.get('/archives', async (req, res) => {
  try {
    const { 
      machineId, 
      operatorId, 
      startDate, 
      endDate,
      page = 1,
      limit = 20
    } = req.query;
    
    const filters = {};
    if (machineId) filters.machineId = parseInt(machineId);
    if (operatorId) filters.operatorId = parseInt(operatorId);
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const archives = await shiftService.getArchivedData(filters);
    
    // Paginação manual para dados arquivados
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedArchives = archives.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedArchives,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: archives.length,
        pages: Math.ceil(archives.length / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dados arquivados:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/shifts/archive/:id
 * Arquiva manualmente um turno específico
 */
router.post('/archive/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar permissões (apenas supervisores e administradores)
    if (!['SUPERVISOR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas supervisores e administradores podem arquivar turnos.'
      });
    }
    
    const archive = await shiftService.archiveShiftData(parseInt(id));
    
    res.json({
      success: true,
      data: archive,
      message: 'Turno arquivado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao arquivar turno:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/summary
 * Resumo de turnos por período
 */
router.get('/summary', async (req, res) => {
  try {
    const { 
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      machineId,
      operatorId
    } = req.query;
    
    const where = {
      shiftDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };
    
    if (machineId) where.machineId = parseInt(machineId);
    if (operatorId) where.operatorId = parseInt(operatorId);
    
    const shifts = await prisma.shiftData.findMany({
      where,
      include: {
        machine: { select: { name: true } },
        operator: { select: { name: true } }
      }
    });
    
    // Calcular resumo
    const summary = {
      totalShifts: shifts.length,
      totalProduction: shifts.reduce((sum, shift) => sum + (shift.totalProduction || 0), 0),
      averageEfficiency: shifts.length > 0 
        ? shifts.reduce((sum, shift) => sum + (shift.efficiency || 0), 0) / shifts.length 
        : 0,
      totalDowntime: shifts.reduce((sum, shift) => sum + (shift.downtime || 0), 0),
      totalQualityTests: shifts.reduce((sum, shift) => sum + (shift.qualityTests || 0), 0),
      totalApprovedTests: shifts.reduce((sum, shift) => sum + (shift.approvedTests || 0), 0),
      byShiftType: {
        MORNING: shifts.filter(s => s.shiftType === 'MORNING').length,
        NIGHT: shifts.filter(s => s.shiftType === 'NIGHT').length
      },
      byMachine: {},
      byOperator: {}
    };
    
    // Agrupar por máquina
    shifts.forEach(shift => {
      const machineName = shift.machine.name;
      if (!summary.byMachine[machineName]) {
        summary.byMachine[machineName] = {
          shifts: 0,
          production: 0,
          efficiency: 0
        };
      }
      summary.byMachine[machineName].shifts++;
      summary.byMachine[machineName].production += shift.totalProduction || 0;
      summary.byMachine[machineName].efficiency += shift.efficiency || 0;
    });
    
    // Calcular média de eficiência por máquina
    Object.keys(summary.byMachine).forEach(machine => {
      const machineData = summary.byMachine[machine];
      machineData.efficiency = machineData.shifts > 0 
        ? machineData.efficiency / machineData.shifts 
        : 0;
    });
    
    // Agrupar por operador
    shifts.forEach(shift => {
      const operatorName = shift.operator.name;
      if (!summary.byOperator[operatorName]) {
        summary.byOperator[operatorName] = {
          shifts: 0,
          production: 0,
          efficiency: 0
        };
      }
      summary.byOperator[operatorName].shifts++;
      summary.byOperator[operatorName].production += shift.totalProduction || 0;
      summary.byOperator[operatorName].efficiency += shift.efficiency || 0;
    });
    
    // Calcular média de eficiência por operador
    Object.keys(summary.byOperator).forEach(operator => {
      const operatorData = summary.byOperator[operator];
      operatorData.efficiency = operatorData.shifts > 0 
        ? operatorData.efficiency / operatorData.shifts 
        : 0;
    });
    
    res.json({
      success: true,
      data: summary,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Erro ao gerar resumo de turnos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/shifts/manual-archive
 * Força arquivamento de turnos completos (apenas para administradores)
 */
router.post('/manual-archive', async (req, res) => {
  try {
    // Verificar permissões de administrador
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem executar arquivamento manual.'
      });
    }
    
    const result = await shiftService.checkAndArchiveCompletedShifts();
    
    res.json({
      success: true,
      data: result,
      message: 'Arquivamento manual executado com sucesso'
    });
  } catch (error) {
    console.error('Erro no arquivamento manual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;