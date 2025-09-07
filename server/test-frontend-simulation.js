const jwt = require('jsonwebtoken');
const axios = require('axios');

async function testFrontendSimulation() {
  try {
    console.log('=== Simulação do Frontend - Teste de Troca de Teflon ===\n');
    
    // Gerar token para o operador (ID 2)
    const operatorToken = jwt.sign(
      { id: 2, role: 'OPERATOR' },
      'zara-jwt-secret-key-2024',
      { expiresIn: '1h' }
    );
    
    console.log('🔑 Token do operador gerado\n');
    
    // Simular chamada para buscar máquinas (como o frontend faz)
    console.log('📡 Fazendo chamada para /api/machines...');
    const machinesResponse = await axios.get('http://localhost:3001/api/machines', {
      headers: {
        'Authorization': `Bearer ${operatorToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Resposta da API de máquinas:');
    console.log('   Status:', machinesResponse.status);
    console.log('   Success:', machinesResponse.data.success);
    console.log('   Máquinas retornadas:', machinesResponse.data.data?.length || 0);
    console.log('   Estrutura da resposta:', Object.keys(machinesResponse.data));
    
    if (machinesResponse.data.data && machinesResponse.data.data.length > 0) {
      console.log('\n📋 Máquinas disponíveis para o operador:');
      machinesResponse.data.data.forEach((machine, index) => {
        console.log(`   ${index + 1}. ${machine.name} (${machine.code})`);
        console.log(`      - ID: ${machine.id}`);
        console.log(`      - Localização: ${machine.location}`);
        console.log(`      - Status: ${machine.status}`);
      });
    } else {
      console.log('❌ PROBLEMA: Nenhuma máquina retornada pela API!');
    }
    
    // Simular chamada para buscar permissões (como o hook useMachinePermissions faz)
    console.log('\n📡 Fazendo chamada para /api/permissions...');
    const permissionsResponse = await axios.get(`http://localhost:3001/api/permissions?userId=2`, {
      headers: {
        'Authorization': `Bearer ${operatorToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Resposta da API de permissões:');
    console.log('   Status:', permissionsResponse.status);
    console.log('   Success:', permissionsResponse.data.success);
    console.log('   Permissões retornadas:', permissionsResponse.data.data?.length || 0);
    console.log('   Estrutura da resposta:', Object.keys(permissionsResponse.data));
    
    if (permissionsResponse.data.data && permissionsResponse.data.data.length > 0) {
      console.log('\n🔐 Permissões do operador:');
      permissionsResponse.data.data.forEach((permission, index) => {
        console.log(`   ${index + 1}. Máquina ID: ${permission.machineId}`);
        console.log(`      - Pode Ver: ${permission.canView}`);
        console.log(`      - Pode Operar: ${permission.canOperate}`);
        console.log(`      - Pode Editar: ${permission.canEdit}`);
      });
      
      // Simular o filtro do frontend
      console.log('\n🔍 Simulando filtro do frontend (canOperate):');
      const machines = machinesResponse.data.data || [];
      const permissions = permissionsResponse.data.data || [];
      
      const operableMachines = machines.filter(machine => {
        const permission = permissions.find(p => p.machineId === machine.id);
        const canOperate = permission ? permission.canOperate : false;
        console.log(`   - ${machine.name}: ${canOperate ? '✅ Pode operar' : '❌ Não pode operar'}`);
        return canOperate;
      });
      
      console.log(`\n📊 Resultado do filtro:`);
      console.log(`   - Máquinas totais: ${machines.length}`);
      console.log(`   - Máquinas operáveis: ${operableMachines.length}`);
      
      if (operableMachines.length > 0) {
        console.log('\n✅ DIAGNÓSTICO: O filtro deveria funcionar corretamente!');
        console.log('   Máquinas que deveriam aparecer no select:');
        operableMachines.forEach(machine => {
          console.log(`   - ${machine.name} (${machine.code})`);
        });
        console.log('\n🔍 Se o select ainda estiver vazio, o problema pode ser:');
        console.log('   1. Hook useMachinePermissions não está sendo chamado');
        console.log('   2. Estado das máquinas não está sendo atualizado');
        console.log('   3. Componente select não está renderizando corretamente');
      } else {
        console.log('\n❌ PROBLEMA: Filtro não retorna máquinas operáveis!');
      }
    } else {
      console.log('❌ PROBLEMA: Nenhuma permissão retornada pela API!');
    }
    
  } catch (error) {
    console.error('❌ Erro na simulação:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testFrontendSimulation();