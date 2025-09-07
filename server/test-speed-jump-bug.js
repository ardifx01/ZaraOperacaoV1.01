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
  console.log('🔑 Token gerado:', token);
  return token;
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
async function testSpeedJumpBug() {
  console.log('🧪 Iniciando teste do bug de salto instantâneo na produção\n');
  
  try {
    const token = generateToken();
    
    // 1. Buscar produção inicial
    console.log('📊 1. Buscando produção inicial...');
    const initialProduction = await getProductionData(MACHINE_ID, token);
    console.log(`   Produção inicial: ${initialProduction.estimatedProduction} produtos`);
    console.log(`   Velocidade atual: ${initialProduction.productionSpeed} produtos/min\n`);
    
    // 2. Definir velocidade para 1 produto/min
    console.log('⚙️ 2. Definindo velocidade para 1 produto/min...');
    await updateProductionSpeed(MACHINE_ID, 1, token);
    await sleep(2000); // Aguardar 2 segundos
    
    const productionAfterSpeed1 = await getProductionData(MACHINE_ID, token);
    console.log(`   Produção após definir 1/min: ${productionAfterSpeed1.estimatedProduction} produtos\n`);
    
    // 3. Aguardar 1 minuto para acumular produção
    console.log('⏱️ 3. Aguardando 1 minuto para acumular produção...');
    await sleep(60000); // 1 minuto
    
    const productionAfter1Min = await getProductionData(MACHINE_ID, token);
    console.log(`   Produção após 1 minuto: ${productionAfter1Min.estimatedProduction} produtos\n`);
    
    // 4. Aumentar velocidade para 5 produtos/min (aqui deve ocorrer o bug)
    console.log('🚀 4. Aumentando velocidade para 5 produtos/min...');
    await updateProductionSpeed(MACHINE_ID, 5, token);
    await sleep(2000); // Aguardar 2 segundos
    
    const productionAfterSpeed5 = await getProductionData(MACHINE_ID, token);
    console.log(`   Produção após definir 5/min: ${productionAfterSpeed5.estimatedProduction} produtos`);
    
    // 5. Calcular diferença (aqui deve mostrar o salto instantâneo)
    const jumpDifference = productionAfterSpeed5.estimatedProduction - productionAfter1Min.estimatedProduction;
    console.log(`\n🔍 ANÁLISE DO BUG:`);
    console.log(`   Produção antes da mudança: ${productionAfter1Min.estimatedProduction}`);
    console.log(`   Produção após mudança: ${productionAfterSpeed5.estimatedProduction}`);
    console.log(`   Salto instantâneo: ${jumpDifference} produtos`);
    
    if (jumpDifference > 10) {
      console.log(`\n❌ BUG CONFIRMADO! Salto instantâneo de ${jumpDifference} produtos detectado!`);
      console.log(`   Esperado: Aumento gradual baseado no tempo`);
      console.log(`   Encontrado: Salto instantâneo na produção`);
    } else {
      console.log(`\n✅ Comportamento normal. Diferença: ${jumpDifference} produtos`);
    }
    
    // 6. Aguardar mais 1 minuto para ver comportamento
    console.log('\n⏱️ 6. Aguardando mais 1 minuto para observar comportamento...');
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
  testSpeedJumpBug();
}

module.exports = { testSpeedJumpBug };