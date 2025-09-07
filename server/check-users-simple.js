const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        email: true
      }
    });
    
    console.log('Usuários cadastrados:', users.length);
    users.forEach(u => {
      console.log(`- ${u.name} (ID: ${u.id}, Role: ${u.role}, Email: ${u.email})`);
    });
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();