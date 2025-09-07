const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkActiveOperations() {
  try {
    console.log('🔧 Verificando operações ativas...');
    
    const activeOperations = await prisma.machineOperation.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        machine: true,
        user: true
      }
    });
    
    console.log(`\n📊 Operações ativas encontradas: ${activeOperations.length}`);
    
    if (activeOperations.length === 0) {
      console.log('❌ Nenhuma operação ativa encontrada');
      console.log('💡 O serviço de produção só atualiza dados quando há operações ativas');
    } else {
      activeOperations.forEach(operation => {
        const duration = Math.floor((new Date() - new Date(operation.startTime)) / (1000 * 60));
        console.log(`- ${operation.machine.name}: ${operation.user.name}`);
        console.log(`  Início: ${operation.startTime}`);
        console.log(`  Duração: ${duration} minutos`);
        console.log(`  Status: ${operation.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar operações:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkActiveOperations();