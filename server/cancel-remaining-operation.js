const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cancelRemainingOperation() {
  try {
    console.log('=== Cancelando operação restante ===');
    
    // Buscar a operação ativa restante
    const activeOp = await prisma.machineOperation.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { name: true, email: true } },
        machine: { select: { name: true, code: true } }
      }
    });
    
    if (activeOp) {
      const duration = Math.round((new Date() - new Date(activeOp.startTime)) / 1000 / 60);
      console.log(`Encontrada operação ativa: ${activeOp.user.name} na ${activeOp.machine.name} (${duration} min)`);
      
      // Cancelar a operação
      await prisma.machineOperation.update({
        where: { id: activeOp.id },
        data: {
          status: 'CANCELLED',
          endTime: new Date(),
          notes: 'Operação cancelada manualmente - limpeza do sistema'
        }
      });
      
      // Atualizar status da máquina
      await prisma.machine.update({
        where: { id: activeOp.machineId },
        data: { status: 'STOPPED' }
      });
      
      console.log('Operação cancelada com sucesso!');
    } else {
      console.log('Nenhuma operação ativa encontrada.');
    }
    
    // Verificar se não há mais operações ativas
    const finalCheck = await prisma.machineOperation.count({
      where: { status: 'ACTIVE' }
    });
    
    console.log(`\nOperações ativas restantes: ${finalCheck}`);
    
    if (finalCheck === 0) {
      console.log('✅ Todas as operações foram finalizadas! Operadores podem agora iniciar novas operações.');
    }
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cancelRemainingOperation();