const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const JWT_SECRET = 'zara-jwt-secret-key-2024';

async function testJWT() {
  try {
    console.log('🔐 Testando JWT...');
    
    // Gerar token manualmente com o mesmo secret
    const userId = 4; // ID do manager
    const token = jwt.sign(
      { id: userId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('\n📝 Token gerado:', token);
    
    // Verificar se o token é válido
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token válido:', decoded);
    } catch (error) {
      console.log('❌ Token inválido:', error.message);
      return;
    }
    
    // Testar com a API
    console.log('\n🌐 Testando com a API...');
    const response = await fetch('http://localhost:3001/api/notifications?page=1&limit=5', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Status:', response.status);
    const data = await response.json();
    console.log('📊 Response:', JSON.stringify(data, null, 2));
    
    if (data.success && data.notifications) {
      console.log(`\n✅ ${data.notifications.length} notificações encontradas`);
      console.log(`📊 Total: ${data.total}`);
      console.log(`📊 Não lidas: ${data.unreadCount}`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testJWT();