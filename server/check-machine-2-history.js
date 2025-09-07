const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMachine2History() {
  try {
    console.log('🔍 Verificando histórico da Máquina 02...');
    
    // Verificar últimas operações na Máquina 02
    const recentOperations = await prisma.machineOperation.findMany({
      where: {
        machineId: 2
      },
      include: {
        user: true,
        machine: true
      },
      orderBy: {
        startTime: 'desc'
      },
      take: 10
    });
    
    console.log(`\n📊 Últimas ${recentOperations.length} operações na Máquina 02:`);
    
    if (recentOperations.length === 0) {
      console.log('   ❌ Nenhuma operação encontrada');
    } else {
      recentOperations.forEach((op, index) => {
        const duration = op.endTime 
          ? Math.floor((new Date(op.endTime) - new Date(op.startTime)) / (1000 * 60))
          : Math.floor((new Date() - new Date(op.startTime)) / (1000 * 60));
        
        console.log(`\n   ${index + 1}. Operação ID: ${op.id}`);
        console.log(`      Usuário: ${op.user.name} (${op.user.email})`);
        console.log(`      Status: ${op.status}`);
        console.log(`      Início: ${op.startTime}`);
        console.log(`      Fim: ${op.endTime || 'Em andamento'}`);
        console.log(`      Duração: ${duration} minutos`);
        console.log(`      Notas: ${op.notes || 'Nenhuma'}`);
      });
    }
    
    // Verificar se há operações ACTIVE em outras máquinas
    const allActiveOps = await prisma.machineOperation.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        user: true,
        machine: true
      }
    });
    
    console.log(`\n🔧 Operações ativas em todas as máquinas: ${allActiveOps.length}`);
    
    if (allActiveOps.length > 0) {
      allActiveOps.forEach(op => {
        const duration = Math.floor((new Date() - new Date(op.startTime)) / (1000 * 60));
        console.log(`   - ${op.machine.name}: ${op.user.name} (${duration} min)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMachine2History();