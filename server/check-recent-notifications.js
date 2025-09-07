const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecentNotifications() {
  try {
    console.log('🔍 Verificando notificações recentes...');
    
    // Buscar as 10 notificações mais recentes
    const notifications = await prisma.notification.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 10,
      include: {
        user: {
          select: {
            name: true,
            role: true
          }
        }
      }
    });
    
    console.log(`📊 Total de notificações encontradas: ${notifications.length}`);
    
    if (notifications.length > 0) {
      console.log('\n📋 Notificações recentes:');
      notifications.forEach((notif, index) => {
        const createdAt = new Date(notif.createdAt).toLocaleString('pt-BR');
        console.log(`\n${index + 1}. ID: ${notif.id}`);
        console.log(`   Tipo: ${notif.type}`);
        console.log(`   Título: ${notif.title}`);
        console.log(`   Mensagem: ${notif.message}`);
        console.log(`   Usuário: ${notif.user?.name} (${notif.user?.role})`);
        console.log(`   Lida: ${notif.read ? 'Sim' : 'Não'}`);
        console.log(`   Criada: ${createdAt}`);
        
        if (notif.metadata) {
          try {
            const metadata = JSON.parse(notif.metadata);
            console.log(`   Metadata:`, metadata);
          } catch (e) {
            console.log(`   Metadata (raw): ${notif.metadata}`);
          }
        }
      });
    } else {
      console.log('❌ Nenhuma notificação encontrada!');
    }
    
    // Verificar notificações por usuário específico
    console.log('\n👥 Verificando notificações por usuário:');
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['MANAGER', 'LEADER', 'ADMIN']
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        role: true
      }
    });
    
    for (const user of users) {
      const userNotifications = await prisma.notification.findMany({
        where: {
          userId: user.id
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      });
      
      console.log(`\n${user.name} (${user.role}) - ID: ${user.id}`);
      console.log(`   Total de notificações: ${userNotifications.length}`);
      
      if (userNotifications.length > 0) {
        userNotifications.forEach((notif, index) => {
          const createdAt = new Date(notif.createdAt).toLocaleString('pt-BR');
          console.log(`   ${index + 1}. [${notif.type}] ${notif.title} - ${createdAt}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentNotifications();