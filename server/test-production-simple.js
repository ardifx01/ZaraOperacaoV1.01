const axios = require('axios');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api';
const JWT_SECRET = 'zara-jwt-secret-key-2024';
const MACHINE_ID = 1;

// Gerar token diretamente
async function generateToken() {
  const user = await prisma.user.findFirst({
    where: { email: 'lucas.salviano@hotmail.com' }
  });
  
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Obter dados da máquina
async function getMachineData(token, machineId) {
  const response = await axios.get(`${API_BASE}/machines/${machineId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

// Obter produção atual
async function getCurrentProduction(token, machineId) {
  const response = await axios.get(`${API_BASE}/machines/${machineId}/current-production`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}

// Atualizar velocidade de produção
async function updateProductionSpeed(token, machineId, speed) {
  const response = await axios.put(`${API_BASE}/machines/${machineId}/production-speed`, 
    { productionSpeed: speed },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

async function testProduction() {
  console.log('🔍 Testando cálculo de produção com mudança de velocidade\n');
  
  try {
    // 1. Gerar token
    console.log('1. Gerando token...');
    const token = await generateToken();
    
    // 2. Obter dados da máquina
    console.log('2. Obtendo dados da máquina...');
    const machineData = await getMachineData(token, MACHINE_ID);
    console.log('Dados da máquina:', {
      id: machineData.id,
      name: machineData.name,
      productionSpeed: machineData.productionSpeed,
      status: machineData.status
    });
    
    // 3. Obter produção inicial
    console.log('\n3. Obtendo produção inicial...');
    const initialProduction = await getCurrentProduction(token, MACHINE_ID);
    console.log('Produção inicial:', initialProduction.currentShiftProduction);
    
    // 4. Testar velocidade baixa
    console.log('\n4. Definindo velocidade baixa (5 unidades/min)...');
    await updateProductionSpeed(token, MACHINE_ID, 5);
    
    console.log('Aguardando 1 minuto...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    const productionLow = await getCurrentProduction(token, MACHINE_ID);
    console.log('Produção após velocidade baixa:', productionLow.currentShiftProduction);
    
    // 5. Testar velocidade alta
    console.log('\n5. Definindo velocidade alta (20 unidades/min)...');
    await updateProductionSpeed(token, MACHINE_ID, 20);
    
    console.log('Aguardando 1 minuto...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    const productionHigh = await getCurrentProduction(token, MACHINE_ID);
    console.log('Produção após velocidade alta:', productionHigh.currentShiftProduction);
    
    // 6. Análise
    console.log('\n=== ANÁLISE DOS RESULTADOS ===');
    const incrementLow = productionLow.currentShiftProduction - initialProduction.currentShiftProduction;
    const incrementHigh = productionHigh.currentShiftProduction - productionLow.currentShiftProduction;
    
    console.log(`Incremento com velocidade 5: ${incrementLow} unidades`);
    console.log(`Incremento com velocidade 20: ${incrementHigh} unidades`);
    console.log(`Razão esperada (20/5 = 4): 4`);
    console.log(`Razão real: ${incrementHigh / incrementLow}`);
    
    if (incrementHigh > incrementLow * 2) {
      console.log('✅ CORRETO: Velocidade maior resultou em incremento proporcionalmente maior');
    } else {
      console.log('❌ PROBLEMA: Velocidade não está afetando proporcionalmente a produção');
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testProduction();