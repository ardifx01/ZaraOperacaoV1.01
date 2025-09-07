const { PrismaClient } = require('@prisma/client');
const { calculateCurrentShiftProduction } = require('./services/productionService');

const prisma = new PrismaClient();

async function testFrontendBackendSync() {
  console.log('🔄 Testando sincronização Frontend-Backend...');
  console.log('=' .repeat(60));
  
  try {
    // 1. Buscar uma máquina ativa
    const machine = await prisma.machine.findFirst({
      where: {
        isActive: true,
        status: 'FUNCIONANDO'
      },
      include: {
        operations: {
          where: {
            status: { in: ['ACTIVE', 'RUNNING'] },
            endTime: null
          },
          include: {
            user: { select: { name: true } }
          }
        }
      }
    });

    if (!machine) {
      console.log('❌ Nenhuma máquina funcionando encontrada');
      return;
    }

    console.log(`🏭 Testando máquina: ${machine.name} (ID: ${machine.id})`);
    console.log(`📊 Velocidade configurada: ${machine.productionSpeed} peças/min`);
    console.log(`🔧 Status atual: ${machine.status}`);
    
    if (machine.operations.length > 0) {
      console.log(`👤 Operador: ${machine.operations[0].user.name}`);
    }

    // 2. Calcular produção usando o backend
    console.log('\n🔍 CÁLCULO DO BACKEND:');
    console.log('-' .repeat(40));
    
    const backendProduction = await calculateCurrentShiftProduction(machine.id);
    console.log(`📈 Produção estimada: ${backendProduction.estimatedProduction} peças`);
    console.log(`⏱️ Tempo funcionando: ${backendProduction.runningMinutes} minutos`);
    console.log(`⚡ Eficiência: ${backendProduction.efficiency}%`);
    console.log(`🎯 Velocidade: ${backendProduction.productionSpeed} peças/min`);

    // 3. Simular cálculo do frontend
    console.log('\n🖥️ SIMULAÇÃO DO FRONTEND:');
    console.log('-' .repeat(40));
    
    // Simular lógica do frontend
    const now = new Date();
    const shiftStart = getShiftStartTime();
    const totalShiftMinutes = (now - shiftStart) / (1000 * 60);
    
    // Calcular produção baseada no tempo de funcionamento
    const frontendProduction = Math.floor(backendProduction.runningMinutes * machine.productionSpeed);
    const frontendEfficiency = totalShiftMinutes > 0 ? Math.round((backendProduction.runningMinutes / totalShiftMinutes) * 100) : 0;
    
    console.log(`📈 Produção calculada: ${frontendProduction} peças`);
    console.log(`⏱️ Tempo total do turno: ${Math.floor(totalShiftMinutes)} minutos`);
    console.log(`⚡ Eficiência calculada: ${frontendEfficiency}%`);
    console.log(`🎯 Velocidade usada: ${machine.productionSpeed} peças/min`);

    // 4. Comparar resultados
    console.log('\n🔍 COMPARAÇÃO:');
    console.log('=' .repeat(40));
    
    const productionDiff = Math.abs(backendProduction.estimatedProduction - frontendProduction);
    const efficiencyDiff = Math.abs(backendProduction.efficiency - frontendEfficiency);
    
    console.log(`📊 Diferença na produção: ${productionDiff} peças`);
    console.log(`📊 Diferença na eficiência: ${efficiencyDiff}%`);
    
    if (productionDiff <= 1 && efficiencyDiff <= 2) {
      console.log('✅ Frontend e Backend estão sincronizados!');
    } else {
      console.log('❌ Há inconsistências entre Frontend e Backend');
      
      if (productionDiff > 1) {
        console.log('   - Problema no cálculo de produção');
        console.log(`   - Backend usa: dados do shiftData (${backendProduction.estimatedProduction})`);
        console.log(`   - Frontend calcula: tempo * velocidade (${frontendProduction})`);
      }
      
      if (efficiencyDiff > 2) {
        console.log('   - Problema no cálculo de eficiência');
        console.log(`   - Backend: ${backendProduction.efficiency}%`);
        console.log(`   - Frontend: ${frontendEfficiency}%`);
      }
    }

    // 5. Verificar dados do shiftData
    console.log('\n🗄️ DADOS DO BANCO (shiftData):');
    console.log('-' .repeat(40));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const shiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: machine.id,
        shiftDate: today
      }
    });
    
    if (shiftData) {
      console.log(`📊 Total de produção no BD: ${shiftData.totalProduction} peças`);
      console.log(`📅 Data do turno: ${shiftData.shiftDate.toISOString().split('T')[0]}`);
      console.log(`🕐 Tipo de turno: ${shiftData.shiftType}`);
      console.log(`⏰ Início: ${shiftData.startTime}`);
      console.log(`⏰ Fim: ${shiftData.endTime}`);
    } else {
      console.log('❌ Nenhum dado de turno encontrado no banco');
    }

    // 6. Recomendações
    console.log('\n💡 RECOMENDAÇÕES:');
    console.log('=' .repeat(40));
    
    if (productionDiff > 1) {
      console.log('🔧 Frontend deve usar dados do shiftData ao invés de calcular');
      console.log('🔧 Implementar sincronização via WebSocket para atualizações em tempo real');
    }
    
    if (!shiftData) {
      console.log('🔧 Verificar se o RealTimeProductionService está criando dados de turno');
    }
    
    console.log('🔧 Frontend deve buscar dados da API com mais frequência');
    console.log('🔧 Implementar fallback local apenas quando API não responder');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Função para obter início do turno (alinhada com frontend)
function getShiftStartTime() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const hour = now.getHours();
  
  if (hour >= 7 && hour < 19) {
    // Turno manhã: 07:00 - 19:00
    return new Date(today.getTime() + 7 * 60 * 60 * 1000);
  } else {
    // Turno noite: 19:00 - 07:00
    if (hour >= 19) {
      return new Date(today.getTime() + 19 * 60 * 60 * 1000);
    } else {
      // Se for antes das 7h, é turno da noite que começou ontem às 19h
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return new Date(yesterday.getTime() + 19 * 60 * 60 * 1000);
    }
  }
}

// Executar teste
testFrontendBackendSync();