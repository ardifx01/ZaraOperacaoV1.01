const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = [
  'auth.js',
  'notifications.js', 
  'teflon.js',
  'qualityTests.js',
  'users.js',
  'upload.js',
  'reports.js',
  'machines.js'
];

files.forEach(filename => {
  const filePath = path.join(routesDir, filename);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Substituir details: { ... } por details: JSON.stringify({ ... })
    // Regex para capturar objetos details
    const regex = /details:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
    
    content = content.replace(regex, (match, innerContent) => {
      // Se já tem JSON.stringify, pular
      if (match.includes('JSON.stringify')) {
        return match;
      }
      return `details: JSON.stringify({${innerContent}})`;
    });
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Corrigido: ${filename}`);
  }
});

console.log('Correção concluída!');