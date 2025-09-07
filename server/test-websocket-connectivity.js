const jwt = require('jsonwebtoken');
const io = require('socket.io-client');

// Configuração
const JWT_SECRET = 'zara-jwt-secret-key-2024';
const SERVER_URL = 'http://localhost:3001';

console.log('🧪 TESTE DE CONECTIVIDADE WEBSOCKET');
console.log('===================================\n');

// Gerar token para teste
const testToken = jwt.sign(
  { id: 1, role: 'ADMIN', name: 'Admin Test', email: 'admin@test.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🔑 Token gerado:', testToken.substring(0, 50) + '...');
console.log('🌐 Tentando conectar em:', SERVER_URL);

// Criar conexão WebSocket
const socket = io(SERVER_URL, {
  auth: { token: testToken },
  transports: ['websocket', 'polling'],
  timeout: 10000,
  forceNew: true
});

// Eventos de conexão
socket.on('connect', () => {
  console.log('✅ WebSocket conectado com sucesso!');
  console.log('🆔 Socket ID:', socket.id);
  console.log('🚀 Transporte usado:', socket.io.engine.transport.name);
  
  // Testar ping/pong
  console.log('\n📡 Testando ping/pong...');
  socket.emit('ping');
});

socket.on('pong', (data) => {
  console.log('✅ Pong recebido:', data);
});

socket.on('connection:established', (data) => {
  console.log('✅ Conexão estabelecida:', data);
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão:', error.message);
  console.error('📋 Detalhes do erro:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Desconectado:', reason);
});

socket.on('error', (error) => {
  console.error('❌ Erro no socket:', error);
});

// Testar eventos específicos
socket.on('machine:status:changed', (data) => {
  console.log('🔄 Evento machine:status:changed recebido:', data);
});

socket.on('machine:operation-started', (data) => {
  console.log('🚀 Evento machine:operation-started recebido:', data);
});

// Timeout para encerrar teste
setTimeout(() => {
  console.log('\n📊 RESULTADO DO TESTE:');
  console.log('======================');
  
  if (socket.connected) {
    console.log('✅ WebSocket está FUNCIONANDO corretamente');
    console.log('🔗 Conexão ativa:', socket.connected);
    console.log('🆔 Socket ID:', socket.id);
    console.log('🚀 Transporte:', socket.io.engine.transport.name);
  } else {
    console.log('❌ WebSocket NÃO está funcionando');
    console.log('🔗 Conexão ativa:', socket.connected);
  }
  
  console.log('\n🏁 Encerrando teste...');
  socket.disconnect();
  process.exit(0);
}, 5000);

console.log('\n⏳ Aguardando 5 segundos para teste completo...');