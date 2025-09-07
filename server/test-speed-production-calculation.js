const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5000/api';

// Função para fazer login e obter token
async function login() {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'lucas.salviano@hotmail.com',
      password: 'operator123'
    });
    return response.data.token;
  } catch (error) {
    console.error('❌ Erro no login:', error.response?.data || error.message);
    return null;
  }
}

// Função para obter dados da máquina
async function getMachineData(machineId, token) {
  try {
    const response = await axios.get(`${API_BASE}/machines/${machineId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro ao obter dados da máquina:', error.response?.data || error.message);
    return null;
  }
}

// Função para obter produção atual
async function getCurrentProduction(machineId, token) {
  try {
    const response = await axios.get(`${API_BASE}/machines/${machineId}/production/current-shift`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro ao obter produção atual:', error.response?.data || error.message);
    return null;
  }
}

// Função para atualizar velocidade de produção
async function updateProductionSpeed(machineId, newSpeed, token) {
  try {
    const response = await axios.put(`${API_BASE}/machines/${machineId}/production-speed`, {
      productionSpeed: newSpeed
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro ao atualizar velocidade:', error.response?.data || error.message);
    return null;
  }
}

// Função principal de teste
async function testSpeedProductionCalculation() {
  console.log('🔍 Testando cálculo de produção com mudança de velocidade\n');
  
  try {
    // 1. Fazer login
    console.log('1. Fazendo login...');
    const token = await login();
    if (!token) {
      console.log('❌ Falha no login');
      return;
    }
    console.log('✅ Login realizado com sucesso\n');

    // 2. Buscar uma máquina ativa
    console.log('2. Buscando máquinas ativas...');
    const machines = await prisma.machine.findMany({
      where: { 
        isActive: true,
        status: 'FUNCIONANDO'
      },
      take: 1
    });

    if (machines.length === 0) {
      console.log('❌ Nenhuma máquina ativa encontrada');
      return;
    }

    const machine = machines[0];
    console.log(`✅ Máquina encontrada: ${machine.name} (ID: ${machine.id})`);
    console.log(`   Status: ${machine.status}`);
    console.log(`   Velocidade atual: ${machine.productionSpeed} peças/min\n`);

    // 3. Obter produção inicial
    console.log('3. Obtendo produção inicial...');
    const initialProduction = await getCurrentProduction(machine.id, token);
    if (!initialProduction) {
      console.log('❌ Falha ao obter produção inicial');
      return;
    }
    
    console.log('📊 Produção inicial:');
    console.log(`   Produção estimada: ${initialProduction.estimatedProduction} peças`);
    console.log(`   Tempo funcionando: ${initialProduction.runningMinutes} minutos`);
    console.log(`   Velocidade: ${initialProduction.productionSpeed} peças/min`);
    console.log(`   Eficiência: ${initialProduction.efficiency}%\n`);

    // 4. Aumentar velocidade de produção
    const newSpeed = initialProduction.productionSpeed + 10; // Aumentar 10 peças/min
    console.log(`4. Aumentando velocidade de ${initialProduction.productionSpeed} para ${newSpeed} peças/min...`);
    
    const updatedMachine = await updateProductionSpeed(machine.id, newSpeed, token);
    if (!updatedMachine) {
      console.log('❌ Falha ao atualizar velocidade');
      return;
    }
    console.log('✅ Velocidade atualizada com sucesso\n');

    // 5. Aguardar alguns segundos para o cálculo ser atualizado
    console.log('5. Aguardando 10 segundos para recálculo...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 6. Obter nova produção
    console.log('6. Obtendo nova produção...');
    const newProduction = await getCurrentProduction(machine.id, token);
    if (!newProduction) {
      console.log('❌ Falha ao obter nova produção');
      return;
    }

    console.log('📊 Produção após aumento de velocidade:');
    console.log(`   Produção estimada: ${newProduction.estimatedProduction} peças`);
    console.log(`   Tempo funcionando: ${newProduction.runningMinutes} minutos`);
    console.log(`   Velocidade: ${newProduction.productionSpeed} peças/min`);
    console.log(`   Eficiência: ${newProduction.efficiency}%\n`);

    // 7. Análise dos resultados
    console.log('📈 ANÁLISE DOS RESULTADOS:');
    console.log('=' .repeat(50));
    
    const productionDiff = newProduction.estimatedProduction - initialProduction.estimatedProduction;
    const speedDiff = newProduction.productionSpeed - initialProduction.productionSpeed;
    const timeDiff = newProduction.runningMinutes - initialProduction.runningMinutes;
    
    console.log(`Diferença de produção: ${productionDiff} peças`);
    console.log(`Diferença de velocidade: ${speedDiff} peças/min`);
    console.log(`Diferença de tempo: ${timeDiff} minutos`);
    
    // Verificar se o comportamento está correto
    if (productionDiff > 0 && speedDiff > 0) {
      console.log('\n✅ COMPORTAMENTO CORRETO:');
      console.log('   - Velocidade aumentou');
      console.log('   - Produção total aumentou');
      
      // Verificar se o aumento é proporcional
      const expectedIncrease = timeDiff * speedDiff;
      if (Math.abs(productionDiff - expectedIncrease) < 5) { // Tolerância de 5 peças
        console.log('   - Aumento de produção é proporcional ao tempo e nova velocidade ✅');
      } else {
        console.log('   - ⚠️  Aumento pode não estar sendo calculado corretamente');
        console.log(`     Esperado: ~${expectedIncrease} peças, Obtido: ${productionDiff} peças`);
      }
    } else {
      console.log('\n❌ PROBLEMA IDENTIFICADO:');
      if (speedDiff <= 0) {
        console.log('   - Velocidade não foi atualizada corretamente');
      }
      if (productionDiff <= 0) {
        console.log('   - Produção não aumentou com o aumento da velocidade');
      }
    }

    // 8. Verificar fórmula de cálculo
    console.log('\n🔍 VERIFICAÇÃO DA FÓRMULA:');
    console.log('=' .repeat(50));
    const calculatedProduction = newProduction.runningMinutes * newProduction.productionSpeed;
    console.log(`Fórmula: tempo_funcionando * velocidade`);
    console.log(`Cálculo: ${newProduction.runningMinutes} min * ${newProduction.productionSpeed} peças/min = ${calculatedProduction} peças`);
    console.log(`API retornou: ${newProduction.estimatedProduction} peças`);
    
    if (Math.abs(calculatedProduction - newProduction.estimatedProduction) < 1) {
      console.log('✅ Fórmula está correta');
    } else {
      console.log('❌ Possível problema na fórmula de cálculo');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
testSpeedProductionCalculation();