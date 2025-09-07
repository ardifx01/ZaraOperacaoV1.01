const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5000/api';

// Função para fazer login e obter token
async function login() {
  try {
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'joao@zara.com',
      password: 'password123'
    });
    return response.data.token;
  } catch (error) {
    console.error('❌ Erro no login:', error.response?.data || error.message);
    throw error;
  }
}

// Função para obter dados de produção
async function getProductionData(machineId, token) {
  try {
    const response = await axios.get(`${API_BASE}/machines/${machineId}/production/current-shift`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.data;
  } catch (error) {
    console.error('❌ Erro ao obter dados de produção:', error.response?.data || error.message);
    return null;
  }
}

// Função para iniciar operação
async function startOperation(machineId, token) {
  try {
    const response = await axios.post(`${API_BASE}/machines/${machineId}/start-operation`, {
      notes: 'Teste de produção'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao iniciar operação:', error.response?.data || error.message);
    throw error;
  }
}

// Função para finalizar operação
async function endOperation(machineId, token) {
  try {
    const response = await axios.post(`${API_BASE}/machines/${machineId}/end-operation`, {
      notes: 'Teste finalizado'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao finalizar operação:', error.response?.data || error.message);
    throw error;
  }
}

// Função para verificar dados da máquina
async function getMachineData(machineId) {
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      include: {
        operations: {
          where: { status: 'ACTIVE' },
          include: { user: true }
        },
        shiftData: {
          where: {
            shiftDate: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    return machine;
  } catch (error) {
    console.error('❌ Erro ao buscar dados da máquina:', error);
    return null;
  }
}

// Teste principal
async function testProductionIssues() {
  console.log('🧪 INICIANDO TESTE DE PROBLEMAS DE PRODUÇÃO\n');
  
  const machineId = 2; // Máquina de teste
  
  try {
    // 1. Fazer login
    console.log('1️⃣ Fazendo login...');
    const token = await login();
    console.log('✅ Login realizado com sucesso\n');
    
    // 2. Verificar estado inicial da máquina
    console.log('2️⃣ Verificando estado inicial da máquina...');
    let machineData = await getMachineData(machineId);
    console.log('📊 Estado inicial:', {
      status: machineData?.status,
      productionSpeed: machineData?.productionSpeed,
      hasActiveOperation: machineData?.operations?.length > 0,
      shiftData: machineData?.shiftData?.[0] || 'Nenhum'
    });
    console.log();
    
    // 3. Obter dados de produção inicial
    console.log('3️⃣ Obtendo dados de produção inicial...');
    let productionData = await getProductionData(machineId, token);
    console.log('📈 Produção inicial:', productionData);
    console.log();
    
    // 4. Iniciar operação se não estiver ativa
    if (!machineData?.operations?.length) {
      console.log('4️⃣ Iniciando operação...');
      await startOperation(machineId, token);
      console.log('✅ Operação iniciada\n');
      
      // Aguardar um pouco para dados serem processados
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 5. Monitorar produção por alguns ciclos
    console.log('5️⃣ Monitorando produção por 3 ciclos (30 segundos cada)...');
    for (let i = 1; i <= 3; i++) {
      console.log(`\n📊 Ciclo ${i}:`);
      
      productionData = await getProductionData(machineId, token);
      console.log('Dados de produção:', {
        totalMinutes: productionData?.totalMinutes,
        runningMinutes: productionData?.runningMinutes,
        estimatedProduction: productionData?.estimatedProduction,
        efficiency: productionData?.efficiency,
        currentStatus: productionData?.currentStatus
      });
      
      // Verificar dados no banco
      machineData = await getMachineData(machineId);
      const shiftData = machineData?.shiftData?.[0];
      console.log('Dados do turno no banco:', {
        totalProduction: shiftData?.totalProduction,
        efficiency: shiftData?.efficiency,
        updatedAt: shiftData?.updatedAt
      });
      
      if (i < 3) {
        console.log('⏳ Aguardando 30 segundos...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
    
    // 6. Finalizar operação e verificar persistência
    console.log('\n6️⃣ Finalizando operação...');
    await endOperation(machineId, token);
    console.log('✅ Operação finalizada');
    
    // Aguardar processamento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 7. Verificar dados após finalização
    console.log('\n7️⃣ Verificando dados após finalização...');
    productionData = await getProductionData(machineId, token);
    console.log('📈 Produção final:', productionData);
    
    machineData = await getMachineData(machineId);
    const finalShiftData = machineData?.shiftData?.[0];
    console.log('📊 Dados finais do turno:', {
      totalProduction: finalShiftData?.totalProduction,
      efficiency: finalShiftData?.efficiency,
      updatedAt: finalShiftData?.updatedAt
    });
    
    // 8. Análise dos problemas
    console.log('\n🔍 ANÁLISE DOS PROBLEMAS:');
    
    if (productionData?.estimatedProduction !== finalShiftData?.totalProduction) {
      console.log('❌ PROBLEMA: Dados de produção não coincidem!');
      console.log(`   API: ${productionData?.estimatedProduction}`);
      console.log(`   Banco: ${finalShiftData?.totalProduction}`);
    } else {
      console.log('✅ Dados de produção coincidem');
    }
    
    if (!finalShiftData?.totalProduction || finalShiftData.totalProduction === 0) {
      console.log('❌ PROBLEMA: Material fabricado foi perdido após finalização!');
    } else {
      console.log('✅ Material fabricado foi preservado');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
if (require.main === module) {
  testProductionIssues();
}

module.exports = { testProductionIssues };