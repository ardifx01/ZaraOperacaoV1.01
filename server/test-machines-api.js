const http = require('http');
const jwt = require('jsonwebtoken');

// Gerar um token de teste
const token = jwt.sign(
  { id: 1, role: 'ADMIN' },
  process.env.JWT_SECRET || 'your-secret-key',
  { expiresIn: '1h' }
);

function testMachinesAPI() {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/machines',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log('Status:', res.statusCode);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const machines = JSON.parse(data);
        console.log('Dados recebidos:', machines);
        console.log('Número de máquinas:', machines.length);
        
        if (machines.length > 0) {
          console.log('Primeira máquina:', machines[0]);
        }
      } catch (error) {
        console.log('Resposta raw:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Erro na requisição:', error.message);
  });

  req.end();
}

testMachinesAPI();