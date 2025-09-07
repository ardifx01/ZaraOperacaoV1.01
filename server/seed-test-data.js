const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function createQualityTest(machineId, userId, testDate) {
  const products = ['Embalagem Zip Lock', 'Saco Plástico', 'Embalagem Vacuum', 'Saco Multiuso', 'Embalagem Alimentar'];
  const packageSizes = ['P', 'M', 'G', 'GG'];
  const observations = [
    'Dimensões fora do padrão',
    'Problema na selagem',
    'Material com defeito',
    'Teste de hermeticidade falhou'
  ];

  const approved = Math.random() > 0.15; // 85% aprovação

  return {
    machineId,
    userId,
    product: products[Math.floor(Math.random() * products.length)],
    lot: `LOTE${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
    boxNumber: `BOX${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
    packageSize: packageSizes[Math.floor(Math.random() * packageSizes.length)],
    packageWidth: Math.random() * 10 + 5,
    bottomSize: Math.random() * 5 + 2,
    sideSize: Math.random() * 3 + 1,
    zipperDistance: Math.random() * 2 + 0.5,
    facilitatorDistance: Math.random() * 1.5 + 0.3,
    rulerTestDone: Math.random() > 0.1,
    hermeticityTestDone: Math.random() > 0.1,
    approved,
    observations: approved ? null : observations[Math.floor(Math.random() * observations.length)],
    testDate
  };
}

async function seedTestData() {
  try {
    console.log('🌱 Iniciando população do banco com dados de teste...');

    // Buscar máquinas e usuários existentes
    const machines = await prisma.machine.findMany({ where: { isActive: true } });
    const users = await prisma.user.findMany({ where: { isActive: true } });

    if (machines.length === 0 || users.length === 0) {
      console.log('❌ Não há máquinas ou usuários ativos no banco.');
      return;
    }

    console.log(`📊 Encontradas ${machines.length} máquinas e ${users.length} usuários`);

    // Criar testes de qualidade para os últimos 30 dias
    const qualityTests = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const testDate = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      
      // 5-15 testes por dia
      const testsPerDay = Math.floor(Math.random() * 11) + 5;
      
      for (let j = 0; j < testsPerDay; j++) {
        const randomMachine = machines[Math.floor(Math.random() * machines.length)];
        const randomUser = users[Math.floor(Math.random() * users.length)];
        
        qualityTests.push(createQualityTest(randomMachine.id, randomUser.id, testDate));
      }
    }

    // Inserir testes em lotes
    console.log(`📝 Inserindo ${qualityTests.length} testes de qualidade...`);
    await prisma.qualityTest.createMany({
      data: qualityTests
    });

    // Criar operações de máquina
    const operations = [];
    for (let i = 0; i < 30; i++) {
      const operationDate = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
      
      // 2-5 operações por dia
      const operationsPerDay = Math.floor(Math.random() * 4) + 2;
      
      for (let j = 0; j < operationsPerDay; j++) {
        const randomMachine = machines[Math.floor(Math.random() * machines.length)];
        const randomUser = users[Math.floor(Math.random() * users.length)];
        
        const startTime = new Date(operationDate);
        startTime.setHours(8 + j * 2, Math.floor(Math.random() * 60));
        
        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + Math.floor(Math.random() * 4) + 1);
        
        operations.push({
          machineId: randomMachine.id,
          userId: randomUser.id,
          startTime,
          endTime,
          status: Math.random() > 0.1 ? 'COMPLETED' : 'ACTIVE',
          notes: Math.random() > 0.7 ? 'Operação realizada com sucesso' : null
        });
      }
    }

    console.log(`🔧 Inserindo ${operations.length} operações...`);
    await prisma.machineOperation.createMany({
      data: operations
    });

    // Criar notificações de manutenção
    const maintenanceNotifications = [];
    for (let i = 0; i < 50; i++) {
      const notificationDate = new Date(thirtyDaysAgo.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);
      const randomMachine = machines[Math.floor(Math.random() * machines.length)];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      const types = ['MAINTENANCE', 'ALERT', 'WARNING'];
      const messages = [
        'Manutenção preventiva necessária',
        'Temperatura alta detectada',
        'Verificar sistema de refrigeração',
        'Limpeza programada'
      ];
      
      maintenanceNotifications.push({
        userId: randomUser.id,
        machineId: randomMachine.id,
        type: types[Math.floor(Math.random() * types.length)],
        title: 'Notificação de Manutenção',
        message: messages[Math.floor(Math.random() * messages.length)],
        read: Math.random() > 0.3,
        createdAt: notificationDate
      });
    }

    console.log(`🔔 Inserindo ${maintenanceNotifications.length} notificações...`);
    await prisma.notification.createMany({
      data: maintenanceNotifications
    });

    console.log('✅ Dados de teste inseridos com sucesso!');
    console.log(`📊 Resumo:`);
    console.log(`   - ${qualityTests.length} testes de qualidade`);
    console.log(`   - ${operations.length} operações de máquina`);
    console.log(`   - ${maintenanceNotifications.length} notificações`);

  } catch (error) {
    console.error('❌ Erro ao inserir dados de teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();