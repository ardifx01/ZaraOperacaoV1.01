const jwt = require('jsonwebtoken');
const axios = require('axios');

// Simular exatamente o fluxo do frontend TeflonChange
async function debugTeflonFrontendFlow() {
  console.log('🔍 DEBUGGING: Fluxo completo do TeflonChange frontend\n');
  
  try {
    // 1. Gerar token para operador Lucas
    const operatorPayload = {
      id: 2,
      role: 'OPERATOR'
    };
    
    const token = jwt.sign(operatorPayload, 'zara-jwt-secret-key-2024', { expiresIn: '24h' });
    console.log('🔑 Token gerado para operador Lucas');
    
    // 2. Simular carregamento de máquinas (como no TeflonChange.loadMachines)
    console.log('\n📡 Passo 1: Carregando máquinas da API...');
    const machinesResponse = await axios.get('http://localhost:3001/api/machines', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const allMachines = machinesResponse.data.data || [];
    console.log(`✅ Máquinas recebidas da API: ${allMachines.length}`);
    allMachines.forEach(machine => {
      console.log(`   - ${machine.name} (ID: ${machine.id}) - Status: ${machine.status}`);
    });
    
    // 3. Simular carregamento de permissões (como no useMachinePermissions)
    console.log('\n📡 Passo 2: Carregando permissões do operador...');
    const permissionsResponse = await axios.get(`http://localhost:3001/api/permissions?userId=2`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const permissions = permissionsResponse.data.data || [];
    console.log(`✅ Permissões carregadas: ${permissions.length}`);
    permissions.forEach(permission => {
      console.log(`   - Máquina ${permission.machineId} (${permission.machine?.name}): canView=${permission.canView}, canOperate=${permission.canOperate}`);
    });
    
    // 4. Simular filterMachinesByPermissions com 'canOperate'
    console.log('\n🔍 Passo 3: Aplicando filtro filterMachinesByPermissions(machines, "canOperate")...');
    
    const filteredMachines = allMachines.filter(machine => {
      const permission = permissions.find(p => p.machineId === machine.id);
      const canOperate = permission ? permission.canOperate : false;
      console.log(`   🔍 Máquina ${machine.id} (${machine.name}) - canOperate: ${canOperate}`);
      return canOperate;
    });
    
    console.log(`\n✅ Máquinas após filtro canOperate: ${filteredMachines.length}`);
    
    if (filteredMachines.length > 0) {
      console.log('\n📋 Máquinas que DEVERIAM aparecer no select do TeflonChange:');
      filteredMachines.forEach(machine => {
        console.log(`   ✅ ${machine.name} - ${machine.location}`);
      });
      
      console.log('\n🎯 DIAGNÓSTICO: O filtro está funcionando corretamente!');
      console.log('   Se as máquinas ainda não aparecem no frontend, verifique:');
      console.log('   1. Se o hook useMachinePermissions está sendo chamado corretamente');
      console.log('   2. Se há erros no console do navegador');
      console.log('   3. Se o estado das máquinas está sendo atualizado no componente');
      console.log('   4. Se o token está sendo enviado corretamente nas requisições');
    } else {
      console.log('\n❌ PROBLEMA: Nenhuma máquina passou no filtro canOperate!');
      console.log('   Isso significa que o operador não tem permissão de OPERAÇÃO em nenhuma máquina.');
      console.log('   Para troca de teflon, é necessário ter canOperate = true.');
    }
    
    // 5. Verificar se há diferença entre canView e canOperate
    const canViewMachines = allMachines.filter(machine => {
      const permission = permissions.find(p => p.machineId === machine.id);
      return permission ? permission.canView : false;
    });
    
    console.log('\n📊 Comparação de permissões:');
    console.log(`   - Máquinas com canView: ${canViewMachines.length}`);
    console.log(`   - Máquinas com canOperate: ${filteredMachines.length}`);
    
    if (canViewMachines.length > filteredMachines.length) {
      console.log('\n⚠️  ATENÇÃO: O operador pode VER mais máquinas do que pode OPERAR!');
      console.log('   Isso é normal - para troca de teflon só aparecem máquinas que pode operar.');
    }
    
  } catch (error) {
    console.error('❌ Erro no debug:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

debugTeflonFrontendFlow();