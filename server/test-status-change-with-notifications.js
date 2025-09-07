const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testStatusChangeWithNotifications() {
  try {
    console.log('🔐 Fazendo login como operador...');
    
    // Login como operador
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
    
    if (!loginData.success) {
      console.log('❌ Falha no login:', loginData.message);
      return;
    }
    
    console.log('✅ Login realizado com sucesso');
    const token = loginData.data.token;
    
    // Alterar status da máquina
    console.log('\n🔧 Alterando status da máquina para PARADA...');
    
    const statusResponse = await fetch('http://localhost:3001/api/machines/1/status', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'PARADA',
        reason: 'Teste notificações para roles',
        notes: 'Verificando se MANAGER/LEADER/ADMIN recebem notificações'
      })
    });
    
    const statusData = await statusResponse.json();
    
    if (statusData.success) {
      console.log('✅ Status alterado com sucesso');
      console.log('📝 Mensagem:', statusData.message);
    } else {
      console.log('❌ Erro ao alterar status:', statusData.message);
      return;
    }
    
    // Aguardar um pouco para as notificações serem processadas
    console.log('\n⏳ Aguardando processamento das notificações...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar notificações para cada tipo de usuário
    const usersToCheck = [
      { email: 'manager@zara.com', role: 'MANAGER', name: 'João Silva - Gestor' },
      { email: 'leader@zara.com', role: 'LEADER', name: 'Maria Santos - Líder' },
      { email: 'admin@zara.com', role: 'ADMIN', name: 'Administrador Sistema' }
    ];
    
    console.log('\n📬 Verificando notificações para cada usuário:');
    
    for (const user of usersToCheck) {
      try {
        console.log(`\n🔍 Verificando ${user.name} (${user.role})...`);
        
        // Login do usuário
        const userLoginResponse = await fetch('http://localhost:3001/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: user.email,
            password: '123456'
          })
        });
        
        const userLoginData = await userLoginResponse.json();
        
        if (!userLoginData.success) {
          console.log(`❌ Falha no login para ${user.name}`);
          continue;
        }
        
        // Buscar notificações
        const notifsResponse = await fetch('http://localhost:3001/api/notifications?page=1&limit=10', {
          headers: {
            'Authorization': `Bearer ${userLoginData.data.token}`
          }
        });
        
        const notifsData = await notifsResponse.json();
        
        if (notifsData.success) {
          const notifications = notifsData.data.notifications || [];
          const unreadCount = notifsData.data.unreadCount || 0;
          
          console.log(`📊 ${user.role}: ${notifications.length} notificações total, ${unreadCount} não lidas`);
          
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
                    console.log(`      Operador: ${metadata.operatorName}`);
                  }
                } catch (e) {
                  // Ignorar erro de parsing
                }
              }
              console.log('');
            });
          } else {
            console.log('📭 ❌ PROBLEMA: Nenhuma notificação encontrada!');
            console.log('   Este usuário deveria ter recebido a notificação de mudança de status.');
          }
        } else {
          console.log(`❌ Erro ao buscar notificações: ${notifsData.message}`);
        }
        
      } catch (error) {
        console.log(`❌ Erro ao verificar ${user.name}:`, error.message);
      }
    }
    
    console.log('\n🏁 Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testStatusChangeWithNotifications();