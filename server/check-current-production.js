const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCurrentProduction() {
  try {
    console.log('📊 Verificando dados de produção atuais...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const shiftData = await prisma.shiftData.findMany({
      where: {
        shiftDate: {
          gte: today
        }
      },
      include: {
        machine: true,
        operator: true
      }
    });
    
    console.log(`\n📈 Dados de produção de hoje (${today.toLocaleDateString()}):`); 
    
    if (shiftData.length === 0) {
      console.log('❌ Nenhum dado de produção encontrado para hoje');
    } else {
      shiftData.forEach(shift => {
        console.log(`- ${shift.machine.name}: ${shift.totalProduction} peças (Operador: ${shift.operator.name})`);
        console.log(`  Turno: ${shift.shiftType} | Atualizado: ${shift.updatedAt.toLocaleString()}`);
      });
    }
    
    // Verificar máquinas funcionando
    const runningMachines = await prisma.machine.findMany({
      where: {
        status: 'FUNCIONANDO'
      }
    });
    
    console.log(`\n🏭 Máquinas funcionando: ${runningMachines.length}`);
    runningMachines.forEach(machine => {
      console.log(`- ${machine.name} (Velocidade: ${machine.productionSpeed} peças/min)`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar produção:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentProduction();