const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPermissions() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'lucas.salviano@hotmail.com' }
    });
    console.log('Usuário Lucas:', user);
    
    if (user) {
      const permissions = await prisma.machinePermission.findMany({
        where: { userId: user.id },
        include: { machine: true }
      });
      console.log('Permissões do Lucas:', permissions);
      console.log('Total de permissões:', permissions.length);
    }
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPermissions();