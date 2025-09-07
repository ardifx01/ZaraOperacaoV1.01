const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMachine2() {
  try {
    console.log('🔍 Verificando Máquina 02...');
    
    // Verificar operação ativa na Máquina 02
    const activeOp = await prisma.machineOperation.findFirst({
      where: {
        machineId: 2,
        status: 'ACTIVE'
      },
      include: {
        user: true,
        machine: true
      }
    });
    
    console.log('\n📊 Operação ativa na Máquina 02:');
    if (activeOp) {
      const duration = Math.floor((new Date() - new Date(activeOp.startTime)) / (1000 * 60));
      console.log(`   ID: ${activeOp.id}`);
      console.log(`   Usuário: ${activeOp.user.name} (${activeOp.user.email})`);
      console.log(`   Início: ${activeOp.startTime}`);
      console.log(`   Duração: ${duration} minutos`);
      console.log(`   Status: ${activeOp.status}`);
    } else {
      console.log('   ❌ Nenhuma operação ativa encontrada');
    }
    
    // Verificar status da máquina
    const machine = await prisma.machine.findUnique({
      where: { id: 2 }
    });
    
    console.log('\n🏭 Status da Máquina 02:');
    if (machine) {
      console.log(`   ID: ${machine.id}`);
      console.log(`   Nome: ${machine.name}`);
      console.log(`   Status: ${machine.status}`);
      console.log(`   Velocidade: ${machine.productionSpeed} pcs/min`);
      console.log(`   Ativa: ${machine.isActive}`);
    } else {
      console.log('   ❌ Máquina não encontrada');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMachine2();