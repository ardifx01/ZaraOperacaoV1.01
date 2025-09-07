import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HomeIcon,
  CogIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  BellIcon,
  UsersIcon,
  UserIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import useMachinePermissions from '@/hooks/useMachinePermissions';

// Configurações
import { getNavigationItems } from '@/config/routes';

// Utilitários
import { cn } from '@/lib/utils';

// Mapeamento de ícones
const iconMap = {
  HomeIcon,
  CogIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  BellIcon,
  UsersIcon,
  UserIcon,
  UserGroupIcon,
  Cog6ToothIcon
};

const Sidebar = ({ collapsed, onCollapse }) => {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const { user } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const { hasAnyMachinePermission } = useMachinePermissions();

  // Obter itens de navegação baseado no role do usuário
  const navigationItems = useMemo(() => {
    const items = getNavigationItems(user?.role || 'OPERATOR');
    
    // Para operadores, filtrar o item "Máquinas" baseado nas permissões
    if (user?.role === 'OPERATOR') {
      return items.filter(item => {
        if (item.name === 'Máquinas' || item.path === '/machines') {
          return hasAnyMachinePermission();
        }
        return true;
      });
    }
    
    return items;
  }, [user?.role, hasAnyMachinePermission]);

  // Expandir item ativo automaticamente
  useEffect(() => {
    const currentPath = location.pathname;
    const activeItem = navigationItems.find(item => {
      if (item.path === currentPath) return true;
      if (item.children) {
        return item.children.some(child => child.path === currentPath);
      }
      return false;
    });

    if (activeItem && activeItem.children && !collapsed) {
      setExpandedItems(prev => new Set([...prev, activeItem.name]));
    }
  }, [location.pathname, navigationItems, collapsed]);

  // Colapsar todos os itens quando sidebar é colapsada
  useEffect(() => {
    if (collapsed) {
      setExpandedItems(new Set());
    }
  }, [collapsed]);

  const toggleExpanded = (itemName) => {
    if (collapsed) return;
    
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const NavItem = ({ item, level = 0 }) => {
    const Icon = iconMap[item.icon] || HomeIcon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.name);
    const itemIsActive = isActive(item.path);
    const hasActiveChild = hasChildren && item.children.some(child => isActive(child.path));

    const handleClick = (e) => {
      if (hasChildren && !collapsed) {
        e.preventDefault();
        toggleExpanded(item.name);
      }
    };

    return (
      <div className="relative">
        <Link
          to={item.path}
          onClick={handleClick}
          className={cn(
            'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-all duration-200',
            level === 0 ? 'mx-2' : 'mx-4 ml-6',
            itemIsActive || hasActiveChild
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
            collapsed && level === 0 && 'mx-1 justify-center'
          )}
          title={collapsed ? item.name : undefined}
        >
          <Icon
            className={cn(
              'flex-shrink-0 h-5 w-5 transition-colors duration-200',
              itemIsActive || hasActiveChild
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-400 dark:group-hover:text-gray-300',
              collapsed ? 'mr-0' : 'mr-3'
            )}
          />
          
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.name}</span>
              {hasChildren && (
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                </motion.div>
              )}
            </>
          )}
        </Link>

        {/* Submenu */}
        {hasChildren && !collapsed && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="py-1">
                  {item.children.map((child) => (
                    <NavItem key={child.path} item={child} level={level + 1} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Tooltip para sidebar colapsada */}
        {collapsed && hasChildren && (
          <div className="absolute left-full top-0 ml-2 hidden group-hover:block z-50">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              {item.name}
              <div className="mt-1 space-y-1">
                {item.children.map((child) => (
                  <Link
                    key={child.path}
                    to={child.path}
                    className="block hover:text-blue-300 transition-colors"
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Logo e Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700',
        collapsed && 'px-2 justify-center'
      )}>
        {!collapsed ? (
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">Z</span>
              </div>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                ZARA
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Sistema de Controle
              </p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
        )}

        {/* Botão de colapsar/expandir */}
        <button
          onClick={() => onCollapse(!collapsed)}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? (
            <ChevronRightIcon className="h-4 w-4" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Informações do usuário */}
      {!collapsed && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.name || 'Usuário'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.role || 'OPERATOR'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="space-y-1">
          {navigationItems.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>
      </nav>

      {/* Rodapé da sidebar */}
      <div className={cn(
        'border-t border-gray-200 dark:border-gray-700 p-4',
        collapsed && 'p-2'
      )}>
        {!collapsed ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>Sistema ZARA v1.0</p>
            <p>© 2025 - Todos os direitos reservados</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => onCollapse(false)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              title="Expandir sidebar"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;