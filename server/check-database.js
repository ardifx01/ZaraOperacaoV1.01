const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Verificando dados no banco de dados...');
    
    // Verificar máquinas
    const machineCount = await prisma.machine.count();
    console.log(`📱 Máquinas cadastradas: ${machineCount}`);
    
    if (machineCount > 0) {
      const machines = await prisma.machine.findMany({
        select: { id: true, name: true, status: true }
      });
      console.log('Máquinas:', machines);
    }
    
    // Verificar testes de qualidade
    const testCount = await prisma.qualityTest.count();
    console.log(`🧪 Testes de qualidade: ${testCount}`);
    
    if (testCount > 0) {
      const recentTests = await prisma.qualityTest.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          approved: true,
          createdAt: true,
          machine: { select: { name: true } }
        }
      });
      console.log('Testes recentes:', recentTests);
    }
    
    // Verificar operações de máquina
    const operationCount = await prisma.machineOperation.count();
    console.log(`⚙️ Operações de máquina: ${operationCount}`);
    
    // Verificar usuários
    const userCount = await prisma.user.count();
    console.log(`👥 Usuários cadastrados: ${userCount}`);
    
    // Verificar notificações
    const notificationCount = await prisma.notification.count();
    console.log(`🔔 Notificações: ${notificationCount}`);
    
  } catch (error) {
    console.error('❌ Erro ao verificar banco de dados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();