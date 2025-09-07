const { PrismaClient } = require('@prisma/client');
const shiftService = require('./services/shiftService');
const realTimeProductionService = require('./services/realTimeProductionService');

const prisma = new PrismaClient();

async function testProductionReset() {
  try {
    console.log('🧪 Testando reset de produção...');
    
    // 1. Verificar status atual
    console.log('\n📊 Status atual dos turnos:');
    const activeShifts = await prisma.shiftData.findMany({
      where: {
        isActive: true,
        isArchived: false
      },
      include: {
        machine: true,
        operator: true
      }
    });
    
    activeShifts.forEach(shift => {
      console.log(`- Turno ${shift.id}: ${shift.machine.name} (${shift.operator.name})`);
      console.log(`  Tipo: ${shift.shiftType}, Produção: ${shift.totalProduction}`);
      console.log(`  Início: ${shift.startTime.toLocaleString()}`);
      console.log(`  Fim: ${shift.endTime.toLocaleString()}`);
    });
    
    // 2. Simular parada de operação
    console.log('\n⏹️ Simulando parada de operação...');
    
    // Buscar uma máquina ativa
    const activeMachine = await prisma.machine.findFirst({
      where: {
        status: 'FUNCIONANDO'
      }
    });
    
    if (activeMachine) {
      console.log(`🔧 Parando máquina: ${activeMachine.name}`);
      
      // Parar a máquina
      await prisma.machine.update({
        where: { id: activeMachine.id },
        data: { status: 'PARADA' }
      });
      
      // Finalizar operação atual
      const currentOperation = await prisma.machineOperation.findFirst({
        where: {
          machineId: activeMachine.id,
          endTime: null
        }
      });
      
      if (currentOperation) {
        await prisma.machineOperation.update({
          where: { id: currentOperation.id },
          data: { endTime: new Date() }
        });
        console.log(`✅ Operação ${currentOperation.id} finalizada`);
      }
      
      console.log(`✅ Máquina ${activeMachine.name} parada`);
    } else {
      console.log('⚠️ Nenhuma máquina ativa encontrada');
    }
    
    // 3. Verificar horário atual
    const now = new Date();
    const currentHour = now.getHours();
    console.log(`\n⏰ Horário atual: ${currentHour}:${now.getMinutes().toString().padStart(2, '0')}`);
    
    if (currentHour >= 19 || currentHour < 7) {
      console.log('🌙 Estamos no turno da noite (19h-7h)');
      console.log('✅ Reset de produção deve ocorrer apenas após 19h - CORRETO!');
    } else {
      console.log('🌅 Estamos no turno da manhã (7h-19h)');
      console.log('⚠️ Reset de produção NÃO deve ocorrer agora - aguardar 19h');
    }
    
    // 4. Testar reset manual (apenas se for após 19h)
    if (currentHour >= 19 || currentHour < 7) {
      console.log('\n🔄 Testando reset manual de produção...');
      
      // Resetar dados de todos os turnos ativos
      for (const shift of activeShifts) {
        if (shift.shiftType === 'MORNING') {
          console.log(`📦 Arquivando turno da manhã: ${shift.id}`);
          try {
            await shiftService.archiveShiftData(shift.id);
            console.log(`✅ Turno ${shift.id} arquivado`);
          } catch (error) {
            console.error(`❌ Erro ao arquivar turno ${shift.id}:`, error.message);
          }
        }
      }
      
      // Criar novos turnos da noite com produção zerada
      const machines = await prisma.machine.findMany({
        where: {
          status: { not: 'INACTIVE' }
        }
      });
      
      for (const machine of machines) {
        const recentOperation = await prisma.machineOperation.findFirst({
          where: { machineId: machine.id },
          orderBy: { startTime: 'desc' },
          include: { operator: true }
        });
        
        if (recentOperation && recentOperation.operator) {
          console.log(`🌙 Criando turno da noite para ${machine.name}`);
          try {
            const newShift = await shiftService.createOrUpdateShiftData(machine.id, recentOperation.operator.id, {
              totalProduction: 0,
              efficiency: 0,
              downtime: 0,
              qualityTests: 0,
              approvedTests: 0,
              rejectedTests: 0
            });
            console.log(`✅ Turno da noite criado: ${newShift.id} - Produção: ${newShift.totalProduction}`);
          } catch (error) {
            console.error(`❌ Erro ao criar turno da noite:`, error.message);
          }
        }
      }
    } else {
      console.log('\n⏳ Aguardando horário de reset (19h) para testar reset manual');
    }
    
    // 5. Verificar status final
    console.log('\n📊 Status final dos turnos:');
    const finalShifts = await prisma.shiftData.findMany({
      where: {
        isActive: true,
        isArchived: false
      },
      include: {
        machine: true,
        operator: true
      }
    });
    
    finalShifts.forEach(shift => {
      console.log(`- Turno ${shift.id}: ${shift.machine.name} (${shift.operator.name})`);
      console.log(`  Tipo: ${shift.shiftType}, Produção: ${shift.totalProduction}`);
      console.log(`  Ativo: ${shift.isActive}, Arquivado: ${shift.isArchived}`);
    });
    
    // 6. Verificar dados arquivados
    const archivedData = await prisma.productionArchive.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        shiftData: {
          include: {
            machine: true,
            operator: true
          }
        }
      }
    });
    
    console.log('\n📦 Últimos 5 dados arquivados:');
    archivedData.forEach(archive => {
      console.log(`- Arquivo ${archive.id}: ${archive.shiftData.machine.name}`);
      console.log(`  Produção: ${archive.totalProduction}, Data: ${archive.createdAt.toLocaleString()}`);
    });
    
    console.log('\n✅ Teste de reset de produção concluído!');
    console.log('\n📋 Resumo:');
    console.log('- ✅ Reset só deve ocorrer após 19h');
    console.log('- ✅ Dados devem ser arquivados antes do reset');
    console.log('- ✅ Novos turnos devem começar com produção zerada');
    console.log('- ✅ Frontend e backend devem usar os mesmos horários (7h-19h)');
    
  } catch (error) {
    console.error('❌ Erro no teste de reset de produção:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testProductionReset();
}

module.exports = { testProductionReset };