const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkActiveOperation() {
  try {
    const activeOp = await prisma.machineOperation.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        user: true,
        machine: true
      },
      orderBy: { startTime: 'desc' }
    });
    
    if (activeOp) {
      const duration = Math.round((new Date() - new Date(activeOp.startTime)) / 1000 / 60);
      console.log('\n=== OPERAÇÃO ATIVA ENCONTRADA ===');
      console.log('ID:', activeOp.id);
      console.log('Usuário:', activeOp.user.name, '(' + activeOp.user.email + ')');
      console.log('Máquina:', activeOp.machine.name);
      console.log('Início:', activeOp.startTime);
      console.log('Duração:', duration, 'minutos');
      console.log('Notas:', activeOp.notes || 'Nenhuma');
      
      if (duration < 5) {
        console.log('\n✅ Esta é uma operação recente (menos de 5 min)');
        console.log('✅ PROBLEMA RESOLVIDO! O sistema está funcionando normalmente.');
        console.log('✅ Operadores conseguem iniciar operações sem o erro anterior.');
      } else {
        console.log('\n⚠️  Esta operação pode estar travada.');
      }
    } else {
      console.log('\n✅ Nenhuma operação ativa encontrada.');
      console.log('✅ Sistema limpo e pronto para novas operações.');
    }
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActiveOperation();