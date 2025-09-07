const fetch = require('node-fetch');

async function testNotificationsAPI() {
  try {
    console.log('🔔 Testando API de notificações...');
    
    // Primeiro, fazer login para obter token
    console.log('\n1. Fazendo login como MANAGER...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'manager@zara.com',
        password: '123456'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (!loginData.success) {
      console.log('❌ Falha no login');
      return;
    }
    
    const token = loginData.token;
    console.log('✅ Login realizado com sucesso');
    
    // Buscar notificações
    console.log('\n2. Buscando notificações...');
    const notificationsResponse = await fetch('http://localhost:3001/api/notifications?page=1&limit=10', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const notificationsData = await notificationsResponse.json();
    console.log('\n📊 Response status:', notificationsResponse.status);
    console.log('📊 Response data:', JSON.stringify(notificationsData, null, 2));
    
    if (notificationsData.success && notificationsData.notifications) {
      console.log(`\n✅ ${notificationsData.notifications.length} notificações encontradas`);
      console.log(`📊 Total: ${notificationsData.total}`);
      console.log(`📊 Não lidas: ${notificationsData.unreadCount}`);
      
      console.log('\n📋 Detalhes das notificações:');
      notificationsData.notifications.forEach((notification, index) => {
        console.log(`\n${index + 1}. ID: ${notification.id}`);
        console.log(`   Título: ${notification.title}`);
        console.log(`   Mensagem: ${notification.message}`);
        console.log(`   Tipo: ${notification.type}`);
        console.log(`   Lida: ${notification.read ? 'Sim' : 'Não'}`);
        console.log(`   Prioridade: ${notification.priority}`);
        console.log(`   Criada em: ${notification.createdAt}`);
      });
    } else {
      console.log('❌ Erro ao buscar notificações ou nenhuma notificação encontrada');
    }
    
    // Testar também para LEADER
    console.log('\n\n3. Testando para LEADER...');
    const leaderLoginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'leader@zara.com',
        password: '123456'
      })
    });
    
    const leaderLoginData = await leaderLoginResponse.json();
    if (leaderLoginData.success) {
      const leaderToken = leaderLoginData.token;
      
      const leaderNotificationsResponse = await fetch('http://localhost:3001/api/notifications?page=1&limit=10', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${leaderToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const leaderNotificationsData = await leaderNotificationsResponse.json();
      console.log('📊 LEADER - Response status:', leaderNotificationsResponse.status);
      console.log('📊 LEADER - Notificações encontradas:', leaderNotificationsData.notifications?.length || 0);
      console.log('📊 LEADER - Não lidas:', leaderNotificationsData.unreadCount || 0);
    }
    
    // Testar também para ADMIN
    console.log('\n\n4. Testando para ADMIN...');
    const adminLoginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@zara.com',
        password: '123456'
      })
    });
    
    const adminLoginData = await adminLoginResponse.json();
    if (adminLoginData.success) {
      const adminToken = adminLoginData.token;
      
      const adminNotificationsResponse = await fetch('http://localhost:3001/api/notifications?page=1&limit=10', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const adminNotificationsData = await adminNotificationsResponse.json();
      console.log('📊 ADMIN - Response status:', adminNotificationsResponse.status);
      console.log('📊 ADMIN - Notificações encontradas:', adminNotificationsData.notifications?.length || 0);
      console.log('📊 ADMIN - Não lidas:', adminNotificationsData.unreadCount || 0);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testNotificationsAPI();