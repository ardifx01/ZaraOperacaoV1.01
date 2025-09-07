const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function updateUserPasswords() {
  try {
    console.log('🔐 Atualizando senhas dos usuários para "123456"...');
    
    const newPassword = '123456';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Usuários para atualizar
    const usersToUpdate = [
      { email: 'admin@zara.com', role: 'ADMIN' },
      { email: 'leader@zara.com', role: 'LEADER' },
      { email: 'manager@zara.com', role: 'MANAGER' }
    ];
    
    for (const userInfo of usersToUpdate) {
      try {
        const updatedUser = await prisma.user.update({
          where: {
            email: userInfo.email
          },
          data: {
            password: hashedPassword
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true
          }
        });
        
        console.log(`✅ Senha atualizada para ${updatedUser.name} (${updatedUser.role})`);
        
      } catch (error) {
        console.log(`❌ Erro ao atualizar ${userInfo.email}:`, error.message);
      }
    }
    
    console.log('\n🧪 Testando login após atualização...');
    
    // Testar login para cada usuário atualizado
    const fetch = require('node-fetch');
    
    for (const userInfo of usersToUpdate) {
      try {
        console.log(`\n🔑 Testando login para ${userInfo.email}...`);
        
        const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: userInfo.email,
            password: newPassword
          })
        });
        
        const loginData = await loginResponse.json();
        
        if (loginData.success) {
          console.log(`✅ Login bem-sucedido para ${userInfo.role}`);
          
          // Testar busca de notificações
          const notifsResponse = await fetch('http://localhost:3001/api/notifications?page=1&limit=5', {
            headers: {
              'Authorization': `Bearer ${loginData.data.token}`
            }
          });
          
          const notifsData = await notifsResponse.json();
          
          if (notifsData.success) {
            const notifications = notifsData.data.notifications || [];
            const unreadCount = notifsData.data.unreadCount || 0;
            console.log(`📬 ${notifications.length} notificações total, ${unreadCount} não lidas`);
            
            if (notifications.length > 0) {
              console.log('📋 Notificações encontradas:');
              notifications.forEach((notif, index) => {
                const status = notif.isRead ? 'Lida' : 'Não lida';
                const createdAt = new Date(notif.createdAt).toLocaleString('pt-BR');
                console.log(`   ${index + 1}. [${notif.type}] ${notif.title} - ${status}`);
                console.log(`      ${notif.message}`);
                console.log(`      Criada: ${createdAt}`);
                
                // Mostrar metadata se for notificação de máquina
                if (notif.metadata) {
                  try {
                    const metadata = typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : notif.metadata;
                    if (metadata.machineName) {
                      console.log(`      Máquina: ${metadata.machineName}`);
                      console.log(`      Status: ${metadata.previousStatus} → ${metadata.status}`);
                    }
                  } catch (e) {
                    // Ignorar erro de parsing
                  }
                }
                console.log('');
              });
            } else {
              console.log('📭 Nenhuma notificação encontrada');
            }
          } else {
            console.log(`❌ Erro ao buscar notificações: ${notifsData.message}`);
          }
        } else {
          console.log(`❌ Falha no login: ${loginData.message}`);
        }
        
      } catch (error) {
        console.log(`❌ Erro ao testar login para ${userInfo.email}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUserPasswords();