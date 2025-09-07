const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testOperatorTeflonPermissions() {
  try {
    console.log('=== Teste de Permissões do Operador para Troca de Teflon ===\n');
    
    // Buscar operador ID 2
    const operator = await prisma.user.findUnique({
      where: { id: 2 },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        badgeNumber: true
      }
    });
    
    if (!operator) {
      console.log('❌ Operador ID 2 não encontrado');
      return;
    }
    
    console.log('👤 Operador encontrado:');
    console.log(`   Nome: ${operator.name}`);
    console.log(`   Email: ${operator.email}`);
    console.log(`   Role: ${operator.role}`);
    console.log(`   Badge: ${operator.badgeNumber}\n`);
    
    // Buscar permissões do operador
    const permissions = await prisma.machinePermission.findMany({
      where: {
        userId: operator.id
      },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            code: true,
            location: true,
            status: true
          }
        }
      }
    });
    
    console.log(`🔐 Permissões do operador (${permissions.length} encontradas):`);
    
    if (permissions.length === 0) {
      console.log('❌ PROBLEMA: Operador não tem permissões para nenhuma máquina!');
      console.log('   Para resolver: Acesse a página de Permissões e conceda permissões ao operador\n');
      return;
    }
    
    permissions.forEach(permission => {
      console.log(`   📍 Máquina: ${permission.machine.name} (${permission.machine.code})`);
      console.log(`      - Localização: ${permission.machine.location}`);
      console.log(`      - Status: ${permission.machine.status}`);
      console.log(`      - Pode Ver: ${permission.canView ? '✅' : '❌'}`);
      console.log(`      - Pode Operar: ${permission.canOperate ? '✅' : '❌'}`);
      console.log(`      - Pode Editar: ${permission.canEdit ? '✅' : '❌'}`);
      console.log('');
    });
    
    // Verificar máquinas que o operador pode operar (necessário para troca de teflon)
    const operableMachines = permissions.filter(p => p.canOperate);
    
    console.log(`🔧 Máquinas que o operador pode operar (${operableMachines.length}):`);
    
    if (operableMachines.length === 0) {
      console.log('❌ PROBLEMA: Operador não tem permissão de OPERAÇÃO em nenhuma máquina!');
      console.log('   Para troca de teflon, o operador precisa ter permissão "canOperate" = true');
      console.log('   Solução: Acesse Permissões > Editar permissões do operador > Marcar "Operar"\n');
    } else {
      operableMachines.forEach(permission => {
        console.log(`   ✅ ${permission.machine.name} - ${permission.machine.location}`);
      });
      console.log('');
    }
    
    // Buscar todas as máquinas para comparação
    const allMachines = await prisma.machine.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        status: true
      },
      orderBy: { name: 'asc' }
    });
    
    console.log(`📊 Resumo:`);
    console.log(`   - Total de máquinas no sistema: ${allMachines.length}`);
    console.log(`   - Máquinas que o operador pode ver: ${permissions.filter(p => p.canView).length}`);
    console.log(`   - Máquinas que o operador pode operar: ${operableMachines.length}`);
    console.log(`   - Máquinas disponíveis para troca de teflon: ${operableMachines.length}\n`);
    
    if (operableMachines.length > 0) {
      console.log('✅ DIAGNÓSTICO: Operador tem permissões adequadas para troca de teflon');
      console.log('   Se o select ainda estiver vazio, verifique:');
      console.log('   1. Se o usuário está logado corretamente no frontend');
      console.log('   2. Se o hook useMachinePermissions está carregando as permissões');
      console.log('   3. Se há erros no console do navegador');
    } else {
      console.log('❌ DIAGNÓSTICO: Operador NÃO tem permissões para troca de teflon');
      console.log('   Ação necessária: Conceder permissão "Operar" para pelo menos uma máquina');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar permissões:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testOperatorTeflonPermissions();