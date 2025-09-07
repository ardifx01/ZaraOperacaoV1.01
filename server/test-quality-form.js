const jwt = require('jsonwebtoken');

// Gerar token válido
const token = jwt.sign({
  id: 2,
  email: 'lucas.salviano@hotmail.com',
  name: 'Lucas adão salviano',
  role: 'OPERATOR'
}, 'zara-jwt-secret-key-2024', { expiresIn: '7d' });

console.log('Token gerado:', token);

// Dados do teste de qualidade
const qualityTestData = {
  machineId: 1,
  userId: 2,
  product: 'Embalagem Teste',
  lot: 'LOTE001',
  boxNumber: 'CX001',
  packageSize: 'Médio',
  packageWidth: 15.5,
  bottomSize: 10.0,
  sideSize: 8.0,
  zipperDistance: 2.5,
  facilitatorDistance: 1.5,
  rulerTestDone: true,
  hermeticityTestDone: true,
  approved: true,
  observations: 'Teste automatizado - operação ativa criada',
  images: [{
    url: 'https://via.placeholder.com/300x200.png?text=Teste+Qualidade',
    filename: 'teste-qualidade.png',
    size: 12345
  }]
};

console.log('\nDados do teste:', JSON.stringify(qualityTestData, null, 2));
console.log('\nPara testar, execute:');
console.log(`curl -X POST http://localhost:3001/api/quality-tests \\`);
console.log(`  -H "Content-Type: application/json" \\`);
console.log(`  -H "Authorization: Bearer ${token}" \\`);
console.log(`  -d '${JSON.stringify(qualityTestData)}'`);