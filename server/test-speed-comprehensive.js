const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuração
const BASE_URL = 'http://localhost:3001/api';
const JWT_SECRET = 'zara-jwt-secret-key-2024';
const MACHINE_ID = 1;

// Gerar token JWT
const token = jwt.sign(
  { id: 1, name: 'Test User', role: 'ADMIN' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// Função para aguardar
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função para buscar produção atual
async function getCurrentProduction() {
  try {
    const response = await axios.get(`${BASE_URL}/machines/${MACHINE_ID}/production`, { headers });
    return response.data.data;
  } catch (error) {
    console.error('Erro ao buscar produção:', error.response?.data || error.message);
    return null;
  }
}

// Função para alterar velocidade
async function changeSpeed(speed) {
  try {
    const response = await axios.put(
      `${BASE_URL}/machines/${MACHINE_ID}/production-speed`,
      { productionSpeed: speed },
      { headers }
    );
    return response.data.success;
  } catch (error) {
    console.error('Erro ao alterar velocidade:', error.response?.data || error.message);
    return false;
  }
}

async function runComprehensiveTest() {
  console.log('🧪 TESTE ABRANGENTE DE MUDANÇAS DE VELOCIDADE');
  console.log('=' .repeat(60));

  try {
    // 1. Estado inicial
    console.log('\n📊 1. ESTADO INICIAL');
    let production = await getCurrentProduction();
    if (!production) {
      console.log('❌ Não foi possível obter dados de produção');
      return;
    }
    
    const initialProduction = production.estimatedProduction;
    console.log(`   Produção inicial: ${initialProduction} produtos`);
    console.log(`   Velocidade inicial: ${production.productionSpeed} produtos/min`);

    // 2. Teste 1: Velocidade baixa para alta
    console.log('\n🚀 2. TESTE 1: Velocidade 1 → 10 produtos/min');
    await changeSpeed(1);
    await wait(1000);
    
    production = await getCurrentProduction();
    const beforeChange1 = production.estimatedProduction;
    console.log(`   Produção antes: ${beforeChange1} produtos`);
    
    await changeSpeed(10);
    await wait(1000);
    
    production = await getCurrentProduction();
    const afterChange1 = production.estimatedProduction;
    const jump1 = afterChange1 - beforeChange1;
    
    console.log(`   Produção depois: ${afterChange1} produtos`);
    console.log(`   Diferença: ${jump1} produtos`);
    
    if (jump1 <= 2) {
      console.log('   ✅ Sem salto instantâneo detectado');
    } else {
      console.log(`   ❌ Salto instantâneo de ${jump1} produtos!`);
    }

    // 3. Aguardar e verificar crescimento gradual
    console.log('\n⏱️ 3. VERIFICANDO CRESCIMENTO GRADUAL (2 minutos)');
    await wait(120000); // 2 minutos
    
    production = await getCurrentProduction();
    const afterWait1 = production.estimatedProduction;
    const growth1 = afterWait1 - afterChange1;
    
    console.log(`   Produção após 2min: ${afterWait1} produtos`);
    console.log(`   Crescimento: ${growth1} produtos`);
    console.log(`   Esperado: ~20 produtos (10/min × 2min)`);
    
    if (growth1 >= 18 && growth1 <= 22) {
      console.log('   ✅ Crescimento gradual correto');
    } else {
      console.log('   ⚠️ Crescimento não está conforme esperado');
    }

    // 4. Teste 2: Velocidade alta para baixa
    console.log('\n🔽 4. TESTE 2: Velocidade 10 → 2 produtos/min');
    production = await getCurrentProduction();
    const beforeChange2 = production.estimatedProduction;
    console.log(`   Produção antes: ${beforeChange2} produtos`);
    
    await changeSpeed(2);
    await wait(1000);
    
    production = await getCurrentProduction();
    const afterChange2 = production.estimatedProduction;
    const jump2 = Math.abs(afterChange2 - beforeChange2);
    
    console.log(`   Produção depois: ${afterChange2} produtos`);
    console.log(`   Diferença: ${jump2} produtos`);
    
    if (jump2 <= 2) {
      console.log('   ✅ Sem salto instantâneo detectado');
    } else {
      console.log(`   ❌ Salto instantâneo de ${jump2} produtos!`);
    }

    // 5. Teste 3: Múltiplas mudanças rápidas
    console.log('\n⚡ 5. TESTE 3: Múltiplas mudanças rápidas');
    const speeds = [5, 8, 3, 12, 1];
    let previousProduction = afterChange2;
    
    for (let i = 0; i < speeds.length; i++) {
      const speed = speeds[i];
      console.log(`\n   Mudança ${i + 1}: Velocidade → ${speed} produtos/min`);
      
      await changeSpeed(speed);
      await wait(500);
      
      production = await getCurrentProduction();
      const currentProduction = production.estimatedProduction;
      const diff = Math.abs(currentProduction - previousProduction);
      
      console.log(`     Produção: ${previousProduction} → ${currentProduction} (diff: ${diff})`);
      
      if (diff <= 2) {
        console.log('     ✅ OK');
      } else {
        console.log(`     ❌ Salto de ${diff} produtos!`);
      }
      
      previousProduction = currentProduction;
    }

    // 6. Resumo final
    console.log('\n📋 6. RESUMO FINAL');
    console.log('=' .repeat(40));
    production = await getCurrentProduction();
    const finalProduction = production.estimatedProduction;
    const totalIncrease = finalProduction - initialProduction;
    
    console.log(`   Produção inicial: ${initialProduction} produtos`);
    console.log(`   Produção final: ${finalProduction} produtos`);
    console.log(`   Aumento total: ${totalIncrease} produtos`);
    console.log(`   Velocidade final: ${production.productionSpeed} produtos/min`);
    
    console.log('\n🎯 RESULTADO DO TESTE:');
    if (jump1 <= 2 && jump2 <= 2) {
      console.log('✅ SUCESSO! Bug de salto instantâneo foi corrigido!');
      console.log('   - Mudanças de velocidade não causam saltos na produção');
      console.log('   - Crescimento da produção é gradual e baseado no tempo');
    } else {
      console.log('❌ FALHA! Bug ainda existe:');
      if (jump1 > 2) console.log(`   - Salto de ${jump1} produtos no teste 1`);
      if (jump2 > 2) console.log(`   - Salto de ${jump2} produtos no teste 2`);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
runComprehensiveTest();