const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNotifications() {
  try {
    console.log('🔔 Verificando notificações no banco de dados...');
    
    // Buscar todas as notificações recentes
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        user: {
          select: {
            name: true,
            role: true,
            email: true
          }
        }
      }
    });
    
    console.log(`\n📊 Total de notificações encontradas: ${notifications.length}`);
    
    if (notifications.length === 0) {
      console.log('❌ Nenhuma notificação encontrada no banco');
      return;
    }
    
    console.log('\n📋 Detalhes das notificações:');
    notifications.forEach((notification, index) => {
      console.log(`\n${index + 1}. ID: ${notification.id}`);
      console.log(`   Usuário: ${notification.user?.name || 'N/A'} (${notification.user?.role || 'N/A'})`);
      console.log(`   Email: ${notification.user?.email || 'N/A'}`);
      console.log(`   Tipo: ${notification.type}`);
      console.log(`   Título: ${notification.title}`);
      console.log(`   Mensagem: ${notification.message}`);
      console.log(`   Lida: ${notification.read ? 'Sim' : 'Não'}`);
      console.log(`   Prioridade: ${notification.priority}`);
      console.log(`   Criada em: ${notification.createdAt}`);
      
      if (notification.metadata) {
        try {
          const metadata = JSON.parse(notification.metadata);
          console.log(`   Metadata: ${JSON.stringify(metadata, null, 4)}`);
        } catch (e) {
          console.log(`   Metadata (raw): ${notification.metadata}`);
        }
      }
    });
    
    // Contar por usuário
    console.log('\n📊 Resumo por usuário:');
    const userCounts = {};
    notifications.forEach(n => {
      const userName = n.user?.name || 'Usuário desconhecido';
      const userRole = n.user?.role || 'Role desconhecida';
      const key = `${userName} (${userRole})`;
      userCounts[key] = (userCounts[key] || 0) + 1;
    });
    
    Object.entries(userCounts).forEach(([user, count]) => {
      console.log(`   ${user}: ${count} notificações`);
    });
    
    // Contar por tipo
    console.log('\n📊 Resumo por tipo:');
    const typeCounts = {};
    notifications.forEach(n => {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    });
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} notificações`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar notificações:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNotifications();