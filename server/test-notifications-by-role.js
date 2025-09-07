const fetch = require('node-fetch');
require('dotenv').config();

async function testNotificationsByRole() {
  console.log('🧪 Testando notificações por tipo de usuário');
  
  // Usuários para testar
  const testUsers = [
    { email: 'lucas.salviano@hotmail.com', password: '123456', role: 'OPERATOR', name: 'Lucas (Operador)' },
    { email: 'manager@zara.com', password: '123456', role: 'MANAGER', name: 'Gestor' },
    { email: 'leader@zara.com', password: '123456', role: 'LEADER', name: 'Líder' },
    { email: 'admin@zara.com', password: '123456', role: 'ADMIN', name: 'Admin' }
  ];
  
  console.log('\n📊 Verificando notificações para cada usuário:');
  
  for (const user of testUsers) {
    try {
      console.log(`\n🔐 Testando ${user.name} (${user.role})...`);
      
      // Fazer login
      const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password
        })
      });
      
      const loginData = await loginResponse.json();
      
      if (!loginData.success) {
        console.log(`❌ Falha no login para ${user.name}: ${loginData.message}`);
        continue;
      }
      
      console.log(`✅ Login realizado para ${user.name}`);
      const token = loginData.data.token;
      
      // Buscar notificações
      const notifsResponse = await fetch('http://localhost:3001/api/notifications?page=1&limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const notifsData = await notifsResponse.json();
      
      if (notifsData.success) {
        const notifications = notifsData.data.notifications || [];
        const unreadCount = notifsData.data.unreadCount || 0;
        
        console.log(`📬 ${user.name}: ${notifications.length} notificações total, ${unreadCount} não lidas`);
        
        // Mostrar as últimas notificações
        if (notifications.length > 0) {
          console.log(`📋 Últimas notificações para ${user.name}:`);
          notifications.slice(0, 3).forEach((notif, index) => {
            const status = notif.isRead ? '✅ Lida' : '🔔 Não lida';
            const createdAt = new Date(notif.createdAt).toLocaleString('pt-BR');
            console.log(`   ${index + 1}. [${notif.type}] ${notif.title} - ${status}`);
            console.log(`      ${notif.message}`);
            console.log(`      Criada: ${createdAt}`);
            console.log(`      Prioridade: ${notif.priority}`);
            
            // Mostrar metadata se for notificação de máquina
            if (notif.metadata) {
              try {
                const metadata = typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : notif.metadata;
                if (metadata.machineName) {
                  console.log(`      Máquina: ${metadata.machineName} (${metadata.location})`);
                  console.log(`      Status: ${metadata.previousStatus} → ${metadata.status}`);
                  console.log(`      Operador: ${metadata.operatorName}`);
                }
              } catch (e) {
                // Ignorar erro de parsing
              }
            }
            console.log('');
          });
        } else {
          console.log(`📭 Nenhuma notificação encontrada para ${user.name}`);
        }
      } else {
        console.log(`❌ Erro ao buscar notificações para ${user.name}: ${notifsData.message}`);
      }
      
    } catch (error) {
      console.log(`❌ Erro ao testar ${user.name}:`, error.message);
    }
  }
  
  console.log('\n🏁 Teste de notificações por usuário concluído!');
}

testNotificationsByRole();