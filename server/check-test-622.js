const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTest622() {
  try {
    console.log('🔍 Verificando teste ID 622...');
    
    // Verificar se o teste 622 existe
    const test622 = await prisma.qualityTest.findUnique({
      where: { id: 622 }
    });
    
    console.log('\n📊 Teste 622:', test622 ? 'Existe' : 'Não existe');
    
    if (test622) {
      console.log('   ID:', test622.id);
      console.log('   Produto:', test622.product);
      console.log('   Máquina ID:', test622.machineId);
      console.log('   Usuário ID:', test622.userId);
    }
    
    // Verificar últimos testes
    const allTests = await prisma.qualityTest.findMany({
      select: { id: true, product: true, createdAt: true },
      orderBy: { id: 'desc' },
      take: 10
    });
    
    console.log('\n📋 Últimos 10 testes:');
    allTests.forEach(test => {
      console.log(`   - ID: ${test.id}, Produto: ${test.product}, Criado: ${test.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTest622();