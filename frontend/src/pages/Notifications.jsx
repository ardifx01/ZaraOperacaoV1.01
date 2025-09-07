import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  BellIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/hooks/useAuth';

// Componentes
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Notifications = () => {
  const { user } = useAuth();
  const {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getNotificationsByType,
    getNotificationsByPriority,
    getUnreadNotifications,
    refreshNotifications
  } = useNotifications();

  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    refreshNotifications();
  }, []);

  const getNotificationIcon = (type) => {
    const icons = {
      QUALITY_TEST: CheckCircleIcon,
      MACHINE_STATUS: ExclamationTriangleIcon,
      PRODUCTION: InformationCircleIcon,
      MAINTENANCE: ClockIcon,
      ALERT: ExclamationTriangleIcon,
      INFO: InformationCircleIcon,
      SUCCESS: CheckCircleIcon,
      WARNING: ExclamationTriangleIcon,
      ERROR: ExclamationTriangleIcon
    };
    return icons[type] || BellIcon;
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'URGENT') return 'text-red-600 dark:text-red-400';
    if (priority === 'HIGH') return 'text-orange-600 dark:text-orange-400';
    
    const colors = {
      QUALITY_TEST: 'text-blue-600 dark:text-blue-400',
      MACHINE_STATUS: 'text-yellow-600 dark:text-yellow-400',
      PRODUCTION: 'text-green-600 dark:text-green-400',
      MAINTENANCE: 'text-purple-600 dark:text-purple-400',
      ALERT: 'text-red-600 dark:text-red-400',
      INFO: 'text-blue-600 dark:text-blue-400',
      SUCCESS: 'text-green-600 dark:text-green-400',
      WARNING: 'text-yellow-600 dark:text-yellow-400',
      ERROR: 'text-red-600 dark:text-red-400'
    };
    return colors[type] || 'text-gray-600 dark:text-gray-400';
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      URGENT: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return badges[priority] || badges.LOW;
  };

  const getTypeLabel = (type) => {
    const labels = {
      QUALITY_TEST: 'Teste de Qualidade',
      MACHINE_STATUS: 'Status da Máquina',
      PRODUCTION: 'Produção',
      MAINTENANCE: 'Manutenção',
      ALERT: 'Alerta',
      INFO: 'Informação',
      SUCCESS: 'Sucesso',
      WARNING: 'Aviso',
      ERROR: 'Erro'
    };
    return labels[type] || type;
  };

  const filteredNotifications = notifications
    .filter(notification => {
      // Filtro por tipo
      if (filterType !== 'all') {
        if (filterType === 'unread' && notification.read) return false;
        if (filterType === 'read' && !notification.read) return false;
        if (filterType !== 'unread' && filterType !== 'read' && notification.type !== filterType) return false;
      }
      
      // Filtro por prioridade
      if (filterPriority !== 'all' && notification.priority !== filterPriority) return false;
      
      // Filtro por busca
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          notification.title?.toLowerCase().includes(searchLower) ||
          notification.message?.toLowerCase().includes(searchLower) ||
          notification.machineId?.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          aValue = priorityOrder[a.priority] || 0;
          bValue = priorityOrder[b.priority] || 0;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'read':
          aValue = a.read ? 1 : 0;
          bValue = b.read ? 1 : 0;
          break;
        default: // date
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const handleSelectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map(n => n.id));
    }
  };

  const handleSelectNotification = (notificationId) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const handleBulkMarkAsRead = async () => {
    const unreadSelected = selectedNotifications.filter(id => {
      const notification = notifications.find(n => n.id === id);
      return notification && !notification.read;
    });
    
    for (const id of unreadSelected) {
      await markAsRead(id);
    }
    
    setSelectedNotifications([]);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedNotifications) {
      await deleteNotification(id);
    }
    
    setSelectedNotifications([]);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Navegar para a página relacionada se houver
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Notificações - Sistema ZARA</title>
        <meta name="description" content="Central de notificações do sistema ZARA" />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Notificações
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas as notificações lidas'}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <EyeIcon className="h-4 w-4 mr-2" />
                Marcar todas como lidas
              </button>
            )}
            
            <button
              onClick={refreshNotifications}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <BellIcon className="h-4 w-4 mr-2" />
              )}
              Atualizar
            </button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Busca */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar notificações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Controles */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium transition-colors',
                  showFilters
                    ? 'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:bg-blue-900/20'
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700'
                )}
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                Filtros
                {showFilters ? (
                  <ChevronUpIcon className="h-4 w-4 ml-2" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 ml-2" />
                )}
              </button>

              {/* Ordenação */}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [by, order] = e.target.value.split('-');
                  setSortBy(by);
                  setSortOrder(order);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="date-desc">Mais recentes</option>
                <option value="date-asc">Mais antigas</option>
                <option value="priority-desc">Maior prioridade</option>
                <option value="priority-asc">Menor prioridade</option>
                <option value="type-asc">Tipo (A-Z)</option>
                <option value="read-asc">Não lidas primeiro</option>
              </select>
            </div>
          </div>

          {/* Filtros expandidos */}
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Filtro por tipo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Todos os tipos</option>
                    <option value="unread">Não lidas</option>
                    <option value="read">Lidas</option>
                    <option value="QUALITY_TEST">Teste de Qualidade</option>
                    <option value="MACHINE_STATUS">Status da Máquina</option>
                    <option value="PRODUCTION">Produção</option>
                    <option value="MAINTENANCE">Manutenção</option>
                    <option value="ALERT">Alerta</option>
                  </select>
                </div>

                {/* Filtro por prioridade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prioridade
                  </label>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Todas as prioridades</option>
                    <option value="URGENT">Urgente</option>
                    <option value="HIGH">Alta</option>
                    <option value="MEDIUM">Média</option>
                    <option value="LOW">Baixa</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Ações em lote */}
        {selectedNotifications.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {selectedNotifications.length} notificação{selectedNotifications.length > 1 ? 'ões' : ''} selecionada{selectedNotifications.length > 1 ? 's' : ''}
              </span>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleBulkMarkAsRead}
                  className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                >
                  <EyeIcon className="h-4 w-4 mr-1" />
                  Marcar como lidas
                </button>
                
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center px-3 py-1 text-sm font-medium text-red-700 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                >
                  <TrashIcon className="h-4 w-4 mr-1" />
                  Excluir
                </button>
                
                <button
                  onClick={() => setSelectedNotifications([])}
                  className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <XMarkIcon className="h-4 w-4 mr-1" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de notificações */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Header da tabela */}
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Selecionar todas ({filteredNotifications.length})
              </span>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {error && (
              <div className="p-6 text-center">
                <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={refreshNotifications}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {!error && filteredNotifications.length === 0 && (
              <div className="p-6 text-center">
                <BellIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm || filterType !== 'all' || filterPriority !== 'all'
                    ? 'Nenhuma notificação encontrada com os filtros aplicados'
                    : 'Nenhuma notificação encontrada'
                  }
                </p>
              </div>
            )}

            {filteredNotifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const isSelected = selectedNotifications.includes(notification.id);
              
              return (
                <div
                  key={notification.id}
                  className={cn(
                    'p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                    !notification.read && 'bg-blue-50/50 dark:bg-blue-900/10',
                    isSelected && 'bg-blue-100 dark:bg-blue-900/20'
                  )}
                >
                  <div className="flex items-start space-x-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectNotification(notification.id)}
                      className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />

                    {/* Ícone */}
                    <div className={cn(
                      'flex-shrink-0 mt-0.5',
                      getNotificationColor(notification.type, notification.priority)
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className={cn(
                              'text-sm font-medium',
                              notification.read 
                                ? 'text-gray-700 dark:text-gray-300'
                                : 'text-gray-900 dark:text-white'
                            )}>
                              {notification.title}
                            </h3>
                            
                            {/* Badge de prioridade */}
                            <span className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                              getPriorityBadge(notification.priority)
                            )}>
                              {notification.priority === 'URGENT' ? 'Urgente' :
                               notification.priority === 'HIGH' ? 'Alta' :
                               notification.priority === 'MEDIUM' ? 'Média' : 'Baixa'}
                            </span>
                            
                            {/* Badge de tipo */}
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              {getTypeLabel(notification.type)}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {notification.message}
                          </p>
                          
                          {/* Metadados */}
                          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center space-x-1">
                              <ClockIcon className="h-3 w-3" />
                              <span>
                                {formatDistanceToNow(new Date(notification.createdAt), {
                                  addSuffix: true,
                                  locale: ptBR
                                })}
                              </span>
                            </div>
                            
                            {notification.machineId && (
                              <span>Máquina: {notification.machineId}</span>
                            )}
                            
                            {notification.userId && notification.userId !== user?.id && (
                              <span>De: {notification.userName || 'Sistema'}</span>
                            )}
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex items-center space-x-2 ml-4">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Marcar como lida"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                          )}
                          
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Excluir notificação"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                          
                          {notification.actionUrl && (
                            <button
                              onClick={() => handleNotificationClick(notification)}
                              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                              Ver detalhes
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ações de limpeza */}
        {notifications.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={clearAllNotifications}
              className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-600 rounded-md text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Limpar todas as notificações
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Notifications;