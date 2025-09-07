const jwt = require('jsonwebtoken');
const SECRET_KEY = 'zara-jwt-secret-key-2024';

// Gerar token para usuário Lucas (ID: 2, OPERATOR)
const token = jwt.sign(
  { id: 2, role: 'OPERATOR' },
  SECRET_KEY,
  { expiresIn: '24h' }
);

console.log('Token gerado:', token);