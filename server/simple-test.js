const http = require('http');
const jwt = require('jsonwebtoken');

// Gerar token
const token = jwt.sign(
  { id: 1, role: 'ADMIN' },
  'your-secret-key',
  { expiresIn: '1h' }
);

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testNotifications() {
  console.log('🧪 Testando notificações...');
  
  try {
    // Verificar notificações atuais
    console.log('\n📊 Verificando notificações atuais...');
    const response = await makeRequest('/api/notifications?limit=10');
    
    if (response.status === 200) {
      const notifications = response.data.data.notifications;
      console.log(`✅ Total de notificações: ${notifications.length}`);
      
      // Mostrar as últimas 3 notificações
      console.log('\n📋 Últimas notificações:');
      notifications.slice(0, 3).forEach((notification, index) => {
        console.log(`${index + 1}. [${notification.type}] ${notification.message}`);
        console.log(`   Usuário: ${notification.userId} | Criada: ${new Date(notification.createdAt).toLocaleString()}`);
      });
      
      // Verificar duplicatas nas últimas notificações
      const messages = notifications.map(n => n.message);
      const uniqueMessages = new Set(messages);
      
      console.log(`\n🔍 Análise de duplicatas:`);
      console.log(`   Total de mensagens: ${messages.length}`);
      console.log(`   Mensagens únicas: ${uniqueMessages.size}`);
      
      if (uniqueMessages.size < messages.length) {
        console.log('⚠️  Possíveis duplicatas detectadas!');
        
        // Encontrar duplicatas
        const messageCount = {};
        messages.forEach(msg => {
          messageCount[msg] = (messageCount[msg] || 0) + 1;
        });
        
        Object.entries(messageCount).forEach(([msg, count]) => {
          if (count > 1) {
            console.log(`   🔄 "${msg}" aparece ${count} vezes`);
          }
        });
      } else {
        console.log('✅ Nenhuma duplicata encontrada!');
      }
      
    } else {
      console.log(`❌ Erro ao buscar notificações: ${response.status}`);
      console.log(response.data);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Executar teste
testNotifications()
  .then(() => {
    console.log('\n🏁 Teste concluído');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });