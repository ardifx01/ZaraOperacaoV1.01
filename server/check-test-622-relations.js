const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTest622Relations() {
  try {
    console.log('🔍 Verificando relações do teste 622...');
    
    // Verificar o teste com includes
    const test = await prisma.qualityTest.findUnique({
      where: { id: 622 },
      include: {
        machine: {
          select: { name: true, code: true, location: true }
        },
        user: {
          select: { name: true, email: true, role: true }
        }
      }
    });
    
    if (test) {
      console.log('\n✅ Teste encontrado com relações:');
      console.log('   ID:', test.id);
      console.log('   Produto:', test.product);
      console.log('   Máquina ID:', test.machineId);
      console.log('   Usuário ID:', test.userId);
      console.log('   Máquina:', test.machine ? test.machine.name : 'Não encontrada');
      console.log('   Usuário:', test.user ? test.user.name : 'Não encontrado');
    } else {
      console.log('❌ Teste não encontrado');
    }
    
    // Verificar se a máquina existe
    const machine = await prisma.machine.findUnique({
      where: { id: test?.machineId || 2 }
    });
    
    console.log('\n🏭 Máquina ID 2:', machine ? 'Existe' : 'Não existe');
    if (machine) {
      console.log('   Nome:', machine.name);
      console.log('   Código:', machine.code);
    }
    
    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: test?.userId || 2 }
    });
    
    console.log('\n👤 Usuário ID 2:', user ? 'Existe' : 'Não existe');
    if (user) {
      console.log('   Nome:', user.name);
      console.log('   Email:', user.email);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkTest622Relations();