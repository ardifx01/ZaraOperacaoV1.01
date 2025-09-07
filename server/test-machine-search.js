const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testMachineSearch() {
  try {
    console.log('🔍 Testando busca de máquinas...');
    
    // Primeiro, vamos ver se existem máquinas
    const machines = await prisma.machine.findMany();
    console.log(`📊 Total de máquinas encontradas: ${machines.length}`);
    
    if (machines.length > 0) {
      console.log('\n📋 Máquinas existentes:');
      machines.forEach(machine => {
        console.log(`- ID: ${machine.id}, Código: ${machine.code}, Nome: ${machine.name}`);
      });
      
      // Testar busca por código
      const firstMachine = machines[0];
      console.log(`\n🔍 Testando busca por código: ${firstMachine.code}`);
      
      const foundByCode = await prisma.machine.findUnique({
        where: { code: firstMachine.code }
      });
      
      if (foundByCode) {
        console.log('✅ Busca por código funcionou!');
        console.log(`   Encontrada: ${foundByCode.name} (${foundByCode.code})`);
      } else {
        console.log('❌ Busca por código falhou!');
      }
      
      // Testar busca por ID
      console.log(`\n🔍 Testando busca por ID: ${firstMachine.id}`);
      
      const foundById = await prisma.machine.findUnique({
        where: { id: firstMachine.id }
      });
      
      if (foundById) {
        console.log('✅ Busca por ID funcionou!');
        console.log(`   Encontrada: ${foundById.name} (${foundById.code})`);
      } else {
        console.log('❌ Busca por ID falhou!');
      }
      
    } else {
      console.log('⚠️  Nenhuma máquina encontrada no banco de dados.');
      console.log('   Isso explica o erro "Máquina não encontrada".');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar busca:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testMachineSearch();