const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configurações
const API_BASE_URL = 'http://localhost:5000/api';
const MACHINE_ID = 10;
const JWT_SECRET = 'zara-jwt-secret-key-2024';

/**
 * Gera token JWT para manager
 */
function generateToken() {
  const payload = {
    id: 1,
    name: 'Manager Test',
    email: 'manager@test.com',
    role: 'MANAGER'
  };
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  return token;
}

/**
 * Busca dados da máquina
 */
async function getMachineData(machineId, token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/machines/${machineId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro ao buscar dados da máquina:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Atualiza status da máquina
 */
async function updateMachineStatus(machineId, status, token) {
  try {
    const response = await axios.put(`${API_BASE_URL}/machines/${machineId}/status`, {
      status: status
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Status da máquina atualizado para: ${status}`);
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro ao atualizar status:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Inicia operação na máquina
 */
async function startOperation(machineId, token) {
  try {
    const response = await axios.post(`${API_BASE_URL}/machines/${machineId}/operations`, {
      // Dados básicos para iniciar operação
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Operação iniciada na máquina');
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro ao iniciar operação:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Busca dados de produção da máquina
 */
async function getProductionData(machineId, token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/machines/${machineId}/production/current-shift`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro ao buscar dados de produção:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Atualiza velocidade de produção da máquina
 */
async function updateProductionSpeed(machineId, speed, token) {
  try {
    const response = await axios.put(`${API_BASE_URL}/machines/${machineId}/production-speed`, {
      productionSpeed: speed
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Velocidade atualizada para ${speed} produtos/min`);
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro ao atualizar velocidade:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Aguarda um tempo específico
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Teste principal para reproduzir o bug do salto instantâneo
 */
async function testSpeedJumpBugWithOperation() {
  console.log('🧪 Iniciando teste do bug de salto instantâneo na produção (com operação)\n');
  
  try {
    const token = generateToken();
    
    // 1. Verificar status da máquina
    console.log('🔍 1. Verificando status da máquina...');
    const machineData = await getMachineData(MACHINE_ID, token);
    console.log(`   Status atual: ${machineData.status}`);
    console.log(`   Velocidade atual: ${machineData.productionSpeed} produtos/min\n`);
    
    // 2. Garantir que a máquina está funcionando
    if (machineData.status !== 'FUNCIONANDO') {
      console.log('⚙️ 2. Colocando máquina em funcionamento...');
      await updateMachineStatus(MACHINE_ID, 'FUNCIONANDO', token);
      await sleep(2000);
    } else {
      console.log('✅ 2. Máquina já está funcionando\n');
    }
    
    // 3. Tentar iniciar operação (pode falhar se já houver uma ativa)
    console.log('🚀 3. Tentando iniciar operação...');
    try {
      await startOperation(MACHINE_ID, token);
    } catch (error) {
      console.log('   ℹ️ Operação pode já estar ativa ou erro esperado\n');
    }
    
    // 4. Buscar produção inicial
    console.log('📊 4. Buscando produção inicial...');
    const initialProduction = await getProductionData(MACHINE_ID, token);
    console.log(`   Produção inicial: ${initialProduction.estimatedProduction} produtos`);
    console.log(`   Velocidade atual: ${initialProduction.productionSpeed} produtos/min`);
    console.log(`   Status: ${initialProduction.currentStatus}`);
    console.log(`   Funcionando: ${initialProduction.isCurrentlyRunning}\n`);
    
    // 5. Definir velocidade para 1 produto/min
    console.log('⚙️ 5. Definindo velocidade para 1 produto/min...');
    await updateProductionSpeed(MACHINE_ID, 1, token);
    await sleep(3000); // Aguardar 3 segundos
    
    const productionAfterSpeed1 = await getProductionData(MACHINE_ID, token);
    console.log(`   Produção após definir 1/min: ${productionAfterSpeed1.estimatedProduction} produtos\n`);
    
    // 6. Aguardar 2 minutos para acumular produção
    console.log('⏱️ 6. Aguardando 2 minutos para acumular produção...');
    await sleep(120000); // 2 minutos
    
    const productionAfter2Min = await getProductionData(MACHINE_ID, token);
    console.log(`   Produção após 2 minutos: ${productionAfter2Min.estimatedProduction} produtos`);
    console.log(`   Aumento esperado: ~2 produtos`);
    console.log(`   Aumento real: ${productionAfter2Min.estimatedProduction - productionAfterSpeed1.estimatedProduction} produtos\n`);
    
    // 7. Aumentar velocidade para 5 produtos/min (aqui deve ocorrer o bug)
    console.log('🚀 7. Aumentando velocidade para 5 produtos/min...');
    await updateProductionSpeed(MACHINE_ID, 5, token);
    await sleep(3000); // Aguardar 3 segundos
    
    const productionAfterSpeed5 = await getProductionData(MACHINE_ID, token);
    console.log(`   Produção após definir 5/min: ${productionAfterSpeed5.estimatedProduction} produtos`);
    
    // 8. Calcular diferença (aqui deve mostrar o salto instantâneo)
    const jumpDifference = productionAfterSpeed5.estimatedProduction - productionAfter2Min.estimatedProduction;
    console.log(`\n🔍 ANÁLISE DO BUG:`);
    console.log(`   Produção antes da mudança: ${productionAfter2Min.estimatedProduction}`);
    console.log(`   Produção após mudança: ${productionAfterSpeed5.estimatedProduction}`);
    console.log(`   Salto instantâneo: ${jumpDifference} produtos`);
    
    if (jumpDifference > 10) {
      console.log(`\n❌ BUG CONFIRMADO! Salto instantâneo de ${jumpDifference} produtos detectado!`);
      console.log(`   Esperado: Aumento gradual baseado no tempo`);
      console.log(`   Encontrado: Salto instantâneo na produção`);
      console.log(`\n🔧 CAUSA PROVÁVEL:`);
      console.log(`   O realTimeProductionService está recalculando toda a produção`);
      console.log(`   com a nova velocidade desde o início da operação, ao invés de`);
      console.log(`   aplicar a nova velocidade apenas a partir do momento da mudança.`);
    } else {
      console.log(`\n✅ Comportamento normal. Diferença: ${jumpDifference} produtos`);
    }
    
    // 9. Aguardar mais 1 minuto para ver comportamento
    console.log('\n⏱️ 9. Aguardando mais 1 minuto para observar comportamento...');
    await sleep(60000);
    
    const finalProduction = await getProductionData(MACHINE_ID, token);
    console.log(`   Produção final: ${finalProduction.estimatedProduction} produtos`);
    
    const expectedIncrease = 5; // 5 produtos/min por 1 minuto
    const actualIncrease = finalProduction.estimatedProduction - productionAfterSpeed5.estimatedProduction;
    console.log(`   Aumento esperado no último minuto: ${expectedIncrease} produtos`);
    console.log(`   Aumento real no último minuto: ${actualIncrease} produtos`);
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
  }
}

// Executar teste
if (require.main === module) {
  testSpeedJumpBugWithOperation();
}

module.exports = { testSpeedJumpBugWithOperation };