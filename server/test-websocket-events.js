const jwt = require('jsonwebtoken');
const io = require('socket.io-client');
const axios = require('axios');

// Configuração
const JWT_SECRET = 'zara-jwt-secret-key-2024';
const SERVER_URL = 'http://localhost:3001';
const API_URL = 'http://localhost:3001/api';

console.log('🧪 TESTE COMPLETO DE EVENTOS WEBSOCKET');
console.log('=====================================\n');

// Gerar tokens para diferentes usuários (usando IDs de teste do socketHandler)
const adminToken = jwt.sign(
  { id: '507f1f77bcf86cd799439014', role: 'ADMIN', name: 'Admin Teste', email: 'admin@zara.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const operatorToken = jwt.sign(
  { id: '507f1f77bcf86cd799439011', role: 'OPERATOR', name: 'Operador Teste', email: 'operador@zara.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🔑 Tokens gerados para Admin e Operator');

// Conectar sockets
const adminSocket = io(SERVER_URL, {
  auth: { token: adminToken },
  transports: ['websocket', 'polling'],
  timeout: 10000,
  forceNew: true
});

const operatorSocket = io(SERVER_URL, {
  auth: { token: operatorToken },
  transports: ['websocket', 'polling'],
  timeout: 10000,
  forceNew: true
});

let adminConnected = false;
let operatorConnected = false;
let eventsReceived = [];

// Eventos do Admin Socket
adminSocket.on('connect', () => {
  console.log('✅ Admin conectado:', adminSocket.id);
  adminConnected = true;
  checkAndRunTests();
});

adminSocket.on('machine:status:changed', (data) => {
  console.log('🔄 [ADMIN] Evento machine:status:changed:', data);
  eventsReceived.push({ type: 'machine:status:changed', user: 'admin', data });
});

adminSocket.on('machine:operation-started', (data) => {
  console.log('🚀 [ADMIN] Evento machine:operation-started:', data);
  eventsReceived.push({ type: 'machine:operation-started', user: 'admin', data });
});

adminSocket.on('notification', (data) => {
  console.log('🔔 [ADMIN] Notificação:', data);
  eventsReceived.push({ type: 'notification', user: 'admin', data });
});

// Eventos do Operator Socket
operatorSocket.on('connect', () => {
  console.log('✅ Operator conectado:', operatorSocket.id);
  operatorConnected = true;
  checkAndRunTests();
});

operatorSocket.on('machine:status:changed', (data) => {
  console.log('🔄 [OPERATOR] Evento machine:status:changed:', data);
  eventsReceived.push({ type: 'machine:status:changed', user: 'operator', data });
});

operatorSocket.on('machine:operation-started', (data) => {
  console.log('🚀 [OPERATOR] Evento machine:operation-started:', data);
  eventsReceived.push({ type: 'machine:operation-started', user: 'operator', data });
});

operatorSocket.on('notification', (data) => {
  console.log('🔔 [OPERATOR] Notificação:', data);
  eventsReceived.push({ type: 'notification', user: 'operator', data });
});

// Função para verificar se ambos estão conectados e executar testes
function checkAndRunTests() {
  if (adminConnected && operatorConnected) {
    console.log('\n🎯 Ambos os sockets conectados. Iniciando testes...\n');
    runTests();
  }
}

async function runTests() {
  try {
    console.log('📋 TESTE 1: Mudança de status de máquina');
    console.log('==========================================');
    
    // Buscar primeira máquina
    const machinesResponse = await axios.get(`${API_URL}/machines`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log('📋 Dados recebidos da API:', JSON.stringify(machinesResponse.data, null, 2));
    
    const machines = machinesResponse.data.data || machinesResponse.data.machines || (Array.isArray(machinesResponse.data) ? machinesResponse.data : []);
    console.log('📋 Máquinas extraídas:', machines);
    
    if (!machines || machines.length === 0) {
      console.log('❌ Nenhuma máquina encontrada para teste');
      return;
    }
    
    const machine = machines[0];
    console.log('📋 Primeira máquina:', JSON.stringify(machine, null, 2));
    console.log(`🏭 Testando com máquina: ${machine.name} (ID: ${machine.id})`);
    
    // Mudar status da máquina
    const newStatus = machine.status === 'FUNCIONANDO' ? 'FORA_DE_TURNO' : 'FUNCIONANDO';
    console.log(`🔄 Mudando status de ${machine.status} para ${newStatus}`);
    
    await axios.put(`${API_URL}/machines/${machine.id}/status`, 
      { status: newStatus },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    
    console.log('✅ Status alterado via API');
    
    // Aguardar eventos WebSocket
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n📋 TESTE 2: Início de operação');
    console.log('===============================');
    
    // Iniciar operação (se máquina estiver parada)
    if (newStatus === 'STOPPED') {
      console.log('🚀 Iniciando operação na máquina');
      
      await axios.post(`${API_URL}/machines/${machine.id}/start-operation`, 
        { notes: 'Teste de operação via WebSocket' },
        { headers: { Authorization: `Bearer ${operatorToken}` } }
      );
      
      console.log('✅ Operação iniciada via API');
      
      // Aguardar eventos WebSocket
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Mostrar resultados
    console.log('\n📊 RESULTADOS DOS TESTES:');
    console.log('=========================');
    
    if (eventsReceived.length > 0) {
      console.log(`✅ ${eventsReceived.length} eventos WebSocket recebidos:`);
      eventsReceived.forEach((event, index) => {
        console.log(`   ${index + 1}. [${event.user.toUpperCase()}] ${event.type}`);
      });
    } else {
      console.log('❌ Nenhum evento WebSocket foi recebido');
    }
    
    console.log('\n🔍 VERIFICAÇÕES:');
    console.log('================');
    
    const statusEvents = eventsReceived.filter(e => e.type === 'machine:status:changed');
    const operationEvents = eventsReceived.filter(e => e.type === 'machine:operation-started');
    
    console.log(`📈 Eventos de mudança de status: ${statusEvents.length}`);
    console.log(`🚀 Eventos de início de operação: ${operationEvents.length}`);
    
    if (statusEvents.length > 0) {
      console.log('✅ WebSocket para mudança de status: FUNCIONANDO');
    } else {
      console.log('❌ WebSocket para mudança de status: NÃO FUNCIONANDO');
    }
    
    if (operationEvents.length > 0) {
      console.log('✅ WebSocket para início de operação: FUNCIONANDO');
    } else {
      console.log('❌ WebSocket para início de operação: NÃO FUNCIONANDO');
    }
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
  } finally {
    console.log('\n🏁 Encerrando testes...');
    adminSocket.disconnect();
    operatorSocket.disconnect();
    process.exit(0);
  }
}

// Timeout de segurança
setTimeout(() => {
  console.log('⏰ Timeout atingido. Encerrando testes...');
  adminSocket.disconnect();
  operatorSocket.disconnect();
  process.exit(1);
}, 30000);

console.log('⏳ Aguardando conexões WebSocket...');