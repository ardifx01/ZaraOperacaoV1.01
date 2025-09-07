const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testMachineStatusChange() {
  console.log('🧪 Testando mudança de status via API');
  
  try {
    // 1. Fazer login como operador
    console.log('\n🔐 Fazendo login como operador...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'lucas.salviano@hotmail.com',
        password: '123456'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('📋 Resposta do login:', JSON.stringify(loginData, null, 2));
    
    if (!loginData.success) {
      throw new Error('Falha no login: ' + loginData.message);
    }
    
    const token = loginData.data.token;
    console.log('✅ Login realizado com sucesso');
    
    // 2. Verificar notificações antes da mudança
    console.log('\n📊 Verificando notificações antes da mudança...');
    const notifsBefore = await fetch('http://localhost:3001/api/notifications?page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const notifsBeforeData = await notifsBefore.json();
    console.log(`📬 Notificações antes: ${notifsBeforeData.data?.notifications?.length || 0}`);
    
    // 3. Alterar status da máquina
    console.log('\n🔄 Alterando status da máquina...');
    const statusResponse = await fetch('http://localhost:3001/api/machines/1/status', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        status: 'MANUTENCAO',
        reason: 'Teste de notificação via API',
        notes: 'Verificando se notificações chegam no frontend'
      })
    });
    
    const statusData = await statusResponse.json();
    console.log('📋 Resposta da mudança de status:', JSON.stringify(statusData, null, 2));
    
    if (!statusData.success) {
      throw new Error('Falha na mudança de status: ' + statusData.message);
    }
    
    console.log('✅ Status alterado com sucesso');
    
    // 4. Aguardar processamento
    console.log('\n⏳ Aguardando processamento das notificações...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Verificar notificações depois da mudança
    console.log('\n📊 Verificando notificações depois da mudança...');
    const notifsAfter = await fetch('http://localhost:3001/api/notifications?page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const notifsAfterData = await notifsAfter.json();
    console.log(`📬 Notificações depois: ${notifsAfterData.data?.notifications?.length || 0}`);
    
    // 6. Testar com outros usuários (gestor, líder, admin)
    console.log('\n👥 Testando notificações para outros usuários...');
    
    const testUsers = [
      { email: 'admin@zara.com', password: '123456', role: 'ADMIN' },
      { email: 'leader@zara.com', password: '123456', role: 'LEADER' },
      { email: 'manager@zara.com', password: '123456', role: 'MANAGER' }
    ];
    
    for (const user of testUsers) {
      try {
        console.log(`\n🔐 Testando login para ${user.role}...`);
        const userLoginResponse = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: user.email,
            password: user.password
          })
        });
        
        const userLoginData = await userLoginResponse.json();
        
        if (userLoginData.success) {
          const userToken = userLoginData.data.token;
          
          const userNotifs = await fetch('http://localhost:3001/api/notifications?page=1&limit=10', {
            headers: {
              'Authorization': `Bearer ${userToken}`
            }
          });
          
          const userNotifsData = await userNotifs.json();
          console.log(`📬 ${user.role}: ${userNotifsData.data?.notifications?.length || 0} notificações`);
          console.log(`📊 ${user.role}: ${userNotifsData.data?.unreadCount || 0} não lidas`);
          
          // Mostrar as últimas notificações
          if (userNotifsData.data?.notifications?.length > 0) {
            console.log(`📋 Últimas notificações para ${user.role}:`);
            userNotifsData.data.notifications.slice(0, 3).forEach((notif, index) => {
              console.log(`   ${index + 1}. ${notif.title} - ${notif.isRead ? 'Lida' : 'Não lida'}`);
              console.log(`      ${notif.message}`);
              console.log(`      Criada: ${new Date(notif.createdAt).toLocaleString()}`);
            });
          }
        } else {
          console.log(`❌ Falha no login para ${user.role}: ${userLoginData.message}`);
        }
      } catch (error) {
        console.log(`❌ Erro ao testar ${user.role}:`, error.message);
      }
    }
    
    console.log('\n🏁 Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.error('❌ Stack:', error.stack);
  }
}

testMachineStatusChange();