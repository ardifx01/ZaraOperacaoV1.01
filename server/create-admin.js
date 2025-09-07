const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Verificar se já existe um admin
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@zara.com' }
    });

    if (existingAdmin) {
      console.log('✅ Admin já existe!');
      console.log('📋 Credenciais: admin@zara.com / admin123');
      return;
    }

    // Criar senha hash
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Criar usuário admin
    const admin = await prisma.user.create({
      data: {
        name: 'Administrador Sistema',
        email: 'admin@zara.com',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Admin criado com sucesso!');
    console.log('📋 Credenciais: admin@zara.com / admin123');
    console.log('ID:', admin.id);

  } catch (error) {
    console.error('❌ Erro ao criar admin:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();