const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabaseDirect() {
  try {
    console.log('🔍 Testando dados diretos do banco de dados...');
    
    const MACHINE_ID = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 1. Verificar dados atuais do shiftData
    console.log('\n📊 1. Dados atuais do shiftData:');
    const currentShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        shiftDate: today
      }
    });
    
    if (currentShiftData) {
      console.log(`   ID: ${currentShiftData.id}`);
      console.log(`   Produção Total: ${currentShiftData.totalProduction}`);
      console.log(`   Criado em: ${currentShiftData.createdAt}`);
      console.log(`   Atualizado em: ${currentShiftData.updatedAt}`);
    } else {
      console.log('   Nenhum dado de turno encontrado');
    }
    
    // 2. Verificar dados da máquina
    console.log('\n⚙️ 2. Dados da máquina:');
    const machine = await prisma.machine.findUnique({
      where: { id: MACHINE_ID },
      select: {
        id: true,
        name: true,
        status: true,
        productionSpeed: true
      }
    });
    
    if (machine) {
      console.log(`   Nome: ${machine.name}`);
      console.log(`   Status: ${machine.status}`);
      console.log(`   Velocidade: ${machine.productionSpeed} produtos/min`);
    }
    
    // 3. Aguardar 5 segundos
    console.log('\n⏱️ 3. Aguardando 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 4. Verificar novamente os dados do shiftData
    console.log('\n📊 4. Dados do shiftData após 5 segundos:');
    const updatedShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        shiftDate: today
      }
    });
    
    if (updatedShiftData) {
      console.log(`   ID: ${updatedShiftData.id}`);
      console.log(`   Produção Total: ${updatedShiftData.totalProduction}`);
      console.log(`   Criado em: ${updatedShiftData.createdAt}`);
      console.log(`   Atualizado em: ${updatedShiftData.updatedAt}`);
      
      if (currentShiftData) {
        const productionDiff = updatedShiftData.totalProduction - currentShiftData.totalProduction;
        const timeDiff = new Date(updatedShiftData.updatedAt) - new Date(currentShiftData.updatedAt);
        console.log(`   Diferença de produção: ${productionDiff} produtos`);
        console.log(`   Diferença de tempo: ${Math.floor(timeDiff / 1000)} segundos`);
      }
    }
    
    // 5. Alterar velocidade da máquina diretamente no banco
    console.log('\n🚀 5. Alterando velocidade da máquina para 10 produtos/min...');
    await prisma.machine.update({
      where: { id: MACHINE_ID },
      data: { productionSpeed: 10 }
    });
    
    // 6. Aguardar 3 segundos
    console.log('\n⏱️ 6. Aguardando 3 segundos após alteração...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 7. Verificar dados do shiftData após alteração
    console.log('\n📊 7. Dados do shiftData após alteração de velocidade:');
    const finalShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        shiftDate: today
      }
    });
    
    if (finalShiftData) {
      console.log(`   ID: ${finalShiftData.id}`);
      console.log(`   Produção Total: ${finalShiftData.totalProduction}`);
      console.log(`   Criado em: ${finalShiftData.createdAt}`);
      console.log(`   Atualizado em: ${finalShiftData.updatedAt}`);
      
      if (updatedShiftData) {
        const productionDiff = finalShiftData.totalProduction - updatedShiftData.totalProduction;
        const timeDiff = new Date(finalShiftData.updatedAt) - new Date(updatedShiftData.updatedAt);
        console.log(`   Diferença de produção: ${productionDiff} produtos`);
        console.log(`   Diferença de tempo: ${Math.floor(timeDiff / 1000)} segundos`);
        
        if (productionDiff > 50) {
          console.log(`\n❌ SALTO DETECTADO! Produção aumentou ${productionDiff} produtos instantaneamente!`);
        } else {
          console.log(`\n✅ Comportamento normal. Diferença: ${productionDiff} produtos`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseDirect();