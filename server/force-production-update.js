const { PrismaClient } = require('@prisma/client');
const RealTimeProductionService = require('./services/realTimeProductionService');
const prisma = new PrismaClient();

async function forceProductionUpdate() {
  try {
    console.log('🔄 Forçando atualização de produção...');
    
    // Criar uma instância do serviço (sem WebSocket para teste)
    const productionService = new RealTimeProductionService(null);
    
    // Executar atualização manual
    await productionService.updateProduction();
    
    console.log('✅ Atualização de produção concluída');
    
    // Verificar dados atualizados
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
    
    console.log('\n📊 Dados de produção após atualização:');
    shiftData.forEach(shift => {
      console.log(`- ${shift.machine.name}: ${shift.totalProduction} peças (${shift.operator.name})`);
      console.log(`  Última atualização: ${shift.lastUpdate}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao forçar atualização:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

forceProductionUpdate();