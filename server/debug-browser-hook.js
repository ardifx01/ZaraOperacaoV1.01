const jwt = require('jsonwebtoken');

// Script para testar o hook useMachinePermissions no navegador
function generateBrowserTestScript() {
  // Gerar token para operador Lucas
  const operatorPayload = {
    id: 2,
    role: 'OPERATOR'
  };
  
  const token = jwt.sign(operatorPayload, 'zara-jwt-secret-key-2024', { expiresIn: '24h' });
  
  console.log('🔧 SCRIPT PARA TESTAR NO NAVEGADOR:');
  console.log('\n1. Abra o navegador e vá para: http://localhost:5173/teflon-change');
  console.log('\n2. Abra o Console do Desenvolvedor (F12)');
  console.log('\n3. Execute os seguintes comandos:');
  console.log('\n// Configurar autenticação');
  console.log(`localStorage.setItem('token', '${token}');`);
  console.log(`localStorage.setItem('user', JSON.stringify({`);
  console.log(`  id: 2,`);
  console.log(`  name: 'Lucas Operator',`);
  console.log(`  email: 'lucas@zara.com',`);
  console.log(`  role: 'OPERATOR'`);
  console.log(`}));`);
  console.log('\n// Recarregar a página');
  console.log('location.reload();');
  console.log('\n4. Após recarregar, execute para monitorar:');
  console.log('\n// Monitorar logs do hook');
  console.log('console.clear();');
  console.log('console.log("🔍 Monitorando hook useMachinePermissions...");');
  console.log('\n// Verificar se as máquinas estão sendo carregadas');
  console.log('setTimeout(() => {');
  console.log('  const selectElement = document.querySelector("select[name=\'machineId\']");');
  console.log('  if (selectElement) {');
  console.log('    const options = Array.from(selectElement.options);');
  console.log('    console.log("📋 Opções no select de máquinas:", options.length);');
  console.log('    options.forEach((option, index) => {');
  console.log('      if (index > 0) { // Pular a primeira opção "Selecione uma máquina"');
  console.log('        console.log(`   ✅ ${option.text} (value: ${option.value})`);');
  console.log('      }');
  console.log('    });');
  console.log('    ');
  console.log('    if (options.length <= 1) {');
  console.log('      console.log("❌ PROBLEMA: Nenhuma máquina aparece no select!");');
  console.log('      console.log("   Verifique os logs do hook useMachinePermissions acima.");');
  console.log('    }');
  console.log('  } else {');
  console.log('    console.log("❌ Select de máquinas não encontrado!");');
  console.log('  }');
  console.log('}, 3000);');
  console.log('\n5. Aguarde 3 segundos e verifique os logs no console.');
  console.log('\n6. Se ainda não aparecer máquinas, execute também:');
  console.log('\n// Forçar reload das máquinas');
  console.log('fetch("/api/machines", {');
  console.log('  headers: {');
  console.log(`    "Authorization": "Bearer ${token}"`);
  console.log('  }');
  console.log('}).then(r => r.json()).then(data => {');
  console.log('  console.log("📡 Máquinas da API:", data.data?.length || 0);');
  console.log('  data.data?.forEach(machine => {');
  console.log('    console.log(`   - ${machine.name} (ID: ${machine.id})`);');
  console.log('  });');
  console.log('});');
  console.log('\n// Verificar permissões');
  console.log('fetch("/api/permissions?userId=2", {');
  console.log('  headers: {');
  console.log(`    "Authorization": "Bearer ${token}"`);
  console.log('  }');
  console.log('}).then(r => r.json()).then(data => {');
  console.log('  console.log("🔑 Permissões da API:", data.data?.length || 0);');
  console.log('  data.data?.forEach(perm => {');
  console.log('    console.log(`   - Máquina ${perm.machineId}: canOperate=${perm.canOperate}`);');
  console.log('  });');
  console.log('});');
}

generateBrowserTestScript();