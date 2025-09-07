const { PrismaClient } = require('@prisma/client');
const RealTimeProductionService = require('./services/realTimeProductionService');

const prisma = new PrismaClient();

async function testServiceLogs() {
  console.log('🧪 Iniciando teste de logs do RealTimeProductionService...');
  
  try {
    // Mock do socket.io
    const mockIo = {
      emit: (event, data) => console.log(`📡 Socket emit: ${event}`, data)
    };
    
    // Criar instância do serviço
    const service = new RealTimeProductionService(mockIo);
    
    console.log('✅ Serviço criado com sucesso');
    
    // Iniciar o serviço
    service.start();
    console.log('✅ Serviço iniciado');
    
    // Aguardar alguns ciclos
    console.log('⏳ Aguardando 90 segundos para observar logs...');
    
    setTimeout(() => {
      console.log('🛑 Parando serviço...');
      service.stop();
      process.exit(0);
    }, 90000);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

testServiceLogs();