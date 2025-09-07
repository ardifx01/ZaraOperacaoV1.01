import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bars3Icon,
  BellIcon,
  MagnifyingGlassIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useSocket } from '@/hooks/useSocket';
import { useNotifications } from '@/contexts/NotificationContext';

// Utilitários
import { cn } from '@/lib/utils';

// Constantes
import { THEMES } from '@/constants';

const Header = ({ 
  onMenuClick, 
  onNotificationClick,
  onNotificationCenterClick, 
  onQuickActionsClick,
  sidebarCollapsed 
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const userMenuRef = useRef(null);
  const themeMenuRef = useRef(null);
  const searchRef = useRef(null);
  
  const { user, logout } = useAuth();
  const { theme, isDark, changeTheme } = useTheme();
  const { isConnected } = useSocket();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + K para focar na busca
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implementar lógica de busca
      console.log('Buscar:', searchQuery);
      onQuickActionsClick();
    }
  };

  const themeOptions = [
    {
      value: THEMES.LIGHT,
      label: 'Claro',
      icon: SunIcon
    },
    {
      value: THEMES.DARK,
      label: 'Escuro',
      icon: MoonIcon
    },
    {
      value: THEMES.SYSTEM,
      label: 'Sistema',
      icon: ComputerDesktopIcon
    }
  ];

  const currentThemeOption = themeOptions.find(option => option.value === theme);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        {/* Lado esquerdo */}
        <div className="flex items-center space-x-4">
          {/* Botão do menu mobile */}
          <button
            onClick={onMenuClick}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 lg:hidden transition-colors"
            aria-label="Abrir menu"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>

          {/* Título da página (apenas em desktop quando sidebar colapsada) */}
          {sidebarCollapsed && (
            <div className="hidden lg:block">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sistema ZARA
              </h1>
            </div>
          )}

          {/* Barra de busca */}
          <div className="hidden sm:block">
            <form onSubmit={handleSearch} className="relative">
              <div className={cn(
                'relative flex items-center transition-all duration-200',
                searchFocused ? 'w-80' : 'w-64'
              )}>
                <MagnifyingGlassIcon className="absolute left-3 h-4 w-4 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Buscar... (Ctrl+K)"
                  className={cn(
                    'w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg',
                    'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    'dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400',
                    'transition-all duration-200'
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ×
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Lado direito */}
        <div className="flex items-center space-x-2">
          {/* Indicador de conexão */}
          <div className={cn(
            'hidden sm:flex items-center space-x-2 px-2 py-1 rounded-full text-xs font-medium',
            isConnected 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          )}>
            <div className={cn(
              'h-1.5 w-1.5 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )} />
            <span className="hidden md:inline">
              {isConnected ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Busca mobile */}
          <button
            onClick={onQuickActionsClick}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 sm:hidden transition-colors"
            aria-label="Buscar"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>

          {/* Seletor de tema */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              aria-label="Alterar tema"
            >
              {currentThemeOption && (
                <currentThemeOption.icon className="h-5 w-5" />
              )}
            </button>

            <AnimatePresence>
              {themeMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                >
                  <div className="py-1">
                    {themeOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => {
                            changeTheme(option.value);
                            setThemeMenuOpen(false);
                          }}
                          className={cn(
                            'flex items-center w-full px-4 py-2 text-sm text-left transition-colors',
                            theme === option.value
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                          )}
                        >
                          <Icon className="h-4 w-4 mr-3" />
                          {option.label}
                          {theme === option.value && (
                            <div className="ml-auto h-2 w-2 bg-blue-500 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notificações */}
          <button
            onClick={onNotificationClick}
            className="relative p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            aria-label="Notificações"
          >
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Centro de Notificações */}
          <button
            onClick={onNotificationCenterClick}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            aria-label="Centro de Notificações"
            title="Centro de Notificações"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c0 .621-.504 1.125-1.125 1.125H18a2.25 2.25 0 01-2.25-2.25M8.25 8.25h8.25" />
            </svg>
          </button>

          {/* Menu do usuário */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              aria-label="Menu do usuário"
            >
              <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <UserIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </div>
              <span className="hidden sm:block text-sm font-medium truncate max-w-32">
                {user?.name || 'Usuário'}
              </span>
              <ChevronDownIcon className="hidden sm:block h-4 w-4" />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                >
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user?.name || 'Usuário'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.email || 'usuario@exemplo.com'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Role: {user?.role || 'OPERATOR'}
                    </p>
                  </div>
                  
                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                      <UserIcon className="h-4 w-4 mr-3" />
                      Meu Perfil
                    </Link>
                    
                    {user?.role === 'ADMIN' && (
                      <Link
                        to="/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Cog6ToothIcon className="h-4 w-4 mr-3" />
                        Configurações
                      </Link>
                    )}
                  </div>
                  
                  <div className="border-t border-gray-200 dark:border-gray-700 py-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                      Sair
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;