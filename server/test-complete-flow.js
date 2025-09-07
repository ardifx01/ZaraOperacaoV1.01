const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configurar axios
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000
});

async function testCompleteFlow() {
  try {
    console.log('🔄 Testando fluxo completo do frontend...');
    
    // 1. Gerar token de operador (simulando login)
    const operatorToken = jwt.sign(
      { id: 2, role: 'OPERATOR' },
      'zara-jwt-secret-key-2024',
      { expiresIn: '24h' }
    );
    
    console.log('🎫 Token gerado');
    
    // 2. Configurar headers de autenticação
    api.defaults.headers.common['Authorization'] = `Bearer ${operatorToken}`;
    
    // 3. Verificar autenticação (como o useAuth faz)
    console.log('\n1️⃣ Verificando autenticação...');
    const authResponse = await api.get('/auth/verify');
    const user = authResponse.data.data.user;
    console.log('✅ Usuário autenticado:', {
      id: user.id,
      name: user.name,
      role: user.role
    });
    
    // 4. Carregar permissões (como o useMachinePermissions faz)
    console.log('\n2️⃣ Carregando permissões...');
    const permissionsResponse = await api.get(`/permissions?userId=${user.id}`);
    const permissions = permissionsResponse.data.data || [];
    console.log('✅ Permissões carregadas:', permissions.length);
    
    // 5. Carregar máquinas (como o TeflonChange faz)
    console.log('\n3️⃣ Carregando máquinas...');
    const machinesResponse = await api.get('/machines');
    const machines = machinesResponse.data.data || [];
    console.log('✅ Máquinas carregadas:', machines.length);
    
    // 6. Simular filtro de máquinas (como o filterMachinesByPermissions faz)
    console.log('\n4️⃣ Filtrando máquinas por permissões...');
    
    // Para operadores, filtrar por permissões
    if (user.role === 'OPERATOR') {
      const machineIds = permissions.map(p => p.machineId);
      const filteredMachines = machines.filter(m => machineIds.includes(m.id));
      
      console.log('🔍 IDs de máquinas com permissão:', machineIds);
      console.log('✅ Máquinas filtradas:', filteredMachines.length);
      
      if (filteredMachines.length > 0) {
        console.log('\n📋 Máquinas disponíveis para o operador:');
        filteredMachines.forEach(machine => {
          console.log(`  - ${machine.name} (ID: ${machine.id}) - Status: ${machine.status}`);
        });
        
        console.log('\n✅ SUCESSO: O operador deveria ver', filteredMachines.length, 'máquinas no dropdown!');
      } else {
        console.log('\n❌ PROBLEMA: Nenhuma máquina filtrada para o operador!');
      }
    } else {
      console.log('✅ Usuário não é operador - veria todas as máquinas:', machines.length);
    }
    
    // 7. Verificar dados específicos
    console.log('\n5️⃣ Detalhes das permissões:');
    permissions.forEach(permission => {
      console.log(`  - Máquina ${permission.machineId} (${permission.machine?.name}): canView=${permission.canView}, canOperate=${permission.canOperate}`);
    });
    
    console.log('\n6️⃣ Detalhes das máquinas:');
    machines.forEach(machine => {
      console.log(`  - ${machine.name} (ID: ${machine.id}): Status=${machine.status}, Location=${machine.location}`);
    });
    
  } catch (error) {
    console.error('❌ Erro no fluxo:', error.response?.data || error.message);
  }
}

testCompleteFlow();