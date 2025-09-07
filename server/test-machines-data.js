const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuração
const JWT_SECRET = 'zara-jwt-secret-key-2024';
const API_URL = 'http://localhost:3001/api';

console.log('🔍 VERIFICANDO DADOS DAS MÁQUINAS');
console.log('=================================\n');

// Gerar token admin
const adminToken = jwt.sign(
  { id: 1, role: 'ADMIN', name: 'Admin Test', email: 'admin@test.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function checkMachinesData() {
  try {
    console.log('📡 Fazendo requisição para /api/machines...');
    
    const response = await axios.get(`${API_URL}/machines`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log('✅ Resposta recebida:');
    console.log('Status:', response.status);
    console.log('Dados:', JSON.stringify(response.data, null, 2));
    
    if (Array.isArray(response.data)) {
      console.log(`\n📊 Total de máquinas: ${response.data.length}`);
      
      if (response.data.length > 0) {
        const firstMachine = response.data[0];
        console.log('\n🏭 Primeira máquina:');
        console.log('ID:', firstMachine.id);
        console.log('Nome:', firstMachine.name || 'N/A');
        console.log('Status:', firstMachine.status || 'N/A');
        console.log('Tipo:', firstMachine.type || 'N/A');
        console.log('Localização:', firstMachine.location || 'N/A');
        
        console.log('\n🔧 Estrutura completa da primeira máquina:');
        console.log(JSON.stringify(firstMachine, null, 2));
      } else {
        console.log('❌ Nenhuma máquina encontrada');
      }
    } else {
      console.log('❌ Resposta não é um array:', typeof response.data);
    }
    
  } catch (error) {
    console.error('❌ Erro ao buscar máquinas:');
    console.error('Status:', error.response?.status);
    console.error('Mensagem:', error.message);
    console.error('Dados:', error.response?.data);
  }
}

checkMachinesData();