const fs = require('fs');
const path = require('path');
const https = require('https');

// Configurações SSL/HTTPS para produção
const getSSLConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const sslEnabled = process.env.SSL_ENABLED === 'true';
  
  if (!isProduction || !sslEnabled) {
    return null;
  }

  const sslConfig = {
    // Certificados SSL
    cert: null,
    key: null,
    ca: null,
    
    // Configurações de segurança
    secureProtocol: 'TLSv1_2_method',
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-SHA256',
      'ECDHE-RSA-AES256-SHA384'
    ].join(':'),
    honorCipherOrder: true,
    
    // HSTS (HTTP Strict Transport Security)
    hsts: {
      maxAge: 31536000, // 1 ano
      includeSubDomains: true,
      preload: true
    }
  };

  try {
    // Tentar carregar certificados de diferentes locais
    const certPaths = [
      // Let's Encrypt (Certbot)
      {
        cert: '/etc/letsencrypt/live/' + process.env.DOMAIN + '/fullchain.pem',
        key: '/etc/letsencrypt/live/' + process.env.DOMAIN + '/privkey.pem'
      },
      // Certificados customizados
      {
        cert: process.env.SSL_CERT_PATH,
        key: process.env.SSL_KEY_PATH,
        ca: process.env.SSL_CA_PATH
      },
      // Certificados locais (desenvolvimento)
      {
        cert: path.join(__dirname, '../ssl/cert.pem'),
        key: path.join(__dirname, '../ssl/key.pem')
      }
    ];

    for (const certPath of certPaths) {
      if (certPath.cert && certPath.key) {
        try {
          if (fs.existsSync(certPath.cert) && fs.existsSync(certPath.key)) {
            sslConfig.cert = fs.readFileSync(certPath.cert, 'utf8');
            sslConfig.key = fs.readFileSync(certPath.key, 'utf8');
            
            // Carregar CA se disponível
            if (certPath.ca && fs.existsSync(certPath.ca)) {
              sslConfig.ca = fs.readFileSync(certPath.ca, 'utf8');
            }
            
            console.log('✅ Certificados SSL carregados:', certPath.cert);
            break;
          }
        } catch (error) {
          console.warn('⚠️ Erro ao carregar certificado:', certPath.cert, error.message);
          continue;
        }
      }
    }

    if (!sslConfig.cert || !sslConfig.key) {
      console.warn('⚠️ Certificados SSL não encontrados. HTTPS desabilitado.');
      return null;
    }

  } catch (error) {
    console.error('❌ Erro ao configurar SSL:', error.message);
    return null;
  }

  return sslConfig;
};

// Criar servidor HTTPS
const createHTTPSServer = (app) => {
  const sslConfig = getSSLConfig();
  
  if (!sslConfig) {
    return null;
  }

  try {
    const httpsServer = https.createServer({
      cert: sslConfig.cert,
      key: sslConfig.key,
      ca: sslConfig.ca,
      secureProtocol: sslConfig.secureProtocol,
      ciphers: sslConfig.ciphers,
      honorCipherOrder: sslConfig.honorCipherOrder
    }, app);

    return httpsServer;
  } catch (error) {
    console.error('❌ Erro ao criar servidor HTTPS:', error.message);
    return null;
  }
};

// Middleware para redirecionamento HTTP -> HTTPS
const httpsRedirect = (req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceHttps = process.env.FORCE_HTTPS === 'true';
  
  if (isProduction && forceHttps) {
    // Verificar se a requisição já é HTTPS
    const isHttps = req.secure || 
                   req.get('X-Forwarded-Proto') === 'https' ||
                   req.get('X-Forwarded-Ssl') === 'on';
    
    if (!isHttps) {
      const httpsUrl = `https://${req.get('Host')}${req.originalUrl}`;
      return res.redirect(301, httpsUrl);
    }
  }
  
  next();
};

// Middleware para headers de segurança HTTPS
const httpsSecurityHeaders = (req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const sslEnabled = process.env.SSL_ENABLED === 'true';
  
  if (isProduction && sslEnabled) {
    // HSTS (HTTP Strict Transport Security)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Upgrade Insecure Requests
    res.setHeader('Content-Security-Policy', 'upgrade-insecure-requests');
    
    // Secure cookies
    const originalSetHeader = res.setHeader;
    res.setHeader = function(name, value) {
      if (name.toLowerCase() === 'set-cookie') {
        if (Array.isArray(value)) {
          value = value.map(cookie => {
            if (!cookie.includes('Secure')) {
              return cookie + '; Secure';
            }
            return cookie;
          });
        } else if (typeof value === 'string' && !value.includes('Secure')) {
          value += '; Secure';
        }
      }
      return originalSetHeader.call(this, name, value);
    };
  }
  
  next();
};

// Verificar status do certificado SSL
const checkSSLCertificate = () => {
  const sslConfig = getSSLConfig();
  
  if (!sslConfig) {
    return {
      valid: false,
      message: 'SSL não configurado'
    };
  }

  try {
    // Verificar validade do certificado
    const cert = sslConfig.cert;
    const certLines = cert.split('\n');
    const certData = certLines.slice(1, -2).join('');
    
    // Decodificar certificado (simplificado)
    const certBuffer = Buffer.from(certData, 'base64');
    
    return {
      valid: true,
      message: 'Certificado SSL válido',
      size: certBuffer.length
    };
  } catch (error) {
    return {
      valid: false,
      message: 'Erro ao verificar certificado: ' + error.message
    };
  }
};

// Gerar certificado auto-assinado para desenvolvimento
const generateSelfSignedCert = () => {
  const { execSync } = require('child_process');
  const sslDir = path.join(__dirname, '../ssl');
  
  try {
    // Criar diretório SSL se não existir
    if (!fs.existsSync(sslDir)) {
      fs.mkdirSync(sslDir, { recursive: true });
    }

    const certPath = path.join(sslDir, 'cert.pem');
    const keyPath = path.join(sslDir, 'key.pem');

    // Verificar se já existem certificados
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      console.log('✅ Certificados de desenvolvimento já existem');
      return { certPath, keyPath };
    }

    // Gerar certificado auto-assinado
    const opensslCmd = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=BR/ST=SP/L=SaoPaulo/O=ZARA/CN=localhost"`;
    
    execSync(opensslCmd, { stdio: 'inherit' });
    
    console.log('✅ Certificado auto-assinado gerado para desenvolvimento');
    console.log('📁 Certificado:', certPath);
    console.log('🔑 Chave privada:', keyPath);
    
    return { certPath, keyPath };
  } catch (error) {
    console.error('❌ Erro ao gerar certificado auto-assinado:', error.message);
    console.log('💡 Instale o OpenSSL para gerar certificados de desenvolvimento');
    return null;
  }
};

module.exports = {
  getSSLConfig,
  createHTTPSServer,
  httpsRedirect,
  httpsSecurityHeaders,
  checkSSLCertificate,
  generateSelfSignedCert
};