const axios = require('axios');
const jwt = require('jsonwebtoken');

async function testStatusParada() {
  try {
    console.log('🔍 Testando mudança de status para PARADA\n');
    
    // Gerar token de admin
    const adminToken = jwt.sign(
      { id: 1, role: 'ADMIN' },
      'zara-jwt-secret-key-2024'
    );
    
    console.log('1. Buscando máquinas disponíveis...');
    const machinesResponse = await axios.get('http://localhost:3001/api/machines', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    const machines = machinesResponse.data.data;
    if (!machines || machines.length === 0) {
      console.log('❌ Nenhuma máquina encontrada');
      return;
    }
    
    // Pegar a primeira máquina
    const testMachine = machines[0];
    console.log(`\n2. Testando com máquina: ${testMachine.name} (ID: ${testMachine.id})`);
    console.log(`   Status atual: ${testMachine.status}`);
    
    // Verificar dados antes da mudança
    console.log('\n3. Dados da máquina ANTES da mudança:');
    console.log(`   - name: "${testMachine.name}"`);
    console.log(`   - code: "${testMachine.code}"`);
    console.log(`   - status: "${testMachine.status}"`);
    console.log(`   - location: "${testMachine.location}"`);
    
    // Alterar status para PARADA
    console.log('\n4. Alterando status para PARADA...');
    const statusResponse = await axios.put(
      `http://localhost:3001/api/machines/${testMachine.id}/status`,
      {
        status: 'PARADA',
        reason: 'Teste de debug',
        notes: 'Testando problema undefined'
      },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Status alterado com sucesso!');
    console.log('📊 Response status:', statusResponse.status);
    
    // Verificar dados após a mudança
    console.log('\n5. Buscando dados atualizados da máquina...');
    const updatedMachineResponse = await axios.get(
      `http://localhost:3001/api/machines/${testMachine.id}`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      }
    );
    
    const updatedMachine = updatedMachineResponse.data.data;
    console.log('\n📋 Dados da máquina APÓS a mudança:');
    console.log(`   - name: "${updatedMachine.name}"`);
    console.log(`   - code: "${updatedMachine.code}"`);
    console.log(`   - status: "${updatedMachine.status}"`);
    console.log(`   - location: "${updatedMachine.location}"`);
    
    // Verificar se algum campo ficou undefined
    if (!updatedMachine.name || !updatedMachine.code) {
      console.log('\n🚨 PROBLEMA ENCONTRADO!');
      console.log('   - name está undefined:', !updatedMachine.name);
      console.log('   - code está undefined:', !updatedMachine.code);
    } else {
      console.log('\n✅ Todos os campos estão OK no backend');
      console.log('   O problema deve estar no frontend!');
    }
    
    // Testar busca geral novamente
    console.log('\n6. Verificando lista geral de máquinas...');
    const finalMachinesResponse = await axios.get('http://localhost:3001/api/machines', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    const finalMachines = finalMachinesResponse.data.data;
    const targetMachine = finalMachines.find(m => m.id === testMachine.id);
    
    if (targetMachine) {
      console.log('\n📋 Máquina na lista geral:');
      console.log(`   - name: "${targetMachine.name}"`);
      console.log(`   - code: "${targetMachine.code}"`);
      console.log(`   - status: "${targetMachine.status}"`);
      
      if (!targetMachine.name || !targetMachine.code) {
        console.log('\n🚨 PROBLEMA na lista geral!');
      } else {
        console.log('\n✅ Dados OK na lista geral também');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    if (error.response) {
      console.error('📄 Response data:', error.response.data);
      console.error('📊 Response status:', error.response.status);
    }
  }
}

testStatusParada();