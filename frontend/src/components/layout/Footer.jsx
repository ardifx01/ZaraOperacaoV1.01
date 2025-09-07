import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>© {currentYear} Zara Operação</span>
            <span>•</span>
            <span>Sistema de Controle de Qualidade</span>
          </div>
          
          <div className="flex items-center space-x-1 text-sm text-gray-600 mt-2 md:mt-0">
            <span>Desenvolvido por <span className="font-bold">SALVIANO TECH</span></span>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap justify-center md:justify-start space-x-6 text-xs text-gray-500">
            <span>Versão 1.0.1</span>
            <span>•</span>
            <span>Última atualização: {new Date().toLocaleDateString('pt-BR')}</span>
            <span>•</span>
            <span>Suporte: suporte@zara.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;