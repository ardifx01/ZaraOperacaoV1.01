const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

async function createMachineConfig() {
  const client = new MongoClient(process.env.DATABASE_URL);
  
  try {
    await client.connect();
    console.log('✅ Conectado ao MongoDB');
    
    const db = client.db();
    const machineConfigsCollection = db.collection('machine_configs');
    const machinesCollection = db.collection('machines');
    
    // Buscar todas as máquinas
    const machines = await machinesCollection.find({}).toArray();
    
    for (const machine of machines) {
      // Verificar se já existe configuração para esta máquina
      const existingConfig = await machineConfigsCollection.findOne({ machineId: machine._id });
      
      if (existingConfig) {
        console.log(`⚠️  Configuração já existe para máquina ${machine.name}`);
        continue;
      }
      
      // Criar configuração padrão
      const config = {
        machineId: machine._id,
        general: {
          name: machine.name,
          model: machine.model || '',
          location: machine.location || '',
          capacity: '',
          description: machine.description || ''
        },
        operational: {
          maxTemperature: 200,
          minTemperature: 150,
          maxPressure: 10,
          minPressure: 5,
          cycleTime: 30,
          maintenanceInterval: 168,
          qualityCheckInterval: 50
        },
        alerts: {
          temperatureAlert: true,
          pressureAlert: true,
          maintenanceAlert: true,
          qualityAlert: true,
          teflonAlert: true,
          emailNotifications: true,
          smsNotifications: false
        },
        quality: {
          defectThreshold: 5,
          autoReject: true,
          requirePhotos: true,
          minSampleSize: 10
        },
        maintenance: {
          preventiveEnabled: true,
          predictiveEnabled: false,
          autoSchedule: true,
          reminderDays: 7
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await machineConfigsCollection.insertOne(config);
      console.log(`✅ Configuração criada para máquina ${machine.name} - ID: ${result.insertedId}`);
    }
    
    console.log('\n📋 Configurações criadas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao criar configurações:', error);
  } finally {
    await client.close();
  }
}

createMachineConfig();