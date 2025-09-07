const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');
const prisma = new PrismaClient();

async function testUserCredentials() {
  try {
    console.log('🔐 Testando credenciais dos usuários...');
    
    // Verificar senhas no banco
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        isActive: true
      },
      where: {
        role: {
          in: ['MANAGER', 'LEADER', 'ADMIN', 'OPERATOR']
        }
      }
    });
    
    console.log('\n📋 Verificando senhas no banco:');
    users.forEach(user => {
      const hasPassword = user.password ? '✅ Tem senha' : '❌ Sem senha';
      console.log(`${user.name} (${user.role}): ${hasPassword}`);
    });
    
    // Testar login com senha padrão '123456'
    console.log('\n🧪 Testando login com senha "123456":');
    
    const testPassword = '123456';
    
    for (const user of users) {
      try {
        console.log(`\n🔑 Testando ${user.name} (${user.role})...`);
        
        const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: user.email,
            password: testPassword
          })
        });
        
        const loginData = await loginResponse.json();
        
        if (loginData.success) {
          console.log(`✅ Login bem-sucedido para ${user.name}`);
          
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
            console.log(`📬 ${notifications.length} notificações, ${unreadCount} não lidas`);
            
            if (notifications.length > 0) {
              console.log('📋 Últimas notificações:');
              notifications.slice(0, 2).forEach((notif, index) => {
                const status = notif.isRead ? 'Lida' : 'Não lida';
                console.log(`   ${index + 1}. [${notif.type}] ${notif.title} - ${status}`);
              });
            }
          } else {
            console.log(`❌ Erro ao buscar notificações: ${notifsData.message}`);
          }
        } else {
          console.log(`❌ Falha no login: ${loginData.message}`);
          
          // Verificar se a senha está correta no banco
          if (user.password) {
            const isPasswordValid = await bcrypt.compare(testPassword, user.password);
            console.log(`   Senha no banco válida para "${testPassword}": ${isPasswordValid ? 'Sim' : 'Não'}`);
          }
        }
        
      } catch (error) {
        console.log(`❌ Erro ao testar ${user.name}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUserCredentials();