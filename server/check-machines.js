const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMachines() {
  try {
    const machines = await prisma.machine.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        productionSpeed: true
      }
    });
    
    console.log('Máquinas no sistema:');
    machines.forEach(m => {
      console.log(`- ${m.name} (ID: ${m.id}): ${m.status} - ${m.productionSpeed}pcs/min`);
    });
    
    const operations = await prisma.machineOperation.findMany({
      where: {
        status: 'ACTIVE',
        endTime: null
      },
      include: {
        user: true,
        machine: true
      }
    });
    
    console.log('\nOperações ativas:');
    operations.forEach(op => {
      const duration = Math.floor((new Date() - new Date(op.startTime)) / (1000 * 60));
      console.log(`- ${op.machine.name}: ${op.user.name} (${duration} min)`);
    });
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMachines();