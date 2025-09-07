const jwt = require('jsonwebtoken');

// Gerar token para o operador Lucas
const token = jwt.sign(
  { id: 2, role: 'OPERATOR' },
  'zara-jwt-secret-key-2024',
  { expiresIn: '24h' }
);

const user = {
  id: 2,
  email: 'lucas.salviano@hotmail.com',
  name: 'Lucas adão salviano',
  role: 'OPERATOR',
  isActive: true
};

console.log('🔑 Token gerado para o navegador:');
console.log(token);
console.log('\n📋 Execute estes comandos no console do navegador (F12):');
console.log('');
console.log(`localStorage.setItem('token', '${token}');`);
console.log(`localStorage.setItem('user', '${JSON.stringify(user)}');`);
console.log('');
console.log('✅ Depois recarregue a página (F5)');
console.log('');
console.log('👤 Usuário configurado:', user);