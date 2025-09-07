const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuração
const JWT_SECRET = 'zara-jwt-secret-key-2024';
const API_BASE_URL = 'http://localhost:3001/api';

// Função para gerar token JWT
function generateToken(userId, role) {
  return jwt.sign(
    { id: userId, role: role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Função para testar notificações
async function testFrontendNotifications() {
  console.log('🔍 Testando notificações para o frontend...');
  
  try {
    // Testar com usuário MANAGER
    const managerToken = generateToken(1, 'MANAGER');
    
    console.log('\n📋 Buscando notificações para MANAGER...');
    const response = await axios.get(`${API_BASE_URL}/notifications?limit=10`, {
      headers: {
        'Authorization': `Bearer ${managerToken}`
      }
    });
    
    console.log('✅ Resposta da API:');
    console.log('- Status:', response.status);
    console.log('- Success:', response.data.success);
    console.log('- Estrutura:', {
      hasData: !!response.data.data,
      hasNotifications: !!(response.data.data && response.data.data.notifications),
      notificationsCount: response.data.data?.notifications?.length || 0,
      unreadCount: response.data.data?.unreadCount || 0
    });
    
    if (response.data.data?.notifications?.length > 0) {
      console.log('\n📨 Primeira notificação:');
      const firstNotification = response.data.data.notifications[0];
      console.log('- ID:', firstNotification.id);
      console.log('- Tipo:', firstNotification.type);
      console.log('- Título:', firstNotification.title);
      console.log('- Mensagem:', firstNotification.message);
      console.log('- Lida:', firstNotification.read);
      console.log('- Data:', firstNotification.createdAt);
    } else {
      console.log('⚠️  Nenhuma notificação encontrada');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar notificações:', error.message);
    if (error.response) {
      console.error('- Status:', error.response.status);
      console.error('- Data:', error.response.data);
    }
  }
}

// Executar teste
testFrontendNotifications();