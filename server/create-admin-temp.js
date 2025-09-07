const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTempAdmin() {
  try {
    // Verificar se já existe um admin temporário
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'temp.admin@zara.com' }
    });

    if (existingAdmin) {
      console.log('✅ Admin temporário já existe');
      console.log('Email: temp.admin@zara.com');
      console.log('Senha: 123456');
      return;
    }

    // Criar hash da senha
    const hashedPassword = await bcrypt.hash('123456', 12);

    // Criar usuário admin temporário
    const admin = await prisma.user.create({
      data: {
        name: 'Admin Temporário',
        email: 'temp.admin@zara.com',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true
      }
    });

    console.log('✅ Admin temporário criado com sucesso!');
    console.log('ID:', admin.id);
    console.log('Email: temp.admin@zara.com');
    console.log('Senha: 123456');
    console.log('Role:', admin.role);

  } catch (error) {
    console.error('❌ Erro ao criar admin temporário:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTempAdmin();