const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MACHINE_ID = 1;
const USER_ID = 4;

async function testRealTimeService() {
  try {
    console.log('🔍 Testando RealTimeProductionService...');

    // 1. Verificar se há operação ativa
    console.log('\n1. Verificando operação ativa...');
    let activeOperation = await prisma.machineOperation.findFirst({
      where: {
        machineId: MACHINE_ID,
        status: 'RUNNING'
      }
    });

    if (!activeOperation) {
      console.log('   Criando operação ativa...');
      activeOperation = await prisma.machineOperation.create({
        data: {
          machineId: MACHINE_ID,
          userId: USER_ID,
          startTime: new Date(),
          status: 'RUNNING'
        }
      });
      console.log(`   Operação criada: ID ${activeOperation.id}`);
    } else {
      console.log(`   Operação ativa encontrada: ID ${activeOperation.id}`);
    }

    // 2. Colocar máquina em funcionamento
    console.log('\n2. Colocando máquina em funcionamento...');
    await prisma.machine.update({
      where: { id: MACHINE_ID },
      data: { 
        status: 'FUNCIONANDO',
        productionSpeed: 3 // 3 produtos por minuto
      }
    });

    // 3. Verificar dados de turno
    console.log('\n3. Verificando dados de turno...');
    let shiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        shiftDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    if (!shiftData) {
      console.log('   Criando dados de turno...');
      const now = new Date();
      const shiftType = now.getHours() >= 7 && now.getHours() < 19 ? 'MORNING' : 'NIGHT';
      const startTime = new Date();
      startTime.setHours(shiftType === 'MORNING' ? 7 : 19, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(shiftType === 'MORNING' ? 19 : 7, 0, 0, 0);
      if (shiftType === 'NIGHT') {
        endTime.setDate(endTime.getDate() + 1);
      }
      
      shiftData = await prisma.shiftData.create({
        data: {
          machineId: MACHINE_ID,
          operatorId: USER_ID,
          shiftType: shiftType,
          shiftDate: new Date(new Date().setHours(0, 0, 0, 0)),
          startTime: startTime,
          endTime: endTime,
          totalProduction: 0,
          efficiency: 0
        }
      });
    }

    console.log(`   Produção inicial: ${shiftData.totalProduction}`);
    const initialProduction = shiftData.totalProduction;

    // 4. Aguardar 65 segundos (mais de 1 minuto para garantir que o serviço rode)
    console.log('\n4. Aguardando 65 segundos para o RealTimeProductionService...');
    await new Promise(resolve => setTimeout(resolve, 65000));

    // 5. Verificar se houve atualização
    console.log('\n5. Verificando atualizações...');
    const updatedShiftData = await prisma.shiftData.findFirst({
      where: {
        machineId: MACHINE_ID,
        shiftDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    console.log(`   Produção após 65s: ${updatedShiftData.totalProduction}`);
    console.log(`   Diferença: ${updatedShiftData.totalProduction - initialProduction} produtos`);
    console.log(`   Esperado: ~3 produtos (65s ≈ 1min a 3/min)`);

    if (updatedShiftData.totalProduction > initialProduction) {
      console.log('\n✅ RealTimeProductionService está funcionando!');
    } else {
      console.log('\n❌ RealTimeProductionService NÃO está funcionando!');
      
      // Verificar se a máquina está realmente em funcionamento
      const machine = await prisma.machine.findUnique({
        where: { id: MACHINE_ID }
      });
      console.log(`   Status da máquina: ${machine.status}`);
      console.log(`   Velocidade: ${machine.productionSpeed}/min`);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRealTimeService();