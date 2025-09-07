const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Configuração
const API_BASE_URL = 'http://localhost:5000/api';
const MACHINE_ID = 1;
const MANAGER_EMAIL = 'manager@zara.com';
const MANAGER_PASSWORD = 'manager123';

// Gerar token JWT diretamente
async function generateToken() {
  const payload = {
    id: '507f1f77bcf86cd799439013', // ID do manager
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 dias
  };
  
  const token = jwt.sign(payload, JWT_SECRET);
  console.log('🔑 Token gerado:', token);
  return token;
}

// Função para buscar dados da máquina específica
async function getMachineData(token, machineId) {
  try {
    console.log(`🔍 Buscando dados da máquina ${machineId}...`);
    const response = await axios.get(`${API_BASE_URL}/machines/${machineId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Dados da máquina obtidos com sucesso:', {
      success: response.data.success,
      machineId: response.data.data?.id,
      machineName: response.data.data?.name
    });
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao buscar dados da máquina:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
    throw error;
  }
}

// Obter produção atual
async function getCurrentProduction(token, machineId) {
  try {
    console.log(`🔍 Buscando dados de produção da máquina ${machineId}...`);
    const response = await axios.get(`${API_BASE}/machines/${machineId}/production/current-shift`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ Dados de produção obtidos:`, JSON.stringify(response.data, null, 2));
    return response.data.data;
  } catch (error) {
    console.error(`❌ Erro ao buscar dados de produção da máquina ${machineId}:`, error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    throw error;
  }
}

// Atualizar velocidade de produção
async function updateProductionSpeed(token, machineId, speed) {
  const response = await axios.put(`${API_BASE}/machines/${machineId}/production-speed`, 
    { productionSpeed: speed },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.data;
}

async function testProductionBug() {
  console.log('🐛 Testando bug de produção com mudança de velocidade\n');
  
  try {
    // 1. Gerar token
    console.log('1. Gerando token...');
    const token = await generateToken();
    
    // 2. Buscar dados da máquina específica
    const machineData = await getMachineData(token, MACHINE_ID);
    
    if (!machineData.success || !machineData.data) {
      console.log('❌ Máquina não encontrada ou erro na busca');
      return;
    }
    
    console.log('📋 Máquina encontrada:', {
      id: machineData.data.id,
      name: machineData.data.name,
      code: machineData.data.code,
      status: machineData.data.status
    });

    const machineId = MACHINE_ID;
    console.log(`✅ Usando máquina: ${machineData.data.name} (ID: ${machineId})\n`);
    
    // 3. Obter estado inicial
    console.log('2. Estado inicial:');
    const initialMachine = machineData.data;
    const initialProduction = await getCurrentProduction(token, machineId);
    
    console.log(`   Velocidade: ${initialMachine.productionSpeed} peças/min`);
    console.log(`   Produção atual: ${initialProduction.estimatedProduction} peças`);
    console.log(`   Tempo funcionando: ${initialProduction.runningMinutes} min\n`);
    
    // 4. TESTE 1: Aumentar velocidade
    console.log('3. TESTE 1: Aumentando velocidade de produção');
    const newSpeedHigh = initialMachine.productionSpeed + 20;
    console.log(`   Alterando de ${initialMachine.productionSpeed} para ${newSpeedHigh} peças/min...`);
    
    await updateProductionSpeed(token, machineId, newSpeedHigh);
    console.log('   ✅ Velocidade atualizada');
    
    // Aguardar um pouco
    console.log('   Aguardando 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const productionAfterIncrease = await getCurrentProduction(token, machineId);
    console.log(`   Produção após aumento: ${productionAfterIncrease.estimatedProduction} peças`);
    console.log(`   Diferença: ${productionAfterIncrease.estimatedProduction - initialProduction.estimatedProduction} peças`);
    
    // Verificar se a produção aumentou incorretamente
    const productionDiff1 = productionAfterIncrease.estimatedProduction - initialProduction.estimatedProduction;
    if (productionDiff1 > 10) { // Se aumentou mais que 10 peças em 5 segundos
      console.log('   ❌ BUG DETECTADO: Produção aumentou muito rapidamente!');
      console.log(`      Aumento de ${productionDiff1} peças em 5 segundos é suspeito`);
    } else {
      console.log('   ✅ Comportamento normal no aumento');
    }
    
    console.log();
    
    // 5. TESTE 2: Diminuir velocidade
    console.log('4. TESTE 2: Diminuindo velocidade de produção');
    const newSpeedLow = Math.max(1, initialMachine.productionSpeed - 15);
    console.log(`   Alterando de ${newSpeedHigh} para ${newSpeedLow} peças/min...`);
    
    await updateProductionSpeed(token, machineId, newSpeedLow);
    console.log('   ✅ Velocidade atualizada');
    
    // Aguardar um pouco
    console.log('   Aguardando 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const productionAfterDecrease = await getCurrentProduction(token, machineId);
    console.log(`   Produção após diminuição: ${productionAfterDecrease.estimatedProduction} peças`);
    console.log(`   Diferença: ${productionAfterDecrease.estimatedProduction - productionAfterIncrease.estimatedProduction} peças`);
    
    // Verificar se a produção diminuiu incorretamente
    const productionDiff2 = productionAfterDecrease.estimatedProduction - productionAfterIncrease.estimatedProduction;
    if (productionDiff2 < -5) { // Se diminuiu mais que 5 peças
      console.log('   ❌ BUG DETECTADO: Produção diminuiu incorretamente!');
      console.log(`      Diminuição de ${Math.abs(productionDiff2)} peças indica problema na lógica`);
    } else if (productionAfterDecrease.estimatedProduction < productionAfterIncrease.estimatedProduction) {
      console.log('   ❌ BUG DETECTADO: Produção total diminuiu!');
      console.log('      A produção nunca deveria diminuir, apenas a taxa de crescimento');
    } else {
      console.log('   ✅ Comportamento normal na diminuição');
    }
    
    console.log();
    
    // 6. Restaurar velocidade original
    console.log('5. Restaurando velocidade original...');
    await updateProductionSpeed(token, machineId, initialMachine.productionSpeed);
    console.log('   ✅ Velocidade restaurada\n');
    
    // 7. Resumo dos testes
    console.log('📊 RESUMO DOS TESTES:');
    console.log('=' .repeat(50));
    console.log(`Produção inicial: ${initialProduction.estimatedProduction} peças`);
    console.log(`Após aumento de velocidade: ${productionAfterIncrease.estimatedProduction} peças (${productionDiff1 > 0 ? '+' : ''}${productionDiff1})`);
    console.log(`Após diminuição de velocidade: ${productionAfterDecrease.estimatedProduction} peças (${productionDiff2 > 0 ? '+' : ''}${productionDiff2})`);
    
    // Análise final
    console.log('\n🔍 ANÁLISE:');
    if (productionDiff1 > 10) {
      console.log('❌ Problema: Aumento de velocidade causa salto na produção');
    }
    if (productionDiff2 < 0) {
      console.log('❌ Problema: Diminuição de velocidade causa perda de produção');
    }
    if (productionDiff1 <= 10 && productionDiff2 >= 0) {
      console.log('✅ Comportamento correto: Velocidade afeta apenas taxa, não produção atual');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
testProductionBug();