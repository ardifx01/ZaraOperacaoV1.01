const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWithOperation() {
  try {
    console.log('🔍 Testando com operação ativa...');
    
    const MACHINE_ID = 1;
    const USER_ID = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 1. Verificar se há operação ativa
    console.log('\n🔍 1. Verificando operações ativas...');
    let activeOperation = await prisma.machineOperation.findFirst({
      where: {
        machineId: MACHINE_ID,
        status: 'RUNNING'
      }
    });
    
    if (activeOperation) {
      console.log(`   Operação ativa encontrada: ID ${activeOperation.id}`);
      console.log(`   Iniciada em: ${activeOperation.startTime}`);
    } else {
      console.log('   Nenhuma operação ativa encontrada. Criando uma...');
      activeOperation = await prisma.machineOperation.create({
        data: {
          machineId: MACHINE_ID,
          userId: USER_ID,
          startTime: new Date(),
          status: 'RUNNING'
        }
      });
      console.log(`   Operação criada: ID ${activeOperation.id}`);
    }
    
    // 2. Colocar máquina em funcionamento
    console.log('\n🚀 2. Colocando máquina em funcionamento...');
    await prisma.machine.update({
      where: { id: MACHINE_ID },
      data: { 
        status: 'FUNCIONANDO',
        productionSpeed: 3
      }
    });
    
    // 3. Verificar/criar dados de turno
    console.log('\n📊 3. Verificando dados de turno...');
    let currentShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        operatorId: USER_ID,
        shiftDate: today
      }
    });
    
    if (!currentShiftData) {
      currentShiftData = await prisma.shiftData.create({
        data: {
          machineId: MACHINE_ID,
          operatorId: USER_ID,
          shiftDate: today,
          totalProduction: 200,
          shiftType: 'MANHA'
        }
      });
      console.log(`   Criado shiftData com produção inicial: ${currentShiftData.totalProduction}`);
    } else {
      console.log(`   ShiftData existente com produção: ${currentShiftData.totalProduction}`);
    }
    
    // 4. Aguardar 35 segundos para o realTimeProductionService atuar
    console.log('\n⏱️ 4. Aguardando 35 segundos para o realTimeProductionService...');
    await new Promise(resolve => setTimeout(resolve, 35000));
    
    // 5. Verificar dados após aguardar
    console.log('\n📊 5. Dados após aguardar:');
    const afterWaitShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        operatorId: USER_ID,
        shiftDate: today
      }
    });
    
    if (afterWaitShiftData) {
      const productionDiff = afterWaitShiftData.totalProduction - currentShiftData.totalProduction;
      console.log(`   Produção anterior: ${currentShiftData.totalProduction}`);
      console.log(`   Produção atual: ${afterWaitShiftData.totalProduction}`);
      console.log(`   Diferença: ${productionDiff} produtos`);
      console.log(`   Esperado em ~35s com 3/min: ~1-2 produtos`);
      
      if (productionDiff > 0) {
        console.log(`✅ RealTimeProductionService está funcionando!`);
      } else {
        console.log(`❌ RealTimeProductionService não está atualizando`);
      }
    }
    
    // 6. Alterar velocidade para 10 produtos/min
    console.log('\n🚀 6. Alterando velocidade para 10 produtos/min...');
    await prisma.machine.update({
      where: { id: MACHINE_ID },
      data: { productionSpeed: 10 }
    });
    
    // 7. Aguardar 5 segundos
    console.log('\n⏱️ 7. Aguardando 5 segundos após alteração...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 8. Verificar dados após alteração de velocidade
    console.log('\n📊 8. Dados após alteração de velocidade:');
    const finalShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        operatorId: USER_ID,
        shiftDate: today
      }
    });
    
    if (finalShiftData && afterWaitShiftData) {
      const productionDiff = finalShiftData.totalProduction - afterWaitShiftData.totalProduction;
      console.log(`   Produção antes da mudança: ${afterWaitShiftData.totalProduction}`);
      console.log(`   Produção após mudança: ${finalShiftData.totalProduction}`);
      console.log(`   Diferença: ${productionDiff} produtos`);
      
      if (productionDiff > 50) {
        console.log(`\n❌ SALTO DETECTADO! Produção aumentou ${productionDiff} produtos instantaneamente!`);
        console.log(`   Isso confirma que há recálculo com a nova velocidade`);
      } else {
        console.log(`\n✅ Comportamento normal. Diferença: ${productionDiff} produtos`);
      }
    }
    
    // 9. Aguardar mais 35 segundos para ver incrementos com nova velocidade
    console.log('\n⏱️ 9. Aguardando mais 35 segundos com nova velocidade...');
    await new Promise(resolve => setTimeout(resolve, 35000));
    
    const veryFinalShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        operatorId: USER_ID,
        shiftDate: today
      }
    });
    
    if (veryFinalShiftData && finalShiftData) {
      const incrementalDiff = veryFinalShiftData.totalProduction - finalShiftData.totalProduction;
      console.log(`\n📈 Incremento nos últimos 35 segundos: ${incrementalDiff} produtos`);
      console.log(`   Esperado com velocidade 10/min: ~5-6 produtos`);
      
      if (incrementalDiff >= 4 && incrementalDiff <= 7) {
        console.log(`✅ Incremento normal com nova velocidade!`);
      } else {
        console.log(`⚠️ Incremento anômalo: ${incrementalDiff} produtos`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWithOperation();