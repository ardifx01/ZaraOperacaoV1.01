const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = 'zara-jwt-secret-key-2024';

async function testLogin() {
  try {
    // Buscar usuário Lucas
    const user = await prisma.user.findFirst({
      where: { email: 'lucas.salviano@hotmail.com' }
    });
    
    if (!user) {
      console.log('❌ Usuário Lucas não encontrado');
      return;
    }
    
    console.log('👤 Usuário encontrado:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });
    
    // Gerar token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('\n🔑 Token gerado:');
    console.log(token);
    
    console.log('\n📋 Para usar no localStorage:');
    console.log(`localStorage.setItem('token', '${token}');`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();