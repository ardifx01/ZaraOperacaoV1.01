const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixStuckOperations() {
  try {
    console.log('=== Corrigindo operações travadas ===');
    
    // Buscar operações ativas há mais de 24 horas (1440 minutos)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const stuckOperations = await prisma.machineOperation.findMany({
      where: {
        status: 'ACTIVE',
        startTime: {
          lt: oneDayAgo
        }
      },
      include: {
        user: {
          select: { name: true, email: true }
        },
        machine: {
          select: { name: true, code: true }
        }
      }
    });
    
    console.log(`Encontradas ${stuckOperations.length} operações travadas (mais de 24h ativas)`);
    
    if (stuckOperations.length > 0) {
      // Finalizar operações travadas
      const result = await prisma.machineOperation.updateMany({
        where: {
          status: 'ACTIVE',
          startTime: {
            lt: oneDayAgo
          }
        },
        data: {
          status: 'CANCELLED',
          endTime: new Date(),
          notes: 'Operação cancelada automaticamente - tempo excedido (>24h)'
        }
      });
      
      console.log(`${result.count} operações foram canceladas automaticamente.`);
      
      // Atualizar status das máquinas para STOPPED
      const machineIds = stuckOperations.map(op => op.machineId);
      const uniqueMachineIds = [...new Set(machineIds)];
      
      await prisma.machine.updateMany({
        where: {
          id: {
            in: uniqueMachineIds
          }
        },
        data: {
          status: 'STOPPED'
        }
      });
      
      console.log(`Status de ${uniqueMachineIds.length} máquinas foi atualizado para STOPPED.`);
      
      // Mostrar detalhes das operações canceladas
      stuckOperations.forEach(op => {
        const duration = Math.round((new Date() - new Date(op.startTime)) / 1000 / 60);
        console.log(`- Cancelada: ${op.user.name} na ${op.machine.name} (${duration} min)`);
      });
    }
    
    // Verificar operações restantes
    const remainingOps = await prisma.machineOperation.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { name: true, email: true } },
        machine: { select: { name: true, code: true } }
      }
    });
    
    console.log(`\nOperações ativas restantes: ${remainingOps.length}`);
    remainingOps.forEach(op => {
      const duration = Math.round((new Date() - new Date(op.startTime)) / 1000 / 60);
      console.log(`- ${op.user.name} na ${op.machine.name} (${duration} min)`);
    });
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixStuckOperations();