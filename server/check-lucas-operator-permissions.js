const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLucasPermissions() {
  console.log('🔍 Verificando permissões do operador Lucas (ID: 2)...');
  
  try {
    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: 2 },
      select: { id: true, name: true, email: true, role: true }
    });
    
    if (!user) {
      console.log('❌ Usuário com ID 2 não encontrado');
      return;
    }
    
    console.log('👤 Usuário encontrado:', user);
    
    // Verificar permissões de máquina
    const permissions = await prisma.machinePermission.findMany({
      where: { userId: 2 },
      include: {
        machine: {
          select: { id: true, name: true, status: true }
        },
        user: {
          select: { id: true, name: true, role: true }
        }
      }
    });
    
    console.log(`\n📋 Permissões encontradas: ${permissions.length}`);
    
    if (permissions.length === 0) {
      console.log('❌ PROBLEMA: Operador Lucas não tem permissões de máquina!');
      console.log('💡 Solução: Criar permissões para o operador');
    } else {
      permissions.forEach((p, index) => {
        console.log(`\n${index + 1}. Máquina: ${p.machine.name} (ID: ${p.machine.id})`);
        console.log(`   - canOperate: ${p.canOperate}`);
        console.log(`   - canMaintain: ${p.canMaintain}`);
        console.log(`   - Status da máquina: ${p.machine.status}`);
        
        if (!p.canOperate) {
          console.log('   ⚠️  PROBLEMA: canOperate é false!');
        }
      });
    }
    
    // Verificar todas as máquinas disponíveis
    const allMachines = await prisma.machine.findMany({
      select: { id: true, name: true, status: true }
    });
    
    console.log(`\n🏭 Total de máquinas no sistema: ${allMachines.length}`);
    allMachines.forEach(m => {
      console.log(`   - ${m.name} (ID: ${m.id}) - Status: ${m.status}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar permissões:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLucasPermissions();