const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMachineStatus() {
  try {
    await prisma.machine.update({
      where: { id: 1 },
      data: { status: 'FUNCIONANDO' }
    });
    
    console.log('✅ Status da Máquina 01d atualizado para FUNCIONANDO');
    
    // Verificar o status atualizado
    const machine = await prisma.machine.findUnique({
      where: { id: 1 },
      select: { name: true, status: true }
    });
    
    console.log(`Status atual: ${machine.name} - ${machine.status}`);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMachineStatus();