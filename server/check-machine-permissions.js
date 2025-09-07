const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMachinePermissions() {
  try {
    // Verificar permissões do usuário Lucas (ID: 2)
    const permissions = await prisma.machinePermission.findMany({
      where: {
        userId: 2
      },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });
    
    console.log('Permissões do usuário Lucas (ID: 2):', permissions.length);
    permissions.forEach(p => {
      console.log(`- Máquina: ${p.machine.name} (${p.machine.code}) - canView: ${p.canView}, canOperate: ${p.canOperate}`);
    });
    
    // Verificar todas as máquinas disponíveis
    const allMachines = await prisma.machine.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true
      }
    });
    
    console.log('\nTodas as máquinas:', allMachines.length);
    allMachines.forEach(m => {
      console.log(`- ${m.name} (${m.code}) - Ativa: ${m.isActive}`);
    });
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMachinePermissions();