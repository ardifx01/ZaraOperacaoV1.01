// Script para verificar variáveis de ambiente necessárias no Railway
const requiredEnvVars = {
  // Essenciais para funcionamento
  'NODE_ENV': 'production',
  'PORT': '5000',
  'DATABASE_URL': 'postgresql://...',
  'JWT_SECRET': 'chave_jwt_segura',
  
  // CORS e segurança
  'CORS_ORIGIN': 'https://seu-frontend.vercel.app',
  'SESSION_SECRET': 'chave_session_segura',
  
  // Aplicação
  'APP_NAME': 'Sistema ZARA',
  'APP_VERSION': '1.0.1',
  'APP_URL': 'https://mainline.proxy.rlwy.net:11723',
  
  // Uploads
  'UPLOAD_MAX_SIZE': '10485760',
  'UPLOAD_ALLOWED_TYPES': 'image/jpeg,image/png,image/gif,image/webp,application/pdf',
  'UPLOAD_DIR': './uploads',
  
  // Rate limiting
  'RATE_LIMIT_WINDOW_MS': '900000',
  'RATE_LIMIT_MAX_REQUESTS': '100',
  
  // Logs
  'LOG_LEVEL': 'info',
  'LOG_FILE': 'logs/app.log',
  
  // Segurança
  'TRUST_PROXY': 'true',
  'SECURE_COOKIES': 'true'
};

const optionalEnvVars = {
  // Redis (opcional)
  'REDIS_URL': 'redis://...',
  
  // Email (opcional)
  'EMAIL_HOST': 'smtp.gmail.com',
  'EMAIL_PORT': '587',
  'EMAIL_SECURE': 'false',
  'EMAIL_USER': 'email@gmail.com',
  'EMAIL_PASS': 'senha_app',
  'EMAIL_FROM': 'Sistema ZARA <email@gmail.com>',
  
  // Firebase (opcional)
  'FIREBASE_PROJECT_ID': 'projeto_firebase',
  'FIREBASE_PRIVATE_KEY': 'chave_privada',
  'FIREBASE_CLIENT_EMAIL': 'email@projeto.iam.gserviceaccount.com',
  
  // Sentry (opcional)
  'SENTRY_DSN': 'https://...@sentry.io/...'
};

console.log('=== VARIÁVEIS DE AMBIENTE NECESSÁRIAS NO RAILWAY ===\n');

console.log('🔴 ESSENCIAIS (obrigatórias):');
Object.entries(requiredEnvVars).forEach(([key, example]) => {
  const current = process.env[key];
  const status = current ? '✅' : '❌';
  console.log(`${status} ${key}: ${current || `(faltando - exemplo: ${example})`}`);
});

console.log('\n🟡 OPCIONAIS (recomendadas):');
Object.entries(optionalEnvVars).forEach(([key, example]) => {
  const current = process.env[key];
  const status = current ? '✅' : '⚠️';
  console.log(`${status} ${key}: ${current || `(não configurada - exemplo: ${example})`}`);
});

console.log('\n=== INSTRUÇÕES PARA RAILWAY ===');
console.log('1. Acesse o painel do Railway');
console.log('2. Vá em Variables na aba do zara-backend');
console.log('3. Configure as variáveis marcadas com ❌');
console.log('4. Redeploy o serviço após configurar');

const missingRequired = Object.keys(requiredEnvVars).filter(key => !process.env[key]);
if (missingRequired.length > 0) {
  console.log(`\n❌ FALTAM ${missingRequired.length} VARIÁVEIS ESSENCIAIS:`);
  missingRequired.forEach(key => console.log(`   - ${key}`));
  process.exit(1);
} else {
  console.log('\n✅ Todas as variáveis essenciais estão configuradas!');
  process.exit(0);
}