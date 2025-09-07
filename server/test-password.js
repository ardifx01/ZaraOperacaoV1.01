const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function testPassword() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@zara.com' }
    });
    
    if (!admin) {
      console.log('Admin não encontrado!');
      return;
    }
    
    console.log('Admin encontrado:');
    console.log('Email:', admin.email);
    console.log('Hash da senha:', admin.password);
    
    // Testar a senha
    const testPassword = 'admin123';
    const isValid = await bcrypt.compare(testPassword, admin.password);
    
    console.log('\nTeste de senha:');
    console.log('Senha testada:', testPassword);
    console.log('Senha válida:', isValid);
    
    // Criar um novo hash para comparar
    const newHash = await bcrypt.hash(testPassword, 12);
    console.log('\nNovo hash gerado:', newHash);
    
    const isNewHashValid = await bcrypt.compare(testPassword, newHash);
    console.log('Novo hash válido:', isNewHashValid);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPassword();