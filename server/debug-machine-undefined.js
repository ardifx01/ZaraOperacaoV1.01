const axios = require('axios');
const jwt = require('jsonwebtoken');

async function debugMachineUndefined() {
  try {
    console.log('🔍 Debugando problema "Máquina undefined: undefined"\n');
    
    // Gerar token de admin
    const adminToken = jwt.sign(
      { id: 1, role: 'ADMIN' },
      'zara-jwt-secret-key-2024'
    );
    
    console.log('1. Testando API /api/machines...');
    const machinesResponse = await axios.get('http://localhost:3001/api/machines', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    console.log('✅ Status:', machinesResponse.status);
    console.log('📊 Total de máquinas:', machinesResponse.data.data?.length || 0);
    
    if (machinesResponse.data.data && machinesResponse.data.data.length > 0) {
      console.log('\n📋 Estrutura das máquinas:');
      machinesResponse.data.data.forEach((machine, index) => {
        console.log(`\n${index + 1}. Máquina ID: ${machine.id}`);
        console.log(`   - name: ${machine.name || 'UNDEFINED'}`);
        console.log(`   - code: ${machine.code || 'UNDEFINED'}`);
        console.log(`   - status: ${machine.status || 'UNDEFINED'}`);
        console.log(`   - location: ${machine.location || 'UNDEFINED'}`);
        console.log(`   - isActive: ${machine.isActive}`);
        console.log(`   - operator: ${machine.operator || 'UNDEFINED'}`);
        
        // Verificar se algum campo essencial está undefined
        if (!machine.name || !machine.code) {
          console.log('   ⚠️  PROBLEMA ENCONTRADO: name ou code está undefined!');
        }
      });
    }
    
    console.log('\n2. Testando API /api/machines/1 (máquina específica)...');
    const machine1Response = await axios.get('http://localhost:3001/api/machines/1', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    
    console.log('✅ Status:', machine1Response.status);
    const machine1 = machine1Response.data.data;
    
    if (machine1) {
      console.log('\n📋 Dados da máquina ID 1:');
      console.log(`   - name: ${machine1.name || 'UNDEFINED'}`);
      console.log(`   - code: ${machine1.code || 'UNDEFINED'}`);
      console.log(`   - status: ${machine1.status || 'UNDEFINED'}`);
      console.log(`   - location: ${machine1.location || 'UNDEFINED'}`);
      console.log(`   - isActive: ${machine1.isActive}`);
      
      if (!machine1.name || !machine1.code) {
        console.log('   ⚠️  PROBLEMA ENCONTRADO: name ou code está undefined!');
      }
    }
    
    console.log('\n3. Verificando banco de dados diretamente...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const dbMachines = await prisma.machine.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        location: true,
        isActive: true
      },
      take: 5
    });
    
    console.log('\n📊 Dados diretos do banco:');
    dbMachines.forEach((machine, index) => {
      console.log(`\n${index + 1}. Máquina ID: ${machine.id}`);
      console.log(`   - name: ${machine.name || 'NULL/UNDEFINED'}`);
      console.log(`   - code: ${machine.code || 'NULL/UNDEFINED'}`);
      console.log(`   - status: ${machine.status || 'NULL/UNDEFINED'}`);
      console.log(`   - location: ${machine.location || 'NULL/UNDEFINED'}`);
      console.log(`   - isActive: ${machine.isActive}`);
      
      if (!machine.name || !machine.code) {
        console.log('   🚨 PROBLEMA NO BANCO: name ou code está null/undefined!');
      }
    });
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Erro durante o debug:', error.message);
    if (error.response) {
      console.error('📄 Response data:', error.response.data);
      console.error('📊 Response status:', error.response.status);
    }
  }
}

debugMachineUndefined();