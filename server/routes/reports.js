const express = require('express');
const { query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { requireLeader, requireManager } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { setCache, getCache } = require('../config/redis');

const router = express.Router();
const prisma = new PrismaClient();

// @desc    Métricas de qualidade para dashboard do gestor
// @route   GET /api/reports/quality-metrics
// @access  Private (Manager+)
router.get('/quality-metrics', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().isString().withMessage('ID da máquina inválido')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (machineId && machineId !== 'all') where.machineId = machineId;

  const tests = await prisma.qualityTest.findMany({
    where,
    include: {
      machine: { select: { name: true } }
    }
  });

  const approved = tests.filter(test => test.approved).length;
  const rejected = tests.filter(test => !test.approved).length;
  const total = tests.length;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  // Agrupar por data para gráfico
  const dailyData = {};
  tests.forEach(test => {
    const date = test.createdAt.toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { approved: 0, rejected: 0 };
    }
    if (test.approved) {
      dailyData[date].approved++;
    } else {
      dailyData[date].rejected++;
    }
  });

  const labels = Object.keys(dailyData).sort();
  const approvedData = labels.map(date => dailyData[date].approved);
  const rejectedData = labels.map(date => dailyData[date].rejected);

  res.json({
    success: true,
    data: {
      approvalRate,
      total,
      approved,
      rejected,
      labels,
      approved: approvedData,
      rejected: rejectedData
    }
  });
}));

// @desc    Dados de produção para dashboard do gestor
// @route   GET /api/reports/production-data
// @access  Private (Manager+)
router.get('/production-data', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().isString().withMessage('ID da máquina inválido')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (machineId && machineId !== 'all') where.machineId = machineId;

  const tests = await prisma.qualityTest.findMany({
    where,
    select: {
      createdAt: true,
      approved: true
    }
  });

  // Agrupar por data
  const dailyProduction = {};
  tests.forEach(test => {
    const date = test.createdAt.toISOString().split('T')[0];
    if (!dailyProduction[date]) {
      dailyProduction[date] = 0;
    }
    dailyProduction[date]++;
  });

  const labels = Object.keys(dailyProduction).sort();
  const daily = labels.map(date => dailyProduction[date]);
  const total = tests.length;

  res.json({
    success: true,
    data: {
      total,
      labels,
      daily
    }
  });
}));

// @desc    Performance das máquinas para dashboard do gestor
// @route   GET /api/reports/machine-performance
// @access  Private (Manager+)
router.get('/machine-performance', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().isString().withMessage('ID da máquina inválido')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  
  // Verificar se existem máquinas no banco
  const machineCount = await prisma.machine.count();
  
  if (machineCount === 0) {
    // Retornar dados vazios se não há máquinas
    return res.json({
      success: true,
      data: {
        machines: [],
        summary: {
          totalMachines: 0,
          activeMachines: 0,
          averageEfficiency: 0,
          totalProduction: 0
        }
      }
    });
  }
  
  const where = {};

  if (machineId && machineId !== 'all') where.id = machineId;

  // Usar MongoDB direto em vez do Prisma
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.DATABASE_URL);
  await client.connect();
  const db = client.db('zara');
  
  const machinesCollection = db.collection('machines');
  const qualityTestsCollection = db.collection('qualityTests');
  
  // Buscar máquinas
  const machineFilter = {};
  if (machineId && machineId !== 'all') {
    machineFilter._id = machineId;
  }
  
  const machines = await machinesCollection.find(machineFilter).toArray();
  
  // Para cada máquina, buscar dados de qualidade
  const machinePerformance = [];
  
  for (const machine of machines) {
    const testFilter = { machineId: machine._id.toString() };
    
    if (startDate || endDate) {
      testFilter.createdAt = {};
      if (startDate) testFilter.createdAt.$gte = new Date(startDate);
      if (endDate) testFilter.createdAt.$lte = new Date(endDate);
    }
    
    const tests = await qualityTestsCollection.find(testFilter).toArray();
    const totalTests = tests.length;
    const passedTests = tests.filter(t => t.approved).length;
    
    machinePerformance.push({
      id: machine._id,
      name: machine.name || `Máquina ${machine.code}`,
      status: machine.status || 'UNKNOWN',
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      lastMaintenance: machine.lastMaintenance
    });
  }
  
  await client.close();
  
  // Calcular médias
  const avgEfficiency = machinePerformance.length > 0 
    ? machinePerformance.reduce((sum, m) => sum + m.passRate, 0) / machinePerformance.length 
    : 0;
  const avgDowntime = 2.1; // Valor padrão
  const avgUtilization = 94.2; // Valor padrão
  
  // Contar status das máquinas
  const statusCount = {
    operating: 0,
    maintenance: 0,
    stopped: 0,
    testing: 0
  };

  let totalTests = 0;
  machinePerformance.forEach(machine => {
    totalTests += machine.totalTests;
    switch (machine.status) {
      case 'RUNNING':
        statusCount.operating++;
        break;
      case 'MAINTENANCE':
        statusCount.maintenance++;
        break;
      case 'STOPPED':
        statusCount.stopped++;
        break;
      case 'ERROR':
        statusCount.testing++;
        break;
    }
  });

  res.json({
    success: true,
    data: {
      machines: machinePerformance,
      summary: {
        totalMachines: machines.length,
        totalTests,
        avgEfficiency,
        avgDowntime,
        avgUtilization,
        statusCount
      }
    }
  });
}));

// @desc    Relatório de testes de qualidade
// @route   GET /api/reports/quality-tests
// @access  Private (Leader+)
router.get('/quality-tests', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('userId').optional().isInt({ min: 1 }).withMessage('ID do usuário inválido'),
  query('approved').optional().isBoolean().withMessage('Approved deve ser boolean'),
  query('format').optional().isIn(['json', 'csv']).withMessage('Formato deve ser json ou csv')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const {
    startDate,
    endDate,
    machineId,
    userId,
    approved,
    format = 'json'
  } = req.query;

  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  // Outros filtros
  if (machineId && machineId !== 'all') where.machineId = machineId;
  if (userId) where.userId = userId;
  if (approved !== undefined) where.approved = approved === 'true';

  const tests = await prisma.qualityTest.findMany({
    where,
    include: {
      machine: {
        select: { name: true, code: true, location: true }
      },
      user: {
        select: { name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Estatísticas
  const stats = {
    total: tests.length,
    approved: tests.filter(t => t.approved).length,
    rejected: tests.filter(t => !t.approved).length,
    approvalRate: tests.length > 0 ? (tests.filter(t => t.approved).length / tests.length * 100).toFixed(2) : 0,
    byMachine: {},
    byUser: {},
    byDay: {}
  };

  // Agrupar por máquina
  tests.forEach(test => {
    const machineName = test.machine.name;
    if (!stats.byMachine[machineName]) {
      stats.byMachine[machineName] = { total: 0, approved: 0, rejected: 0 };
    }
    stats.byMachine[machineName].total++;
    if (test.approved) {
      stats.byMachine[machineName].approved++;
    } else {
      stats.byMachine[machineName].rejected++;
    }
  });

  // Agrupar por usuário
  tests.forEach(test => {
    const userName = test.user.name;
    if (!stats.byUser[userName]) {
      stats.byUser[userName] = { total: 0, approved: 0, rejected: 0 };
    }
    stats.byUser[userName].total++;
    if (test.approved) {
      stats.byUser[userName].approved++;
    } else {
      stats.byUser[userName].rejected++;
    }
  });

  // Agrupar por dia
  tests.forEach(test => {
    const day = test.createdAt.toISOString().split('T')[0];
    if (!stats.byDay[day]) {
      stats.byDay[day] = { total: 0, approved: 0, rejected: 0 };
    }
    stats.byDay[day].total++;
    if (test.approved) {
      stats.byDay[day].approved++;
    } else {
      stats.byDay[day].rejected++;
    }
  });

  if (format === 'csv') {
    // Gerar CSV
    const csvHeaders = [
      'Data/Hora',
      'Máquina',
      'Operador',
      'Produto',
      'Lote',
      'Número da Caixa',
      'Tamanho da Embalagem',
      'Largura da Embalagem',
      'Tamanho do Fundo',
      'Tamanho da Lateral',
      'Distância Zíper-Boca',
      'Distância Facilitador',
      'Teste Régua',
      'Teste Hermeticidade',
      'Status',
      'Observações'
    ];

    const csvRows = tests.map(test => [
      test.createdAt.toLocaleString('pt-BR'),
      test.machine.name,
      test.user.name,
      test.product,
      test.batch,
      test.boxNumber,
      test.packageSize,
      test.packageWidth,
      test.bottomSize,
      test.sideSize,
      test.zipperDistance,
      test.facilitatorDistance,
      test.rulerTest ? 'Sim' : 'Não',
      test.hermeticityTest ? 'Sim' : 'Não',
      test.approved ? 'Aprovado' : 'Reprovado',
      test.observations || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-testes-qualidade.csv"');
    return res.send('\uFEFF' + csvContent); // BOM para UTF-8
  }

  res.json({
    success: true,
    data: {
      tests,
      statistics: stats
    }
  });
}));

// @desc    Relatório de operações de máquinas
// @route   GET /api/reports/machine-operations
// @access  Private (Leader+)
router.get('/machine-operations', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('userId').optional().isInt({ min: 1 }).withMessage('ID do usuário inválido'),
  query('status').optional().isIn(['RUNNING', 'COMPLETED', 'PAUSED', 'STOPPED']).withMessage('Status inválido'),
  query('format').optional().isIn(['json', 'csv']).withMessage('Formato deve ser json ou csv')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const {
    startDate,
    endDate,
    machineId,
    userId,
    status,
    format = 'json'
  } = req.query;

  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) where.startTime.lte = new Date(endDate);
  }

  // Outros filtros
  if (machineId) where.machineId = machineId;
  if (userId) where.userId = userId;
  if (status) where.status = status;

  const operations = await prisma.machineOperation.findMany({
    where,
    include: {
      machine: {
        select: { name: true, code: true, location: true }
      },
      user: {
        select: { name: true, email: true }
      },
      qualityTests: {
        select: { id: true, approved: true, createdAt: true }
      }
    },
    orderBy: { startTime: 'desc' }
  });

  // Calcular durações e estatísticas
  const operationsWithDuration = operations.map(op => {
    const duration = op.endTime ? 
      Math.round((op.endTime - op.startTime) / (1000 * 60)) : // em minutos
      Math.round((new Date() - op.startTime) / (1000 * 60));
    
    return {
      ...op,
      duration,
      hasQualityTest: op.qualityTests.length > 0,
      qualityTestsCount: op.qualityTests.length,
      approvedTests: op.qualityTests.filter(t => t.approved).length
    };
  });

  const stats = {
    total: operations.length,
    completed: operations.filter(op => op.status === 'COMPLETED').length,
    running: operations.filter(op => op.status === 'RUNNING').length,
    paused: operations.filter(op => op.status === 'PAUSED').length,
    stopped: operations.filter(op => op.status === 'STOPPED').length,
    withQualityTests: operationsWithDuration.filter(op => op.hasQualityTest).length,
    averageDuration: operationsWithDuration.length > 0 ? 
      Math.round(operationsWithDuration.reduce((sum, op) => sum + op.duration, 0) / operationsWithDuration.length) : 0,
    byMachine: {},
    byUser: {},
    byStatus: {}
  };

  // Agrupar estatísticas
  operationsWithDuration.forEach(op => {
    const machineName = op.machine.name;
    const userName = op.user.name;
    const status = op.status;

    // Por máquina
    if (!stats.byMachine[machineName]) {
      stats.byMachine[machineName] = { total: 0, totalDuration: 0, withTests: 0 };
    }
    stats.byMachine[machineName].total++;
    stats.byMachine[machineName].totalDuration += op.duration;
    if (op.hasQualityTest) stats.byMachine[machineName].withTests++;

    // Por usuário
    if (!stats.byUser[userName]) {
      stats.byUser[userName] = { total: 0, totalDuration: 0, withTests: 0 };
    }
    stats.byUser[userName].total++;
    stats.byUser[userName].totalDuration += op.duration;
    if (op.hasQualityTest) stats.byUser[userName].withTests++;

    // Por status
    if (!stats.byStatus[status]) {
      stats.byStatus[status] = { count: 0, totalDuration: 0 };
    }
    stats.byStatus[status].count++;
    stats.byStatus[status].totalDuration += op.duration;
  });

  if (format === 'csv') {
    const csvHeaders = [
      'Data/Hora Início',
      'Data/Hora Fim',
      'Duração (min)',
      'Máquina',
      'Operador',
      'Status',
      'Testes de Qualidade',
      'Testes Aprovados',
      'Observações'
    ];

    const csvRows = operationsWithDuration.map(op => [
      op.startTime.toLocaleString('pt-BR'),
      op.endTime ? op.endTime.toLocaleString('pt-BR') : 'Em andamento',
      op.duration,
      op.machine.name,
      op.user.name,
      op.status,
      op.qualityTestsCount,
      op.approvedTests,
      op.observations || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-operacoes-maquinas.csv"');
    return res.send('\uFEFF' + csvContent);
  }

  res.json({
    success: true,
    data: {
      operations: operationsWithDuration,
      statistics: stats
    }
  });
}));

// @desc    Relatório de trocas de teflon
// @route   GET /api/reports/teflon-changes
// @access  Private (Leader+)
router.get('/teflon-changes', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('expired').optional().isBoolean().withMessage('Expired deve ser boolean'),
  query('format').optional().isIn(['json', 'csv']).withMessage('Formato deve ser json ou csv')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const {
    startDate,
    endDate,
    machineId,
    expired,
    format = 'json'
  } = req.query;

  const where = {};
  const now = new Date();

  // Filtros de data
  if (startDate || endDate) {
    where.changeDate = {};
    if (startDate) where.changeDate.gte = new Date(startDate);
    if (endDate) where.changeDate.lte = new Date(endDate);
  }

  // Outros filtros
  if (machineId && machineId !== 'all') where.machineId = machineId;
  if (expired === 'true') {
    where.expiryDate = { lt: now };
  } else if (expired === 'false') {
    where.expiryDate = { gte: now };
  }

  const changes = await prisma.teflonChange.findMany({
    where,
    include: {
      machine: {
        select: { name: true, code: true, location: true }
      },
      user: {
        select: { name: true, email: true }
      }
    },
    orderBy: { changeDate: 'desc' }
  });

  // Adicionar status e calcular estatísticas
  const changesWithStatus = changes.map(change => {
    const daysUntilExpiry = Math.ceil((change.expiryDate - now) / (1000 * 60 * 60 * 24));
    const isExpired = change.expiryDate < now;
    const isExpiringSoon = !isExpired && daysUntilExpiry <= 7;

    return {
      ...change,
      status: {
        expired: isExpired,
        expiringSoon: isExpiringSoon,
        daysUntilExpiry
      }
    };
  });

  const stats = {
    total: changes.length,
    expired: changesWithStatus.filter(c => c.status.expired).length,
    expiringSoon: changesWithStatus.filter(c => c.status.expiringSoon).length,
    valid: changesWithStatus.filter(c => !c.status.expired && !c.status.expiringSoon).length,
    byMachine: {},
    byUser: {},
    byMonth: {}
  };

  // Agrupar estatísticas
  changesWithStatus.forEach(change => {
    const machineName = change.machine.name;
    const userName = change.user.name;
    const month = change.changeDate.toISOString().substring(0, 7); // YYYY-MM

    // Por máquina
    if (!stats.byMachine[machineName]) {
      stats.byMachine[machineName] = { total: 0, expired: 0, expiringSoon: 0 };
    }
    stats.byMachine[machineName].total++;
    if (change.status.expired) stats.byMachine[machineName].expired++;
    if (change.status.expiringSoon) stats.byMachine[machineName].expiringSoon++;

    // Por usuário
    if (!stats.byUser[userName]) {
      stats.byUser[userName] = { total: 0, expired: 0, expiringSoon: 0 };
    }
    stats.byUser[userName].total++;
    if (change.status.expired) stats.byUser[userName].expired++;
    if (change.status.expiringSoon) stats.byUser[userName].expiringSoon++;

    // Por mês
    if (!stats.byMonth[month]) {
      stats.byMonth[month] = { total: 0 };
    }
    stats.byMonth[month].total++;
  });

  if (format === 'csv') {
    const csvHeaders = [
      'Data da Troca',
      'Data de Validade',
      'Máquina',
      'Operador',
      'Tipo de Teflon',
      'Status',
      'Dias até Vencimento',
      'Observações'
    ];

    const csvRows = changesWithStatus.map(change => [
      change.changeDate.toLocaleDateString('pt-BR'),
      change.expiryDate.toLocaleDateString('pt-BR'),
      change.machine.name,
      change.user.name,
      change.teflonType,
      change.status.expired ? 'Expirado' : change.status.expiringSoon ? 'Expirando' : 'Válido',
      change.status.daysUntilExpiry,
      change.observations || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-trocas-teflon.csv"');
    return res.send('\uFEFF' + csvContent);
  }

  // Preparar dados para gráfico
  const monthlyData = {};
  changesWithStatus.forEach(change => {
    const month = change.changeDate.toISOString().substring(0, 7); // YYYY-MM
    if (!monthlyData[month]) {
      monthlyData[month] = 0;
    }
    monthlyData[month]++;
  });

  const labels = Object.keys(monthlyData).sort();
  const chartChanges = labels.map(month => monthlyData[month]);

  res.json({
    success: true,
    data: {
      changes: changesWithStatus,
      statistics: stats,
      total: changes.length,
      labels,
      changes: chartChanges
    }
  });
}));

// @desc    Dashboard executivo - Relatório consolidado
// @route   GET /api/reports/executive-dashboard
// @access  Private (Manager+)
router.get('/executive-dashboard', [
  query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Período inválido')
], requireManager, asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  // Calcular datas baseado no período
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const cacheKey = `executive_dashboard:${period}`;
  let cachedData = await getCache(cacheKey);
  
  if (cachedData) {
    return res.json({
      success: true,
      data: JSON.parse(cachedData),
      cached: true
    });
  }

  // Buscar dados em paralelo
  const [machines, operations, qualityTests, teflonChanges, notifications] = await Promise.all([
    // Máquinas
    prisma.machine.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        isActive: true,
        _count: {
          select: {
            operations: {
              where: { startTime: { gte: startDate } }
            }
          }
        }
      }
    }),
    
    // Operações
    prisma.machineOperation.findMany({
      where: { startTime: { gte: startDate } },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        machineId: true,
        userId: true
      }
    }),
    
    // Testes de qualidade
    prisma.qualityTest.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        id: true,
        approved: true,
        createdAt: true,
        machineId: true,
        userId: true
      }
    }),
    
    // Trocas de teflon
    prisma.teflonChange.findMany({
      select: {
        id: true,
        changeDate: true,
        expiryDate: true,
        machineId: true
      }
    }),
    
    // Notificações
    prisma.notification.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        id: true,
        type: true,
        priority: true,
        read: true,
        createdAt: true
      }
    })
  ]);

  // Calcular métricas
  const totalOperations = operations.length;
  const completedOperations = operations.filter(op => op.status === 'COMPLETED').length;
  const runningOperations = operations.filter(op => op.status === 'RUNNING').length;
  
  const totalQualityTests = qualityTests.length;
  const approvedTests = qualityTests.filter(test => test.approved).length;
  const approvalRate = totalQualityTests > 0 ? (approvedTests / totalQualityTests * 100).toFixed(1) : 0;
  
  const activeMachines = machines.filter(m => m.isActive).length;
  const runningMachines = machines.filter(m => m.status === 'RUNNING').length;
  
  const expiredTeflon = teflonChanges.filter(t => t.expiryDate < now).length;
  const expiringSoonTeflon = teflonChanges.filter(t => {
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return t.expiryDate >= now && t.expiryDate <= sevenDaysFromNow;
  }).length;
  
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const urgentNotifications = notifications.filter(n => n.priority === 'URGENT').length;

  // Dados para gráficos
  const dailyOperations = {};
  const dailyQualityTests = {};
  
  // Agrupar operações por dia
  operations.forEach(op => {
    const day = op.startTime.toISOString().split('T')[0];
    dailyOperations[day] = (dailyOperations[day] || 0) + 1;
  });
  
  // Agrupar testes por dia
  qualityTests.forEach(test => {
    const day = test.createdAt.toISOString().split('T')[0];
    if (!dailyQualityTests[day]) {
      dailyQualityTests[day] = { total: 0, approved: 0, rejected: 0 };
    }
    dailyQualityTests[day].total++;
    if (test.approved) {
      dailyQualityTests[day].approved++;
    } else {
      dailyQualityTests[day].rejected++;
    }
  });

  const dashboardData = {
    period,
    summary: {
      machines: {
        total: machines.length,
        active: activeMachines,
        running: runningMachines,
        utilization: activeMachines > 0 ? (runningMachines / activeMachines * 100).toFixed(1) : 0
      },
      operations: {
        total: totalOperations,
        completed: completedOperations,
        running: runningOperations,
        completionRate: totalOperations > 0 ? (completedOperations / totalOperations * 100).toFixed(1) : 0
      },
      qualityTests: {
        total: totalQualityTests,
        approved: approvedTests,
        rejected: totalQualityTests - approvedTests,
        approvalRate: parseFloat(approvalRate)
      },
      teflon: {
        total: teflonChanges.length,
        expired: expiredTeflon,
        expiringSoon: expiringSoonTeflon,
        alertsNeeded: expiredTeflon + expiringSoonTeflon
      },
      notifications: {
        total: notifications.length,
        unread: unreadNotifications,
        urgent: urgentNotifications
      }
    },
    charts: {
      dailyOperations,
      dailyQualityTests,
      machineUtilization: machines.map(m => ({
        name: m.name,
        operations: m._count.operations,
        status: m.status
      }))
    },
    alerts: {
      expiredTeflon,
      expiringSoonTeflon,
      urgentNotifications,
      operationsWithoutTests: operations.filter(op => {
        return !qualityTests.some(test => test.machineId === op.machineId && 
          Math.abs(test.createdAt - op.startTime) < 30 * 60 * 1000); // 30 minutos
      }).length
    }
  };

  // Cache por 5 minutos
  await setCache(cacheKey, JSON.stringify(dashboardData), 300);

  res.json({
    success: true,
    data: dashboardData
  });
}));

// @desc    Relatório de produtividade por operador
// @route   GET /api/reports/operator-productivity
// @access  Private (Manager+)
router.get('/operator-productivity', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('userId').optional().isInt({ min: 1 }).withMessage('ID do usuário inválido')
], requireManager, asyncHandler(async (req, res) => {
  const { startDate, endDate, userId } = req.query;
  
  const dateFilter = {};
  if (startDate || endDate) {
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
  }

  const userFilter = userId ? { id: userId } : { role: 'OPERATOR' };

  const operators = await prisma.user.findMany({
    where: userFilter,
    select: {
      id: true,
      name: true,
      email: true,
      machineOperations: {
        where: startDate || endDate ? { startTime: dateFilter } : {},
        select: {
          id: true,
          startTime: true,
          endTime: true,
          status: true,
          machine: { select: { name: true } }
        }
      },
      qualityTests: {
        where: startDate || endDate ? { createdAt: dateFilter } : {},
        select: {
          id: true,
          approved: true,
          createdAt: true,
          machine: { select: { name: true } }
        }
      },
      teflonChanges: {
        where: startDate || endDate ? { changeDate: dateFilter } : {},
        select: {
          id: true,
          changeDate: true,
          machine: { select: { name: true } }
        }
      }
    }
  });

  const productivity = operators.map(operator => {
    const operations = operator.machineOperations;
    const qualityTests = operator.qualityTests;
    const teflonChanges = operator.teflonChanges;

    // Calcular tempo total de operação
    const totalOperationTime = operations.reduce((total, op) => {
      if (op.endTime) {
        return total + (op.endTime - op.startTime);
      }
      return total;
    }, 0);

    const totalOperationHours = totalOperationTime / (1000 * 60 * 60); // em horas

    return {
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email
      },
      metrics: {
        totalOperations: operations.length,
        completedOperations: operations.filter(op => op.status === 'COMPLETED').length,
        totalOperationHours: Math.round(totalOperationHours * 100) / 100,
        averageOperationTime: operations.length > 0 ? 
          Math.round(totalOperationTime / operations.length / (1000 * 60)) : 0, // em minutos
        totalQualityTests: qualityTests.length,
        approvedTests: qualityTests.filter(test => test.approved).length,
        approvalRate: qualityTests.length > 0 ? 
          (qualityTests.filter(test => test.approved).length / qualityTests.length * 100).toFixed(1) : 0,
        teflonChanges: teflonChanges.length,
        testsPerOperation: operations.length > 0 ? 
          (qualityTests.length / operations.length).toFixed(2) : 0
      },
      details: JSON.stringify({
        operations,
        qualityTests,
        teflonChanges
      })
    };
  });

  // Ordenar por produtividade (número de operações completadas)
  productivity.sort((a, b) => b.metrics.completedOperations - a.metrics.completedOperations);

  res.json({
    success: true,
    data: productivity
  });
}));

// @desc    Dados do dashboard principal
// @route   GET /api/reports/dashboard
// @access  Private
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { timeRange = 'today' } = req.query;
  
  try {
    // Buscar dados reais do banco de dados
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Buscar máquinas
    const machines = await prisma.machine.findMany({
      include: {
        operations: {
          where: {
            status: 'ACTIVE'
          },
          include: {
            user: true
          }
        }
      }
    });

    // Buscar testes de qualidade
    const todayTests = await prisma.qualityTest.findMany({
      where: {
        testDate: {
          gte: startOfDay
        }
      },
      include: {
        machine: true,
        user: true
      }
    });

    const weekTests = await prisma.qualityTest.findMany({
      where: {
        testDate: {
          gte: startOfWeek
        }
      }
    });

    // Calcular métricas de produção
    const totalProduction = todayTests.length;
    const targetProduction = machines.length * 20; // Meta: 20 testes por máquina por dia
    const weekProduction = weekTests.length;
    const lastWeekProduction = Math.max(weekProduction - totalProduction, 0);
    const productionChange = lastWeekProduction > 0 ? ((totalProduction - lastWeekProduction) / lastWeekProduction) * 100 : 0;

    // Calcular métricas de qualidade
    const approvedTests = todayTests.filter(t => t.approved).length;
    const passRate = todayTests.length > 0 ? (approvedTests / todayTests.length) * 100 : 0;
    const weekApproved = weekTests.filter(t => t.approved).length;
    const weekPassRate = weekTests.length > 0 ? (weekApproved / weekTests.length) * 100 : 0;
    const qualityChange = weekPassRate > 0 ? passRate - weekPassRate : 0;

    // Calcular eficiência geral
    const runningMachines = machines.filter(m => m.status === 'RUNNING');
    const overallEfficiency = machines.length > 0 ? (runningMachines.length / machines.length) * 100 : 0;
    // Calcular mudança de eficiência comparando com período anterior
    const previousWeekStart = new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWeekTests = await prisma.qualityTest.findMany({
      where: {
        testDate: {
          gte: previousWeekStart,
          lt: startOfWeek
        }
      }
    });
    
    const previousWeekApproved = previousWeekTests.filter(test => test.approved).length;
    const previousWeekEfficiency = previousWeekTests.length > 0 ? (previousWeekApproved / previousWeekTests.length) * 100 : 0;
    const efficiencyChange = overallEfficiency - previousWeekEfficiency;

    // Estatísticas das máquinas
    const machineStats = {
      total: machines.length,
      running: machines.filter(m => m.status === 'RUNNING').length,
      stopped: machines.filter(m => m.status === 'STOPPED').length,
      maintenance: machines.filter(m => m.status === 'MAINTENANCE').length,
      error: machines.filter(m => m.status === 'ERROR').length
    };

    // Atividades recentes baseadas em testes reais
    const recentActivities = todayTests
      .slice(-10)
      .map(test => ({
        id: test.id.toString(),
        type: 'quality_test',
        message: `Teste de qualidade ${test.approved ? 'aprovado' : 'reprovado'} na ${test.machine.name}`,
        user: test.user.name,
        timestamp: test.testDate,
        status: test.approved ? 'success' : 'error'
      }))
      .reverse();

    const executiveData = {
      production: {
        total: totalProduction,
        target: targetProduction,
        change: Math.round(productionChange * 10) / 10,
        trend: productionChange >= 0 ? 'up' : 'down'
      },
      quality: {
        passRate: Math.round(passRate * 10) / 10,
        target: 95.0,
        change: Math.round(qualityChange * 10) / 10,
        trend: qualityChange >= 0 ? 'up' : 'down'
      },
      efficiency: {
        overall: Math.round(overallEfficiency * 10) / 10,
        target: 90.0,
        change: efficiencyChange,
        trend: 'up'
      },
      downtime: {
        total: machineStats.total - machineStats.running,
        target: Math.round(machineStats.total * 0.1), // Meta: máximo 10% de downtime
        change: Math.round((passRate - weekPassRate) * 10) / 10,
        trend: 'up'
      },
      machineStats,
      recentActivities
    };

    res.json({
      success: true,
      data: executiveData
    });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}));



// Endpoint para dados do dashboard do líder
router.get('/leader-dashboard', requireLeader, asyncHandler(async (req, res) => {
  const { timeRange = 'today' } = req.query;
  
  // Calcular período baseado no timeRange
  const now = new Date();
  let startDate, endDate = now;
  
  switch (timeRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // Buscar dados de qualidade usando Prisma
  const qualityTests = await prisma.qualityTest.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  // Buscar dados das máquinas usando Prisma
  const machines = await prisma.machine.findMany({
    include: {
      operations: {
        where: {
          status: 'ACTIVE'
        },
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          startTime: 'desc'
        },
        take: 1
      },
      qualityTests: {
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }
    }
  });
    
    // Calcular métricas da equipe
    const totalOperators = machines.filter(m => m.operations.length > 0).length;
    const activeOperators = machines.filter(m => m.status === 'RUNNING' && m.operations.length > 0).length;
    
    // Calcular eficiência média baseada em dados reais de operações
    const runningMachines = machines.filter(m => m.status === 'RUNNING');
    let avgEfficiency = 0;
    if (runningMachines.length > 0) {
      // Calcular eficiência baseada no tempo de operação e testes de qualidade
      const efficiencySum = runningMachines.reduce((sum, machine) => {
        const machineTests = qualityTests.filter(t => t.machineId === machine.id);
        const approvedCount = machineTests.filter(t => t.approved).length;
        const machineEfficiency = machineTests.length > 0 ? (approvedCount / machineTests.length) * 100 : 85; // Default 85%
        return sum + machineEfficiency;
      }, 0);
      avgEfficiency = efficiencySum / runningMachines.length;
    }

    // Calcular taxa de qualidade baseada em dados reais
    const totalTests = qualityTests.length;
    const approvedTests = qualityTests.filter(t => t.approved).length;
    const qualityScore = totalTests > 0 ? (approvedTests / totalTests) * 100 : 0;

    // Calcular produção atual baseada em testes realizados
    const currentProduction = totalTests; // Número de testes = produção atual
    const targetProduction = machines.length * 50; // Meta: 50 testes por máquina no período

    // Preparar dados da equipe com eficiência real
    const teamMembers = machines
      .filter(m => m.operations.length > 0)
      .map(m => {
        const machineTests = qualityTests.filter(t => t.machineId === m.id);
        const approvedCount = machineTests.filter(t => t.approved).length;
        const efficiency = machineTests.length > 0 ? Math.round((approvedCount / machineTests.length) * 100) : 85;
        
        return {
          id: m.operations[0].user.id,
          name: m.operations[0].user.name,
          role: 'Operador(a)',
          machine: m.code || m.name,
          status: m.status === 'RUNNING' ? 'active' : 'inactive',
          efficiency: efficiency,
          lastActivity: m.operations[0].startTime
        };
      });

    // Preparar dados das máquinas supervisionadas com eficiência real
    const supervisedMachines = machines.map(m => {
      const machineTests = qualityTests.filter(t => t.machineId === m.id);
      const approvedCount = machineTests.filter(t => t.approved).length;
      const efficiency = machineTests.length > 0 ? Math.round((approvedCount / machineTests.length) * 100) : 85;
      
      return {
        id: m.id,
        name: m.name,
        status: m.status,
        efficiency: efficiency,
        operator: m.operations.length > 0 ? m.operations[0].user.name : null
      };
    });

    // Buscar alertas reais das notificações
    const recentNotifications = await prisma.notification.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
        },
        type: {
          in: ['MACHINE_STATUS', 'QUALITY_TEST', 'MAINTENANCE', 'ERROR']
        }
      },
      include: {
        machine: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    // Converter notificações para formato de alertas
    const recentAlerts = recentNotifications.map(notification => ({
      id: notification.id,
      type: notification.type.toLowerCase().replace('_', ''),
      severity: notification.priority.toLowerCase(),
      message: notification.message,
      machine: notification.machine?.code || notification.machine?.name || 'N/A',
      timestamp: notification.createdAt,
      status: notification.read ? 'acknowledged' : 'active'
    }));

    const leaderData = {
      teamPerformance: {
        totalOperators,
        activeOperators,
        efficiency: Math.round(avgEfficiency * 10) / 10,
        qualityScore: Math.round(qualityScore * 10) / 10
      },
      shiftMetrics: {
        production: {
          current: currentProduction,
          target: targetProduction,
          percentage: targetProduction > 0 ? Math.round((currentProduction / targetProduction) * 100 * 10) / 10 : 0
        },
        quality: {
          passRate: Math.round(qualityScore * 10) / 10,
          target: 95.0,
          defects: totalTests - approvedTests
        },
        downtime: {
          total: machines.filter(m => m.status === 'STOPPED' || m.status === 'ERROR' || m.status === 'MAINTENANCE').length,
          planned: machines.filter(m => m.status === 'MAINTENANCE').length,
          unplanned: machines.filter(m => m.status === 'ERROR').length
        }
      },
      alerts: {
        critical: recentAlerts.filter(a => a.severity === 'high').length,
        warning: recentAlerts.filter(a => a.severity === 'medium').length,
        info: recentAlerts.filter(a => a.severity === 'low').length
      },
      teamMembers,
      supervisedMachines,
      recentAlerts
    };

    res.json({
      success: true,
      data: leaderData
    });
}));

// @desc    Dados de manutenção para relatórios
// @route   GET /api/reports/maintenance-data
// @access  Manager
router.get('/maintenance-data', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().isString().withMessage('ID da máquina inválido')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (machineId && machineId !== 'all') where.machineId = machineId;

  // Buscar notificações de manutenção
  const maintenanceNotifications = await prisma.notification.findMany({
    where: {
      ...where,
      type: {
        in: ['MAINTENANCE', 'MACHINE_STATUS']
      }
    },
    include: {
      machine: { select: { name: true } }
    }
  });

  // Buscar máquinas em manutenção
  const machinesInMaintenance = await prisma.machine.findMany({
    where: {
      status: 'MAINTENANCE'
    },
    select: {
      id: true,
      name: true,
      status: true,
      lastMaintenance: true
    }
  });

  // Calcular métricas
  const totalMaintenance = maintenanceNotifications.length;
  const preventive = maintenanceNotifications.filter(n => n.message.includes('preventiva')).length;
  const corrective = totalMaintenance - preventive;
  const avgDowntime = machinesInMaintenance.length > 0 ? 2.8 : 0; // Valor estimado
  const maintenanceCost = totalMaintenance * 2500; // Custo estimado por manutenção

  // Agrupar por máquina
  const maintenanceByMachine = {};
  maintenanceNotifications.forEach(notification => {
    const machineName = notification.machine?.name || 'Desconhecida';
    if (!maintenanceByMachine[machineName]) {
      maintenanceByMachine[machineName] = {
        machine: machineName,
        preventive: 0,
        corrective: 0,
        cost: 0
      };
    }
    if (notification.message.includes('preventiva')) {
      maintenanceByMachine[machineName].preventive++;
    } else {
      maintenanceByMachine[machineName].corrective++;
    }
    maintenanceByMachine[machineName].cost += 2500;
  });

  // Agrupar por data para tendência
  const dailyData = {};
  maintenanceNotifications.forEach(notification => {
    const date = notification.createdAt.toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { downtime: 0, maintenance: 0 };
    }
    dailyData[date].maintenance++;
    dailyData[date].downtime += 2.1; // Tempo médio estimado
  });

  const labels = Object.keys(dailyData).sort();
  const downtimeTrend = labels.map(date => ({
    date,
    downtime: dailyData[date].downtime,
    maintenance: dailyData[date].maintenance
  }));

  res.json({
    success: true,
    data: {
      totalMaintenance,
      preventive,
      corrective,
      avgDowntime,
      maintenanceCost,
      plannedVsUnplanned: {
        planned: preventive > 0 ? Math.round((preventive / totalMaintenance) * 100) : 0,
        unplanned: corrective > 0 ? Math.round((corrective / totalMaintenance) * 100) : 0
      },
      maintenanceByMachine: Object.values(maintenanceByMachine),
      downtimeTrend
    }
  });
}));

// @desc    Relatório agregado de qualidade com estatísticas detalhadas
// @route   GET /api/reports/quality-summary
// @access  Private (Leader+)
router.get('/quality-summary', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (machineId && machineId !== 'all') where.machineId = machineId;

  // Buscar todos os testes com informações das máquinas
  const tests = await prisma.qualityTest.findMany({
    where,
    include: {
      machine: {
        select: { id: true, name: true, code: true, location: true }
      },
      user: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Estatísticas gerais
  const totalTests = tests.length;
  const approvedTests = tests.filter(t => t.approved).length;
  const rejectedTests = tests.filter(t => !t.approved).length;
  const approvalRate = totalTests > 0 ? Math.round((approvedTests / totalTests) * 100) : 0;

  // Estatísticas por máquina
  const machineStats = {};
  tests.forEach(test => {
    const machineId = test.machine.id;
    if (!machineStats[machineId]) {
      machineStats[machineId] = {
        machine: test.machine,
        total: 0,
        approved: 0,
        rejected: 0,
        approvalRate: 0,
        lastTest: null
      };
    }
    
    machineStats[machineId].total++;
    if (test.approved) {
      machineStats[machineId].approved++;
    } else {
      machineStats[machineId].rejected++;
    }
    
    // Atualizar último teste
    if (!machineStats[machineId].lastTest || test.createdAt > machineStats[machineId].lastTest) {
      machineStats[machineId].lastTest = test.createdAt;
    }
  });

  // Calcular taxa de aprovação por máquina
  Object.keys(machineStats).forEach(machineId => {
    const stats = machineStats[machineId];
    stats.approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  });

  // Estatísticas por operador
  const operatorStats = {};
  tests.forEach(test => {
    const userId = test.user.id;
    if (!operatorStats[userId]) {
      operatorStats[userId] = {
        user: test.user,
        total: 0,
        approved: 0,
        rejected: 0,
        approvalRate: 0
      };
    }
    
    operatorStats[userId].total++;
    if (test.approved) {
      operatorStats[userId].approved++;
    } else {
      operatorStats[userId].rejected++;
    }
  });

  // Calcular taxa de aprovação por operador
  Object.keys(operatorStats).forEach(userId => {
    const stats = operatorStats[userId];
    stats.approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  });

  // Estatísticas por período (últimos 7 dias)
  const dailyStats = {};
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  
  tests
    .filter(test => test.createdAt >= last7Days)
    .forEach(test => {
      const date = test.createdAt.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          total: 0,
          approved: 0,
          rejected: 0,
          approvalRate: 0
        };
      }
      
      dailyStats[date].total++;
      if (test.approved) {
        dailyStats[date].approved++;
      } else {
        dailyStats[date].rejected++;
      }
    });

  // Calcular taxa de aprovação diária
  Object.keys(dailyStats).forEach(date => {
    const stats = dailyStats[date];
    stats.approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  });

  // Testes mais recentes
  const recentTests = tests.slice(0, 10).map(test => ({
    id: test.id,
    product: test.product,
    lot: test.lot,
    machine: test.machine.name,
    operator: test.user.name,
    approved: test.approved,
    testDate: test.testDate,
    createdAt: test.createdAt
  }));

  res.json({
    success: true,
    data: {
      summary: {
        totalTests,
        approvedTests,
        rejectedTests,
        approvalRate,
        period: {
          startDate: startDate || 'Início',
          endDate: endDate || 'Hoje'
        }
      },
      machineStats: Object.values(machineStats),
      operatorStats: Object.values(operatorStats),
      dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
      recentTests
    }
  });
}));

module.exports = router;