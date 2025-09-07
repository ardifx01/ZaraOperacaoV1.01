const jwt = require('jsonwebtoken');

// Configuração
const JWT_SECRET = 'your-secret-key';

// Gerar token para Lucas (operador)
const lucasToken = jwt.sign(
  { id: 2, role: 'OPERATOR', name: 'Lucas Silva', email: 'lucas@empresa.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// Gerar token para Admin
const adminToken = jwt.sign(
  { id: 1, role: 'ADMIN', name: 'Admin', email: 'admin@empresa.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🧪 TESTE DE ATUALIZAÇÕES EM TEMPO REAL');
console.log('=====================================\n');

console.log('📋 Tokens gerados para teste:');
console.log('👤 Lucas (Operador):', lucasToken);
console.log('👑 Admin:', adminToken);

console.log('\n📱 INSTRUÇÕES PARA TESTE NO NAVEGADOR:');
console.log('======================================\n');

console.log('1. 🌐 Abra duas abas do navegador em: http://localhost:5173/machines\n');

console.log('2. 👤 Na PRIMEIRA aba, faça login como Lucas (Operador):');
console.log('   - Abra o Console do navegador (F12)');
console.log('   - Execute: localStorage.setItem("token", "' + lucasToken + '");');
console.log('   - Recarregue a página (F5)\n');

console.log('3. 👑 Na SEGUNDA aba, faça login como Admin:');
console.log('   - Abra o Console do navegador (F12)');
console.log('   - Execute: localStorage.setItem("token", "' + adminToken + '");');
console.log('   - Recarregue a página (F5)\n');

console.log('4. 🧪 TESTES A REALIZAR:');
console.log('   a) 🔄 Teste de mudança de status:');
console.log('      - Na aba do Admin, clique em uma máquina e mude seu status');
console.log('      - Verifique se a mudança aparece IMEDIATAMENTE na aba do Lucas');
console.log('      - Deve aparecer um toast de notificação também\n');

console.log('   b) 🚀 Teste de início de operação:');
console.log('      - Na aba do Lucas, inicie uma operação em uma máquina');
console.log('      - Verifique se aparece IMEDIATAMENTE na aba do Admin');
console.log('      - O status da máquina deve mudar para "RUNNING"\n');

console.log('5. 🔍 O QUE OBSERVAR:');
console.log('   - ✅ Mudanças devem aparecer SEM precisar recarregar a página');
console.log('   - ✅ Toasts de notificação devem aparecer');
console.log('   - ✅ Console deve mostrar logs de WebSocket (🔄 e 🚀)');
console.log('   - ❌ Se precisar recarregar = problema não resolvido\n');

console.log('6. 🐛 DEBUGGING:');
console.log('   - Abra o Console (F12) em ambas as abas');
console.log('   - Procure por logs que começam com 🔄 ou 🚀');
console.log('   - Verifique se há erros de WebSocket\n');

console.log('✨ RESULTADO ESPERADO:');
console.log('- Mudanças de status e operações devem aparecer em tempo real');
console.log('- Não deve ser necessário recarregar a página');
console.log('- Notificações toast devem aparecer');

console.log('\n🎯 Se tudo funcionar, o problema de atualização em tempo real foi RESOLVIDO!');