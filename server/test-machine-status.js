const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://127.0.0.1:3001';
const JWT_SECRET = 'zara-jwt-secret-key-2024';

// Função para gerar token JWT
function generateToken(userId, role) {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

// Função para fazer requisições autenticadas
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    console.log(`Response status: ${response.status}`);
    const text = await response.text();
    console.log(`Response text: ${text.substring(0, 200)}...`);

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.log('❌ Erro ao fazer parse do JSON:', parseError.message);
      return { success: false, error: 'Invalid JSON response', rawText: text };
    }

    return data;
  } catch (error) {
    console.error('❌ Erro na requisição:', error.message);
    return { success: false, error: error.message };
  }
}

async function testMachineStatusNotification() {
  console.log('🧪 Testando notificações de mudança de status de máquina...');
  
  try {
    // 1. Verificar máquinas disponíveis
    console.log('\n📋 Verificando máquinas disponíveis...');
    const operatorToken = generateToken(2, 'OPERATOR'); // Lucas
    
    const machinesResponse = await makeRequest(`${BASE_URL}/api/machines`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${operatorToken}`
      }
    });
    
    if (!machinesResponse.success) {
      console.log('❌ Erro ao buscar máquinas:', machinesResponse.error);
      return;
    }
    
    const machines = machinesResponse.data;
    console.log(`✅ ${machines.length} máquinas encontradas`);
    
    if (machines.length === 0) {
      console.log('❌ Nenhuma máquina encontrada para teste');
      return;
    }
    
    const testMachine = machines[0];
    console.log(`🔧 Testando com máquina: ${testMachine.name} (ID: ${testMachine.id})`);
    
    // 2. Verificar notificações antes da mudança
    console.log('\n📬 Verificando notificações antes da mudança...');
    const leaderToken = generateToken(3, 'LEADER'); // Leader
    
    const notificationsBefore = await makeRequest(`${BASE_URL}/api/notifications?limit=5`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${leaderToken}`
      }
    });
    
    const countBefore = notificationsBefore.success ? notificationsBefore.data.length : 0;
    console.log(`📊 Notificações antes: ${countBefore}`);
    
    // 3. Alterar status da máquina
    console.log('\n🔄 Alterando status da máquina...');
    const newStatus = testMachine.status === 'FUNCIONANDO' ? 'PARADA' : 'FUNCIONANDO';
    
    const statusResponse = await makeRequest(`${BASE_URL}/api/machines/${testMachine.id}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${operatorToken}`
      },
      body: JSON.stringify({
        status: newStatus,
        reason: 'Teste de notificação',
        notes: 'Testando se as notificações estão funcionando'
      })
    });
    
    if (!statusResponse.success) {
      console.log('❌ Erro ao alterar status:', statusResponse.message || statusResponse.error);
      return;
    }
    
    console.log(`✅ Status alterado de ${testMachine.status} para ${newStatus}`);
    
    // 4. Aguardar um pouco para processamento
    console.log('\n⏳ Aguardando processamento das notificações...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 5. Verificar notificações após a mudança
    console.log('\n📬 Verificando notificações após a mudança...');
    const notificationsAfter = await makeRequest(`${BASE_URL}/api/notifications?limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${leaderToken}`
      }
    });
    
    if (!notificationsAfter.success) {
      console.log('❌ Erro ao buscar notificações:', notificationsAfter.error);
      return;
    }
    
    const countAfter = notificationsAfter.data.length;
    console.log(`📊 Notificações após: ${countAfter}`);
    
    // 6. Verificar se há notificações de status de máquina
    const machineStatusNotifications = notificationsAfter.data.filter(n => 
      n.type === 'MACHINE_STATUS' && n.machineId === testMachine.id
    );
    
    console.log(`\n🔍 Notificações de status de máquina encontradas: ${machineStatusNotifications.length}`);
    
    if (machineStatusNotifications.length > 0) {
      console.log('\n✅ SUCESSO! Notificações de status estão sendo criadas:');
      machineStatusNotifications.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title} - ${notification.message}`);
        console.log(`      Criada em: ${new Date(notification.createdAt).toLocaleString('pt-BR')}`);
        console.log(`      Prioridade: ${notification.priority}`);
      });
    } else {
      console.log('\n❌ PROBLEMA! Nenhuma notificação de status de máquina foi criada.');
      console.log('\n🔍 Verificando todas as notificações recentes:');
      notificationsAfter.data.forEach((notification, index) => {
        console.log(`   ${index + 1}. Tipo: ${notification.type} - ${notification.title}`);
        console.log(`      Máquina ID: ${notification.machineId}`);
        console.log(`      Criada em: ${new Date(notification.createdAt).toLocaleString('pt-BR')}`);
      });
    }
    
    // 7. Verificar notificações no banco de dados diretamente
    console.log('\n🗄️  Verificando notificações no banco de dados...');
    const dbNotifications = await prisma.notification.findMany({
      where: {
        type: 'MACHINE_STATUS',
        machineId: testMachine.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5,
      include: {
        machine: {
          select: { name: true }
        }
      }
    });
    
    console.log(`📊 Notificações no banco: ${dbNotifications.length}`);
    if (dbNotifications.length > 0) {
      console.log('\n📋 Últimas notificações no banco:');
      dbNotifications.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title} - ${notification.message}`);
        console.log(`      Máquina: ${notification.machine?.name}`);
        console.log(`      Criada em: ${new Date(notification.createdAt).toLocaleString('pt-BR')}`);
        console.log(`      User ID: ${notification.userId || 'Global'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o teste
testMachineStatusNotification().then(() => {
  console.log('\n🎉 Teste concluído!');
}).catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});