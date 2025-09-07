const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configurar axios
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000
});

async function testAuthAndData() {
  try {
    console.log('🔍 Testando autenticação e dados...');
    
    // Gerar token de operador
    const operatorToken = jwt.sign(
      { id: 2, role: 'OPERATOR' },
      'zara-jwt-secret-key-2024',
      { expiresIn: '24h' }
    );
    
    console.log('🎫 Token gerado:', operatorToken.substring(0, 50) + '...');
    
    // Configurar headers
    api.defaults.headers.common['Authorization'] = `Bearer ${operatorToken}`;
    
    // 1. Testar rota de verificação de usuário
    console.log('\n1️⃣ Testando /auth/verify...');
    try {
      const authResponse = await api.get('/auth/verify');
      console.log('✅ Auth verify:', authResponse.data);
    } catch (err) {
      console.log('❌ Auth verify falhou:', err.response?.data || err.message);
    }
    
    // 2. Testar rota de máquinas
    console.log('\n2️⃣ Testando /machines...');
    try {
      const machinesResponse = await api.get('/machines');
      console.log('✅ Máquinas:', {
        success: machinesResponse.data.success,
        count: machinesResponse.data.count,
        hasData: !!machinesResponse.data.data,
        dataLength: machinesResponse.data.data?.length
      });
    } catch (err) {
      console.log('❌ Máquinas falhou:', err.response?.data || err.message);
    }
    
    // 3. Testar rota de permissões
    console.log('\n3️⃣ Testando /permissions...');
    try {
      const permissionsResponse = await api.get('/permissions?userId=2');
      console.log('✅ Permissões:', {
        success: permissionsResponse.data.success,
        count: permissionsResponse.data.count,
        hasData: !!permissionsResponse.data.data,
        dataLength: permissionsResponse.data.data?.length
      });
      
      if (permissionsResponse.data.data?.length > 0) {
        console.log('📋 Primeira permissão:', permissionsResponse.data.data[0]);
      }
    } catch (err) {
      console.log('❌ Permissões falhou:', err.response?.data || err.message);
    }
    
    // 4. Testar simulação de filtro
    console.log('\n4️⃣ Testando simulação de filtro...');
    try {
      const machinesResponse = await api.get('/machines');
      const permissionsResponse = await api.get('/permissions?userId=2');
      
      const machines = machinesResponse.data.data || [];
      const permissions = permissionsResponse.data.data || [];
      
      console.log('📊 Dados para filtro:', {
        totalMachines: machines.length,
        totalPermissions: permissions.length
      });
      
      // Simular filtro
      const machineIds = permissions.map(p => p.machineId);
      const filteredMachines = machines.filter(m => machineIds.includes(m.id));
      
      console.log('🔍 Resultado do filtro:', {
        machineIdsWithPermission: machineIds,
        filteredMachinesCount: filteredMachines.length,
        filteredMachines: filteredMachines.map(m => ({ id: m.id, name: m.name }))
      });
      
    } catch (err) {
      console.log('❌ Simulação de filtro falhou:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testAuthAndData();