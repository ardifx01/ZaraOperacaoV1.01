const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany();
    console.log('Usuários no banco:');
    users.forEach(u => {
      console.log(`ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`);
    });
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();