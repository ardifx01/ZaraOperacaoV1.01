const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabaseRunning() {
  try {
    console.log('🔍 Testando dados diretos do banco com máquina funcionando...');
    
    const MACHINE_ID = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 1. Colocar máquina em funcionamento
    console.log('\n🚀 1. Colocando máquina em funcionamento...');
    await prisma.machine.update({
      where: { id: MACHINE_ID },
      data: { 
        status: 'FUNCIONANDO',
        productionSpeed: 2
      }
    });
    
    // 2. Verificar dados atuais do shiftData
    console.log('\n📊 2. Dados atuais do shiftData:');
    let currentShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        shiftDate: today
      }
    });
    
    if (currentShiftData) {
      console.log(`   ID: ${currentShiftData.id}`);
      console.log(`   Produção Total: ${currentShiftData.totalProduction}`);
      console.log(`   Atualizado em: ${currentShiftData.updatedAt}`);
    } else {
      console.log('   Nenhum dado de turno encontrado');
      // Criar dados de turno se não existir
      currentShiftData = await prisma.shiftData.create({
        data: {
          machineId: MACHINE_ID,
          operatorId: 1,
          shiftDate: today,
          totalProduction: 100,
          shiftType: 'MANHA'
        }
      });
      console.log(`   Criado novo shiftData com produção inicial: ${currentShiftData.totalProduction}`);
    }
    
    // 3. Aguardar 10 segundos para o realTimeProductionService atuar
    console.log('\n⏱️ 3. Aguardando 10 segundos para o realTimeProductionService...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // 4. Verificar dados após aguardar
    console.log('\n📊 4. Dados do shiftData após aguardar:');
    const afterWaitShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        shiftDate: today
      }
    });
    
    if (afterWaitShiftData) {
      console.log(`   Produção Total: ${afterWaitShiftData.totalProduction}`);
      console.log(`   Atualizado em: ${afterWaitShiftData.updatedAt}`);
      
      const productionDiff = afterWaitShiftData.totalProduction - currentShiftData.totalProduction;
      console.log(`   Diferença de produção: ${productionDiff} produtos`);
    }
    
    // 5. Alterar velocidade para 8 produtos/min
    console.log('\n🚀 5. Alterando velocidade para 8 produtos/min...');
    await prisma.machine.update({
      where: { id: MACHINE_ID },
      data: { productionSpeed: 8 }
    });
    
    // 6. Aguardar 5 segundos
    console.log('\n⏱️ 6. Aguardando 5 segundos após alteração...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 7. Verificar dados após alteração de velocidade
    console.log('\n📊 7. Dados do shiftData após alteração de velocidade:');
    const finalShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        shiftDate: today
      }
    });
    
    if (finalShiftData && afterWaitShiftData) {
      console.log(`   Produção Total: ${finalShiftData.totalProduction}`);
      console.log(`   Atualizado em: ${finalShiftData.updatedAt}`);
      
      const productionDiff = finalShiftData.totalProduction - afterWaitShiftData.totalProduction;
      const timeDiff = new Date(finalShiftData.updatedAt) - new Date(afterWaitShiftData.updatedAt);
      console.log(`   Diferença de produção: ${productionDiff} produtos`);
      console.log(`   Diferença de tempo: ${Math.floor(timeDiff / 1000)} segundos`);
      
      if (productionDiff > 20) {
        console.log(`\n❌ SALTO DETECTADO! Produção aumentou ${productionDiff} produtos instantaneamente!`);
        console.log(`   Isso indica que algum processo está recalculando a produção com a nova velocidade`);
      } else {
        console.log(`\n✅ Comportamento normal. Diferença: ${productionDiff} produtos`);
      }
    }
    
    // 8. Aguardar mais 30 segundos para ver se há atualizações incrementais
    console.log('\n⏱️ 8. Aguardando mais 30 segundos para observar incrementos...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    const veryFinalShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        shiftDate: today
      }
    });
    
    if (veryFinalShiftData && finalShiftData) {
      const incrementalDiff = veryFinalShiftData.totalProduction - finalShiftData.totalProduction;
      console.log(`\n📈 Incremento nos últimos 30 segundos: ${incrementalDiff} produtos`);
      console.log(`   Esperado com velocidade 8/min: ~4 produtos`);
      
      if (incrementalDiff >= 3 && incrementalDiff <= 5) {
        console.log(`✅ Incremento normal detectado!`);
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

testDatabaseRunning();