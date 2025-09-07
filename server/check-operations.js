const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOperations() {
  try {
    console.log('=== Verificando operações ativas ===');
    
    // Buscar operação ativa do usuário 2 na máquina 1
    const userOperation = await prisma.machineOperation.findFirst({
      where: {
        machineId: 1,
        userId: 2,
        status: 'ACTIVE'
      }
    });
    
    console.log('Operação do usuário 2 na máquina 1:', userOperation);
    
    // Buscar todas as operações ativas na máquina 1
    const allOperations = await prisma.machineOperation.findMany({
      where: {
        machineId: 1,
        status: 'ACTIVE'
      },
      include: {
        user: true,
        machine: true
      }
    });
    
    console.log('Todas operações ativas na máquina 1:', allOperations);
    
    // Verificar se existe alguma operação ativa para qualquer usuário
    const anyActiveOperation = await prisma.machineOperation.findFirst({
      where: {
        machineId: 1,
        status: 'ACTIVE'
      }
    });
    
    console.log('Existe operação ativa na máquina 1?', !!anyActiveOperation);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOperations();