async function testFrontendFlow() {
  try {
    console.log('=== Testando fluxo do frontend ===');
    
    // 1. Login com Lucas
    console.log('\n1. Fazendo login com Lucas...');
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'lucas.salviano@hotmail.com',
        password: '123456'
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    const user = loginData.data.user;
    console.log('✅ Login realizado com sucesso');
    console.log('Usuário:', user.name, '- Role:', user.role, '- ID:', user.id);
    
    // 2. Carregar permissões (como o frontend faz)
    console.log('\n2. Carregando permissões do usuário...');
    const permissionsResponse = await fetch(`http://localhost:3001/api/permissions?userId=${user.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const permissionsData = await permissionsResponse.json();
    console.log('✅ Permissões carregadas com sucesso');
    console.log('Permissões encontradas:', permissionsData.data.length);
    
    permissionsData.data.forEach(permission => {
      console.log(`- Máquina ${permission.machine.name} (ID: ${permission.machineId})`);
      console.log(`  canView: ${permission.canView}, canOperate: ${permission.canOperate}, canEdit: ${permission.canEdit}`);
    });
    
    // 3. Testar acesso à máquina 1
    console.log('\n3. Testando acesso à máquina 1...');
    const machineResponse = await fetch('http://localhost:3001/api/machines/1', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const machineData = await machineResponse.json();
    console.log('✅ Acesso à máquina 1 permitido');
    console.log('Máquina:', machineData.data.name);
    
    // 4. Simular verificação de permissão do frontend
    console.log('\n4. Simulando verificação de permissão do frontend...');
    const permissions = permissionsData.data;
    const machineId = 1;
    const permission = permissions.find(p => p.machineId === machineId);
    const hasPermission = permission ? permission.canView : false;
    
    console.log(`Permissão para máquina ${machineId}:`, hasPermission);
    
    if (hasPermission) {
      console.log('✅ Frontend deveria permitir acesso');
    } else {
      console.log('❌ Frontend bloquearia o acesso');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testFrontendFlow();