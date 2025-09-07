const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNotificationSave() {
  console.log('🧪 Testando salvamento de notificação...');
  
  try {
    // Primeiro, verificar se há usuários
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['LEADER', 'MANAGER', 'ADMIN']
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        role: true
      }
    });
    
    console.log(`📋 Usuários encontrados: ${users.length}`);
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.role}) - ID: ${user.id}`);
    });
    
    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado para teste');
      return;
    }
    
    // Testar criação de notificação para o primeiro usuário
    const testUser = users[0];
    console.log(`\n🔧 Testando criação de notificação para: ${testUser.name}`);
    
    const notificationData = {
      type: 'MACHINE_STATUS',
      title: 'Teste de Notificação',
      message: 'Esta é uma notificação de teste',
      userId: testUser.id,
      machineId: 1,
      priority: 'MEDIUM',
      channels: JSON.stringify(['EMAIL', 'PUSH', 'SYSTEM']),
      metadata: JSON.stringify({
        status: 'FUNCIONANDO',
        machineName: 'Máquina Teste',
        location: 'Setor Teste'
      }),
      read: false
    };
    
    console.log('📝 Dados da notificação:');
    console.log(JSON.stringify(notificationData, null, 2));
    
    const notification = await prisma.notification.create({
      data: notificationData
    });
    
    console.log('\n✅ Notificação criada com sucesso!');
    console.log(`   ID: ${notification.id}`);
    console.log(`   Título: ${notification.title}`);
    console.log(`   Usuário ID: ${notification.userId}`);
    console.log(`   Criada em: ${notification.createdAt}`);
    
    // Verificar se a notificação foi salva
    const savedNotification = await prisma.notification.findUnique({
      where: { id: notification.id },
      include: {
        user: {
          select: { name: true, role: true }
        },
        machine: {
          select: { name: true }
        }
      }
    });
    
    console.log('\n🔍 Notificação recuperada do banco:');
    console.log(`   Título: ${savedNotification.title}`);
    console.log(`   Usuário: ${savedNotification.user?.name}`);
    console.log(`   Máquina: ${savedNotification.machine?.name}`);
    console.log(`   Metadata: ${savedNotification.metadata}`);
    
    // Limpar a notificação de teste
    await prisma.notification.delete({
      where: { id: notification.id }
    });
    
    console.log('\n🗑️  Notificação de teste removida');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('❌ Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o teste
testNotificationSave().then(() => {
  console.log('\n🎉 Teste concluído!');
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});