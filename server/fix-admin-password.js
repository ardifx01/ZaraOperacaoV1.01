const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function fixAdminPassword() {
  try {
    console.log('🔧 Corrigindo senha do admin...');
    
    // Gerar novo hash para a senha admin123
    const newPassword = await bcrypt.hash('admin123', 12);
    
    // Atualizar o admin
    const updatedAdmin = await prisma.user.update({
      where: { email: 'admin@zara.com' },
      data: { password: newPassword }
    });
    
    console.log('✅ Senha do admin atualizada com sucesso!');
    console.log('Email:', updatedAdmin.email);
    console.log('Novo hash:', newPassword);
    
    // Testar a nova senha
    const isValid = await bcrypt.compare('admin123', newPassword);
    console.log('\n🔍 Teste da nova senha:');
    console.log('Senha válida:', isValid);
    
  } catch (error) {
    console.error('❌ Erro ao corrigir senha:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminPassword();