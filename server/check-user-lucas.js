const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'lucas.salviano@hotmail.com' },
      include: {
        machinePermissions: {
          include: {
            machine: true
          }
        }
      }
    });
    
    console.log('User found:', JSON.stringify(user, null, 2));
    
    if (user) {
      console.log('\nUser role:', user.role);
      console.log('Machine permissions count:', user.machinePermissions.length);
    } else {
      console.log('User not found!');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();