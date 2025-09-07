const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createMachine() {
  try {
    console.log('Criando máquina MAQ001...');
    
    const machine = await prisma.machine.create({
      data: {
        name: 'Máquina 01',
        code: 'MAQ001',
        description: 'Máquina de embalagem linha 1',
        status: 'RUNNING',
        isActive: true,
        location: 'Setor 1',
        model: 'Modelo A'
      }
    });
    
    console.log('✅ Máquina criada:', machine);
    
  } catch (error) {
    console.error('❌ Erro ao criar máquina:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createMachine();