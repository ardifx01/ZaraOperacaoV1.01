const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuração
const API_BASE = 'http://localhost:3000/api';
const SECRET_KEY = 'your-secret-key';

// Gerar token de admin
const adminToken = jwt.sign(
  { id: 1, role: 'ADMIN' },
  SECRET_KEY,
  { expiresIn: '1h' }
);

const headers = {
  'Authorization': `Bearer ${adminToken}`,
  'Content-Type': 'application/json'
};

async function testNotificationDuplication() {
  console.log('🧪 Testando duplicação de notificações...');
  
  try {
    // 1. Limpar notificações existentes
    console.log('\n🧹 Limpando notificações existentes...');
    await axios.delete(`${API_BASE}/notifications/all`, { headers });
    
    // 2. Alterar status da máquina para gerar notificação
    console.log('\n🔄 Alterando status da máquina 1 para PARADA...');
    const statusResponse = await axios.put(
      `${API_BASE}/machines/1/status`,
      {
        status: 'PARADA',
        reason: 'Teste de duplicação',
        notes: 'Verificando se há notificações duplicadas'
      },
      { headers }
    );
    
    console.log('✅ Status alterado:', statusResponse.data.success);
    
    // 3. Aguardar um pouco para as notificações serem processadas
    console.log('\n⏳ Aguardando processamento das notificações...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Verificar quantas notificações foram criadas
    console.log('\n📊 Verificando notificações criadas...');
    const notificationsResponse = await axios.get(
      `${API_BASE}/notifications?limit=10`,
      { headers }
    );
    
    const notifications = notificationsResponse.data.data.notifications;
    console.log(`\n📨 Total de notificações: ${notifications.length}`);
    
    // 5. Filtrar notificações relacionadas ao teste
    const testNotifications = notifications.filter(n => 
      n.message.includes('Teste de duplicação') || 
      n.message.includes('PARADA')
    );
    
    console.log(`\n🔍 Notificações do teste: ${testNotifications.length}`);
    
    testNotifications.forEach((notification, index) => {
      console.log(`\n📋 Notificação ${index + 1}:`);
      console.log(`   ID: ${notification.id}`);
      console.log(`   Tipo: ${notification.type}`);
      console.log(`   Mensagem: ${notification.message}`);
      console.log(`   Usuário: ${notification.userId}`);
      console.log(`   Criada em: ${notification.createdAt}`);
    });
    
    // 6. Verificar se há duplicatas
    const uniqueMessages = new Set(testNotifications.map(n => n.message));
    const hasDuplicates = uniqueMessages.size < testNotifications.length;
    
    console.log(`\n🎯 Resultado do teste:`);
    console.log(`   Mensagens únicas: ${uniqueMessages.size}`);
    console.log(`   Total de notificações: ${testNotifications.length}`);
    console.log(`   Há duplicatas: ${hasDuplicates ? '❌ SIM' : '✅ NÃO'}`);
    
    if (hasDuplicates) {
      console.log('\n⚠️  PROBLEMA: Notificações duplicadas detectadas!');
      
      // Agrupar por mensagem para mostrar duplicatas
      const messageGroups = {};
      testNotifications.forEach(n => {
        if (!messageGroups[n.message]) {
          messageGroups[n.message] = [];
        }
        messageGroups[n.message].push(n);
      });
      
      Object.entries(messageGroups).forEach(([message, notifications]) => {
        if (notifications.length > 1) {
          console.log(`\n🔄 Mensagem duplicada (${notifications.length}x): "${message}"`);
          notifications.forEach(n => {
            console.log(`   - ID: ${n.id}, Usuário: ${n.userId}, Criada: ${n.createdAt}`);
          });
        }
      });
    } else {
      console.log('\n🎉 SUCESSO: Nenhuma notificação duplicada encontrada!');
    }
    
    // 7. Restaurar status da máquina
    console.log('\n🔄 Restaurando status da máquina para FUNCIONANDO...');
    await axios.put(
      `${API_BASE}/machines/1/status`,
      {
        status: 'FUNCIONANDO',
        reason: 'Fim do teste',
        notes: 'Restaurando status após teste'
      },
      { headers }
    );
    
    console.log('✅ Status restaurado');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Dados:', error.response.data);
    }
  }
}

// Executar teste
testNotificationDuplication()
  .then(() => {
    console.log('\n🏁 Teste concluído');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });