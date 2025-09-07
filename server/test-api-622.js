const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

async function testAPI() {
  try {
    // Gerar token
    const token = jwt.sign(
      { id: 2, email: 'lucas.salviano@hotmail.com' }, 
      'zara-jwt-secret-key-2024', 
      { expiresIn: '1h' }
    );
    
    console.log('Token gerado:', token.substring(0, 50) + '...');
    
    // Fazer requisição
    const response = await fetch('http://localhost:5000/api/quality-tests/622', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    console.log('\nStatus:', response.status);
    console.log('\nDados do teste:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      const test = data.data;
      console.log('\n=== CAMPOS DISPONÍVEIS ===');
      console.log('ID:', test.id);
      console.log('Máquina:', test.machine?.name, '(ID:', test.machine?.id, ')');
      console.log('Operador:', test.createdBy?.name);
      console.log('Produto:', test.product);
      console.log('Turno:', test.shift);
      console.log('Tipo de Teste:', test.testType);
      console.log('Lote do Produto:', test.productBatch);
      console.log('Tamanho da Amostra:', test.sampleSize);
      console.log('Timestamp:', test.timestamp);
      console.log('Resultado Geral:', test.overallResult);
      
      console.log('\n=== CAMPOS FALTANTES ===');
      if (!test.operatorName) console.log('- operatorName não existe');
      if (!test.machineName) console.log('- machineName não existe');
      if (!test.productBatch) console.log('- productBatch não existe');
      if (!test.sampleSize) console.log('- sampleSize não existe');
      if (!test.testType) console.log('- testType não existe');
      if (!test.shift) console.log('- shift não existe');
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

testAPI();