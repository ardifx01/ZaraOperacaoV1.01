const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '.env') });

const notificationService = require('./services/notificationService');
const emailService = require('./services/emailService');
const pushService = require('./services/pushService');

console.log('🔍 Verificando Configurações de Notificação\n');

// Verificar variáveis de ambiente
console.log('📋 Variáveis de Ambiente:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('\n📧 Configurações de Email:');
console.log('SMTP_HOST:', process.env.SMTP_HOST || 'Não configurado');
console.log('SMTP_PORT:', process.env.SMTP_PORT || 'Não configurado');
console.log('SMTP_USER:', process.env.SMTP_USER ? '✅ Configurado' : '❌ Não configurado');
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '✅ Configurado' : '❌ Não configurado');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Configurado' : '❌ Não configurado');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Configurado' : '❌ Não configurado');

console.log('\n📱 Configurações Firebase/Push:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ Configurado' : '❌ Não configurado');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✅ Configurado' : '❌ Não configurado');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✅ Configurado' : '❌ Não configurado');

console.log('\n🔔 Configurações de Notificação:');
console.log('NOTIFICATIONS_ENABLED:', process.env.NOTIFICATIONS_ENABLED || 'Não definido');
console.log('EMAIL_NOTIFICATIONS:', process.env.EMAIL_NOTIFICATIONS || 'Não definido');
console.log('PUSH_NOTIFICATIONS:', process.env.PUSH_NOTIFICATIONS || 'Não definido');

console.log('\n🏗️ Status dos Serviços:');

// Verificar status do NotificationService
try {
  console.log('NotificationService - Email habilitado:', notificationService.emailEnabled);
  console.log('NotificationService - Push habilitado:', notificationService.pushEnabled);
} catch (error) {
  console.error('❌ Erro ao verificar NotificationService:', error.message);
}

// Verificar status do EmailService
try {
  console.log('EmailService - Inicializado:', !!emailService);
} catch (error) {
  console.error('❌ Erro ao verificar EmailService:', error.message);
}

// Verificar status do PushService
try {
  console.log('PushService - Inicializado:', !!pushService);
  console.log('PushService - Firebase inicializado:', pushService.initialized);
} catch (error) {
  console.error('❌ Erro ao verificar PushService:', error.message);
}

console.log('\n📊 Resumo da Configuração:');

const emailConfigured = !!(process.env.EMAIL_USER || process.env.SMTP_USER);
const pushConfigured = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY);

if (emailConfigured) {
  console.log('✅ Email: Configurado e disponível');
} else {
  console.log('❌ Email: Não configurado - Configure SMTP_USER/SMTP_PASS ou EMAIL_USER/EMAIL_PASSWORD');
}

if (pushConfigured) {
  console.log('✅ Push: Configurado e disponível');
} else {
  console.log('❌ Push: Não configurado - Configure as credenciais do Firebase');
}

if (!emailConfigured && !pushConfigured) {
  console.log('\n⚠️  ATENÇÃO: Nenhum método de notificação está configurado!');
  console.log('\n📝 Para configurar as notificações:');
  console.log('\n1. Email (Nodemailer):');
  console.log('   - SMTP_HOST=smtp.gmail.com');
  console.log('   - SMTP_PORT=587');
  console.log('   - SMTP_USER=seu_email@gmail.com');
  console.log('   - SMTP_PASS=sua_senha_de_app');
  console.log('\n2. Push (Firebase):');
  console.log('   - FIREBASE_PROJECT_ID=seu_projeto');
  console.log('   - FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
  console.log('   - FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@projeto.iam.gserviceaccount.com');
} else {
  console.log('\n✅ Sistema de notificações parcialmente ou totalmente configurado!');
}

console.log('\n🔚 Verificação concluída.');