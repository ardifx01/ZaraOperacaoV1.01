const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'zara-jwt-secret-key-2024';
const BASE_URL = 'http://localhost:3001';

// Usuários para testar
const users = [
  { id: 1, email: 'admin@zara.com', name: 'Administrador Sistema', role: 'ADMIN' },
  { id: 3, email: 'leader@zara.com', name: 'Maria Santos - Líder', role: 'LEADER' },
  { id: 4, email: 'manager@zara.com', name: 'João Silva - Gestor', role: 'MANAGER' }
];

async function testNotificationsAPI() {
  try {
    console.log('🔍 Testando API de notificações diretamente...');
    
    for (const user of users) {
      console.log(`\n👤 Testando ${user.name} (${user.role})...`);
      
      // Gerar token para o usuário
      const token = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      console.log(`🔑 Token gerado para ${user.name}`);
      
      // Fazer requisição para a API de notificações
      const response = await fetch(`${BASE_URL}/api/notifications?page=1&limit=10&type=MACHINE_STATUS`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📡 Status da resposta: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Resposta recebida:`);
        console.log(`   Success: ${data.success}`);
        
        if (data.data) {
          const notifications = data.data.notifications || [];
          const unreadCount = data.data.unreadCount || 0;
          
          console.log(`   Notificações: ${notifications.length}`);
          console.log(`   Não lidas: ${unreadCount}`);
          
          if (notifications.length > 0) {
            console.log('   📋 Últimas notificações:');
            notifications.slice(0, 3).forEach((notif, index) => {
              const createdAt = new Date(notif.createdAt).toLocaleString('pt-BR');
              console.log(`      ${index + 1}. [${notif.type}] ${notif.title}`);
              console.log(`         ${notif.message}`);
              console.log(`         Criada: ${createdAt}`);
              console.log(`         Lida: ${notif.read ? 'Sim' : 'Não'}`);
            });
          } else {
            console.log('   📭 Nenhuma notificação encontrada');
          }
          
          if (data.pagination) {
            console.log(`   📊 Paginação: ${data.pagination.page}/${data.pagination.totalPages} (Total: ${data.pagination.total})`);
          }
        } else {
          console.log('   ❌ Estrutura de dados inesperada:', JSON.stringify(data, null, 2));
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Erro na requisição: ${response.status}`);
        console.log(`   Resposta: ${errorText}`);
      }
    }
    
    console.log('\n🏁 Teste da API concluído!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testNotificationsAPI();