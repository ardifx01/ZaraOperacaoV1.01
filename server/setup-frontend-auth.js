const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = 'zara-jwt-secret-key-2024';

async function setupFrontendAuth() {
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
      { id: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    console.log('\n🔑 Token gerado:');
    console.log(token);
    
    console.log('\n📋 Instruções para configurar no frontend:');
    console.log('1. Abra o DevTools do navegador (F12)');
    console.log('2. Vá para a aba Console');
    console.log('3. Execute os seguintes comandos:');
    console.log('');
    console.log(`localStorage.setItem('token', '${token}');`);
    console.log(`localStorage.setItem('user', '${JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    })}');`);
    console.log('');
    console.log('4. Recarregue a página (F5)');
    console.log('');
    console.log('✅ Após isso, todos os erros de autenticação devem ser resolvidos!');
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupFrontendAuth();