const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  try {
    // Verificar se já existem usuários
    const existingUsers = await prisma.user.count();
    const existingMachines = await prisma.machine.count();
    
    if (existingUsers > 0 && existingMachines > 0) {
      console.log('✅ Dados já existem no banco de dados');
      console.log('📋 Credenciais de acesso:');
      console.log('Admin: admin@zara.com / admin123');
      console.log('Gestor: manager@zara.com / manager123');
      console.log('Líder: leader@zara.com / leader123');
      console.log('Operador: operator@zara.com / operator123');
      return;
    }
    
    // Criar apenas máquinas se não existirem
    if (existingMachines === 0) {
      console.log('🏭 Criando máquinas...');
      
      for (let i = 1; i <= 10; i++) {
         await prisma.machine.create({
           data: {
             name: `Máquina ${i.toString().padStart(2, '0')}`,
             code: `MAQ${i.toString().padStart(3, '0')}`,
             description: `Máquina de embalagem linha ${Math.ceil(i / 2)}`,
             status: i <= 7 ? 'RUNNING' : i <= 9 ? 'IDLE' : 'STOPPED',
             isActive: true,
             location: `Setor ${Math.ceil(i / 3)}`
           }
         });
      }
      console.log('✅ Máquinas criadas com sucesso!');
      return;
    }
    
    if (existingUsers > 0) {
      console.log('✅ Usuários já existem no banco de dados');
      return;
    }

    // Criar usuários
    console.log('👥 Criando usuários...');
    
    const adminPassword = await bcrypt.hash('admin123', 12);
    const managerPassword = await bcrypt.hash('manager123', 12);
    const leaderPassword = await bcrypt.hash('leader123', 12);
    const operatorPassword = await bcrypt.hash('operator123', 12);

    const admin = await prisma.user.create({
      data: {
        name: 'Administrador Sistema',
        email: 'admin@zara.com',
        password: adminPassword,
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const manager = await prisma.user.create({
      data: {
        name: 'João Silva - Gestor',
        email: 'manager@zara.com',
        password: managerPassword,
        role: 'MANAGER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const leader1 = await prisma.user.create({
      data: {
        name: 'Maria Santos - Líder Turno A',
        email: 'leader@zara.com',
        password: leaderPassword,
        role: 'LEADER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const leader2 = await prisma.user.create({
      data: {
        name: 'Carlos Oliveira - Líder Turno B',
        email: 'carlos.oliveira@zara.com',
        password: leaderPassword,
        role: 'LEADER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const operator1 = await prisma.user.create({
      data: {
        name: 'Ana Costa - Operadora',
        email: 'operator@zara.com',
        password: operatorPassword,
        role: 'OPERATOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const operator2 = await prisma.user.create({
      data: {
        name: 'Pedro Almeida - Operador',
        email: 'pedro.almeida@zara.com',
        password: operatorPassword,
        role: 'OPERATOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const operator3 = await prisma.user.create({
      data: {
        name: 'Lucia Ferreira - Operadora',
        email: 'lucia.ferreira@zara.com',
        password: operatorPassword,
        role: 'OPERATOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ Usuários criados com sucesso!');

    // Criar máquinas
    console.log('🏭 Criando máquinas...');
    
    const machines = [];
    for (let i = 1; i <= 10; i++) {
      const machine = await prisma.machine.create({
        data: {
          name: `Máquina ${i.toString().padStart(2, '0')}`,
          code: `MAQ${i.toString().padStart(3, '0')}`,
          description: `Máquina de embalagem linha ${Math.ceil(i / 2)}`,
          status: i <= 7 ? 'RUNNING' : i <= 9 ? 'IDLE' : 'MAINTENANCE',
          isActive: true,
          location: `Setor ${Math.ceil(i / 3)}`,
          model: `Modelo ${['A', 'B', 'C'][i % 3]}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      machines.push(machine);
    }

    console.log('✅ Máquinas criadas com sucesso!');

    // Criar operações de máquina
    console.log('⚙️ Criando operações de máquina...');
    
    const operations = [];
    for (let i = 0; i < 5; i++) {
      const machine = machines[i];
      const operator = [operator1, operator2, operator3][i % 3];
      
      const operation = await prisma.machineOperation.create({
        data: {
          machineId: machine.id,
          userId: operator.id,
          status: 'RUNNING',
          startTime: new Date(Date.now() - (i * 3600000)), // Iniciadas em horários diferentes
          productionTarget: 1000 + (i * 200),
          currentProduction: 500 + (i * 100),
          notes: `Operação iniciada no turno ${i % 2 === 0 ? 'A' : 'B'}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      operations.push(operation);
    }

    console.log('✅ Operações criadas com sucesso!');

    // Criar trocas de teflon
    console.log('🔧 Criando registros de teflon...');
    
    for (let i = 0; i < machines.length; i++) {
      const machine = machines[i];
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      const changeDate = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));
      const expiryDate = new Date(changeDate.getTime() + (90 * 24 * 60 * 60 * 1000)); // 90 dias de validade
      
      await prisma.teflonChange.create({
        data: {
          machineId: machine.id,
          userId: [operator1, operator2, operator3][i % 3].id,
          changeDate,
          expiryDate,
          teflonBrand: ['Marca A', 'Marca B', 'Marca C'][i % 3],
          teflonModel: `Modelo ${i % 5 + 1}`,
          batchNumber: `LOTE${Date.now()}${i}`,
          notes: `Troca realizada conforme cronograma. Teflon anterior: ${daysAgo + 90} dias de uso.`,
          alertSent: expiryDate < new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // Alert se expira em 7 dias
          createdAt: changeDate,
          updatedAt: changeDate
        }
      });
    }

    console.log('✅ Registros de teflon criados com sucesso!');

    // Criar testes de qualidade
    console.log('🔍 Criando testes de qualidade...');
    
    const products = ['Produto A', 'Produto B', 'Produto C', 'Produto D'];
    const packageSizes = ['P', 'M', 'G', 'GG'];
    
    for (let i = 0; i < 20; i++) {
      const machine = machines[i % machines.length];
      const operator = [operator1, operator2, operator3][i % 3];
      const testDate = new Date(Date.now() - (Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000));
      const approved = Math.random() > 0.1; // 90% de aprovação
      
      await prisma.qualityTest.create({
        data: {
          machineId: machine.id,
          userId: operator.id,
          product: products[i % products.length],
          batch: `LOTE${testDate.getFullYear()}${(testDate.getMonth() + 1).toString().padStart(2, '0')}${i.toString().padStart(3, '0')}`,
          boxNumber: (i + 1).toString().padStart(4, '0'),
          packageSize: packageSizes[i % packageSizes.length],
          packageWidth: 15.0 + (Math.random() * 5), // 15-20cm
          bottomSize: 10.0 + (Math.random() * 3), // 10-13cm
          sideSize: 25.0 + (Math.random() * 5), // 25-30cm
          zipperDistance: 2.0 + (Math.random() * 1), // 2-3cm
          facilitatorDistance: 1.5 + (Math.random() * 0.5), // 1.5-2cm
          rulerTest: Math.random() > 0.05, // 95% passa no teste da régua
          hermeticityTest: Math.random() > 0.03, // 97% passa no teste de hermeticidade
          approved,
          images: [`test_${i}_1.jpg`, `test_${i}_2.jpg`],
          videos: [`test_${i}.mp4`],
          notes: approved ? 'Teste aprovado - todos os parâmetros dentro do padrão' : 'Teste reprovado - verificar ajustes na máquina',
          testDate,
          createdAt: testDate,
          updatedAt: testDate
        }
      });
    }

    console.log('✅ Testes de qualidade criados com sucesso!');

    // Criar notificações
    console.log('🔔 Criando notificações...');
    
    const notifications = [
      {
        userId: leader1.id,
        type: 'QUALITY_ALERT',
        priority: 'HIGH',
        title: 'Teste de Qualidade Reprovado',
        message: 'Máquina 03 teve teste reprovado. Verificação necessária.',
        read: false
      },
      {
        userId: manager.id,
        type: 'TEFLON_EXPIRY',
        priority: 'MEDIUM',
        title: 'Teflon Próximo ao Vencimento',
        message: '3 máquinas com teflon vencendo nos próximos 7 dias.',
        read: false
      },
      {
        userId: operator1.id,
        type: 'TEFLON_EXPIRY',
        priority: 'MEDIUM',
        title: 'Teflon da Máquina 05 Vencendo',
        message: 'O teflon da Máquina 05 vence em 3 dias. Agende a troca.',
        read: false
      },
      {
        userId: leader2.id,
        type: 'SYSTEM_ALERT',
        priority: 'LOW',
        title: 'Relatório Diário Disponível',
        message: 'Relatório de produção do dia anterior está disponível.',
        read: true
      },
      {
        userId: admin.id,
        type: 'SYSTEM_ALERT',
        priority: 'HIGH',
        title: 'Backup Realizado',
        message: 'Backup automático do sistema realizado com sucesso.',
        read: true
      }
    ];

    for (const notificationData of notifications) {
      await prisma.notification.create({
        data: {
          ...notificationData,
          createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Últimas 24h
          updatedAt: new Date()
        }
      });
    }

    console.log('✅ Notificações criadas com sucesso!');

    // Criar logs do sistema
    console.log('📝 Criando logs do sistema...');
    
    const logActions = [
      'USER_LOGIN',
      'USER_LOGOUT', 
      'MACHINE_START',
      'MACHINE_STOP',
      'QUALITY_TEST_CREATED',
      'TEFLON_CHANGED',
      'REPORT_GENERATED'
    ];

    for (let i = 0; i < 50; i++) {
      const user = [admin, manager, leader1, leader2, operator1, operator2, operator3][i % 7];
      const action = logActions[i % logActions.length];
      const logDate = new Date(Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000)); // Últimos 7 dias
      
      await prisma.systemLog.create({
        data: {
          userId: user.id,
          action,
          description: `${action.replace('_', ' ').toLowerCase()} realizada por ${user.name}`,
          ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          metadata: {
            timestamp: logDate.toISOString(),
            sessionId: `session_${Date.now()}_${i}`,
            module: action.split('_')[0].toLowerCase()
          },
          createdAt: logDate
        }
      });
    }

    console.log('✅ Logs do sistema criados com sucesso!');

    // Estatísticas finais
    const stats = {
      users: await prisma.user.count(),
      machines: await prisma.machine.count(),
      operations: await prisma.machineOperation.count(),
      qualityTests: await prisma.qualityTest.count(),
      teflonChanges: await prisma.teflonChange.count(),
      notifications: await prisma.notification.count(),
      systemLogs: await prisma.systemLog.count()
    };

    console.log('\n📊 Estatísticas do seed:');
    console.log(`👥 Usuários: ${stats.users}`);
    console.log(`🏭 Máquinas: ${stats.machines}`);
    console.log(`⚙️ Operações: ${stats.operations}`);
    console.log(`🔍 Testes de Qualidade: ${stats.qualityTests}`);
    console.log(`🔧 Trocas de Teflon: ${stats.teflonChanges}`);
    console.log(`🔔 Notificações: ${stats.notifications}`);
    console.log(`📝 Logs do Sistema: ${stats.systemLogs}`);

    console.log('\n🎉 Seed concluído com sucesso!');
    console.log('\n📋 Credenciais de acesso:');
    console.log('Admin: admin@zara.com / admin123');
    console.log('Gestor: joao.silva@zara.com / manager123');
    console.log('Líder: maria.santos@zara.com / leader123');
    console.log('Operador: ana.costa@zara.com / operator123');

  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro fatal no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });