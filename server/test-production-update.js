const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testProductionUpdate() {
  try {
    console.log('🔍 Testando atualização de produção...');
    
    // 1. Verificar máquinas com status FUNCIONANDO
    const runningMachines = await prisma.machine.findMany({
      where: {
        status: 'FUNCIONANDO'
      }
    });
    
    // 2. Buscar operações ativas para essas máquinas
    const activeOperations = await prisma.machineOperation.findMany({
      where: {
        status: 'ACTIVE',
        endTime: null
      },
      include: {
        user: true,
        machine: true
      }
    });
    
    console.log(`\n📊 Máquinas com status FUNCIONANDO: ${runningMachines.length}`);
    
    for (const machine of runningMachines) {
      console.log(`\n🏭 Máquina: ${machine.name} (ID: ${machine.id})`);
      console.log(`   Status: ${machine.status}`);
      console.log(`   Velocidade: ${machine.productionSpeed} pcs/min`);
      
      const activeOperation = activeOperations.find(op => op.machineId === machine.id);
      
      if (activeOperation) {
        const operationDuration = Math.floor((new Date() - new Date(activeOperation.startTime)) / (1000 * 60));
        const expectedProduction = Math.floor(operationDuration * (machine.productionSpeed || 0));
        
        console.log(`   Operação ativa: ${activeOperation.id}`);
        console.log(`   Operador: ${activeOperation.user.name}`);
        console.log(`   Duração: ${operationDuration} minutos`);
        console.log(`   Produção esperada: ${expectedProduction} peças`);
        
        // Verificar se a produção está sendo calculada
        if (operationDuration > 0 && machine.productionSpeed > 0) {
          console.log(`   ✅ Operação ativa e máquina configurada`);
        } else {
          console.log(`   ⚠️  Problema: Duração=${operationDuration}min, Velocidade=${machine.productionSpeed}pcs/min`);
        }
      } else {
        console.log(`   ⚠️  Máquina FUNCIONANDO mas sem operação ativa`);
      }
    }
    
    // 3. Verificar dados de produção do turno atual
    const today = new Date();
    const todayShiftData = await prisma.shiftData.findMany({
      where: {
        shiftDate: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
          lt: new Date(today.setHours(23, 59, 59, 999))
        }
      },
      include: {
        machine: true,
        operator: true
      }
    });
    
    if (todayShiftData.length > 0) {
      console.log(`\n📅 Dados de turno de hoje: ${todayShiftData.length} registros`);
      
      for (const shiftData of todayShiftData) {
        console.log(`   - ${shiftData.machine.name}: ${shiftData.totalProduction} peças (${shiftData.operator.name})`);
      }
    } else {
      console.log(`\n⚠️  Nenhum dado de turno encontrado para hoje`);
    }
    
    console.log('\n✅ Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testProductionUpdate();