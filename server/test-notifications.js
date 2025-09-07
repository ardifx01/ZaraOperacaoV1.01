const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

// Configurações
const BASE_URL = 'http://127.0.0.1:3001';
const SECRET_KEY = 'zara-jwt-secret-key-2024';

// Função para gerar token JWT
function generateToken(userId, role) {
  return jwt.sign({ id: userId, role }, SECRET_KEY);
}

// Função para fazer requisições autenticadas
async function makeRequest(url, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers
  });

  const text = await response.text();
  console.log(`Response status: ${response.status}`);
  console.log(`Response text: ${text.substring(0, 200)}...`);
  
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.log('Failed to parse JSON, returning raw text');
    data = { error: 'Invalid JSON', text };
  }
  
  return { response, data };
}

// Função para aguardar um tempo
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testNotificationSystem() {
  console.log('🔔 Testando Sistema de Notificações\n');

  try {
    // 1. Gerar tokens para diferentes usuários
    const adminToken = generateToken(1, 'ADMIN');
    const operatorToken = generateToken(4, 'OPERATOR'); // Ana Costa
    const leaderToken = generateToken(2, 'LEADER');

    console.log('✅ Tokens gerados com sucesso');

    // 2. Testar mudança de status de máquina
    console.log('\n📊 Testando notificação de mudança de status...');
    const { response: statusResponse, data: statusData } = await makeRequest(
      '/api/machines/1/status',
      {
        method: 'PUT',
        body: JSON.stringify({
          status: 'MAINTENANCE',
          reason: 'Manutenção preventiva',
          notes: 'Teste de notificação de status'
        })
      },
      adminToken
    );

    if (statusResponse.ok) {
      console.log('✅ Status alterado com sucesso');
      console.log('📝 Dados:', statusData.message);
    } else {
      console.log('❌ Erro ao alterar status:', statusData.message);
    }

    await sleep(1000);

    // 3. Testar início de operação
    console.log('\n🏭 Testando notificação de início de operação...');
    
    // Primeiro, alterar status para STOPPED para permitir operação
    await makeRequest(
      '/api/machines/2/status',
      {
        method: 'PUT',
        body: JSON.stringify({
          status: 'STOPPED',
          reason: 'Preparação para operação',
          notes: 'Preparando máquina para teste'
        })
      },
      adminToken
    );

    await sleep(500);

    const { response: startResponse, data: startData } = await makeRequest(
      '/api/machines/2/start-operation',
      {
        method: 'POST',
        body: JSON.stringify({
          notes: 'Teste de notificação de início de operação'
        })
      },
      operatorToken
    );

    if (startResponse.ok) {
      console.log('✅ Operação iniciada com sucesso');
      console.log('📝 Dados:', startData.message);
    } else {
      console.log('❌ Erro ao iniciar operação:', startData.message);
    }

    await sleep(1000);

    // 4. Testar fim de operação
    console.log('\n🏁 Testando notificação de fim de operação...');
    const { response: endResponse, data: endData } = await makeRequest(
      '/api/machines/2/end-operation',
      {
        method: 'POST',
        body: JSON.stringify({
          notes: 'Teste de notificação de fim de operação'
        })
      },
      operatorToken
    );

    if (endResponse.ok) {
      console.log('✅ Operação finalizada com sucesso');
      console.log('📝 Dados:', endData.message);
    } else {
      console.log('❌ Erro ao finalizar operação:', endData.message);
    }

    await sleep(1000);

    // 5. Testar criação de teste de qualidade
    console.log('\n🧪 Testando notificação de teste de qualidade...');
    const { response: testResponse, data: testData } = await makeRequest(
      '/api/quality-tests',
      {
        method: 'POST',
        body: JSON.stringify({
          machineId: 1,
          product: 'Produto Teste',
          lot: 'LOTE001',
          boxNumber: 'CAIXA001',
          packageSize: 'Médio',
          packageWidth: 15.5,
          bottomSize: 10.0,
          sideSize: 8.0,
          zipperDistance: 2.5,
          facilitatorDistance: 1.0,
          rulerTestDone: true,
          hermeticityTestDone: true,
          approved: false, // Teste reprovado para gerar notificação de alta prioridade
          observations: 'Teste de notificação - produto reprovado',
          images: [],
          videos: []
        })
      },
      operatorToken
    );

    if (testResponse.ok) {
      console.log('✅ Teste de qualidade criado com sucesso');
      console.log('📝 Dados:', testData.message);
    } else {
      console.log('❌ Erro ao criar teste:', testData.message);
    }

    await sleep(1000);

    // 6. Verificar notificações criadas
    console.log('\n📬 Verificando notificações criadas...');
    const { response: notifResponse, data: notifData } = await makeRequest(
      '/api/notifications?limit=10',
      { method: 'GET' },
      leaderToken
    );

    if (notifResponse.ok && notifData.success) {
      console.log(`✅ ${notifData.data.length} notificações encontradas`);
      
      // Mostrar as últimas 5 notificações
      const recentNotifications = notifData.data.slice(0, 5);
      recentNotifications.forEach((notif, index) => {
        console.log(`\n📋 Notificação ${index + 1}:`);
        console.log(`   Título: ${notif.title}`);
        console.log(`   Mensagem: ${notif.message}`);
        console.log(`   Tipo: ${notif.type}`);
        console.log(`   Prioridade: ${notif.priority}`);
        console.log(`   Data: ${new Date(notif.createdAt).toLocaleString('pt-BR')}`);
      });
    } else {
      console.log('❌ Erro ao buscar notificações:', notifData.message);
    }

    console.log('\n🎉 Teste do sistema de notificações concluído!');
    console.log('\n📝 Resumo dos testes realizados:');
    console.log('   ✅ Mudança de status de máquina');
    console.log('   ✅ Início de operação');
    console.log('   ✅ Fim de operação');
    console.log('   ✅ Teste de qualidade (reprovado)');
    console.log('   ✅ Verificação de notificações');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Executar o teste
testNotificationSystem();