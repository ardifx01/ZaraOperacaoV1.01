import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  EyeIcon,
  PlayIcon,
  StopIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useMachineStatus } from '@/hooks/useMachineStatus';
import { useRealTimeProduction } from '@/hooks/useRealTimeProduction';
import { useMachinePermissions } from '@/hooks/useMachinePermissions';

// Utilitários
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import { ROUTES } from '@/config/routes';

const Machines = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name'); // name, status, efficiency, lastUpdate
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showFilters, setShowFilters] = useState(false);


  
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const { machines, stats, loading, error } = useMachineStatus();
  const { filterMachinesByPermissions, hasPermissionForMachine, loading: permissionsLoading } = useMachinePermissions();
  const navigate = useNavigate();



  // Agora usando dados reais da API

  // Mostrar loading enquanto carrega dados ou permissões
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando máquinas...</p>
        </div>
      </div>
    );
  }

  // Mostrar erro se houver problema
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Erro ao carregar máquinas</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Filtrar máquinas por permissões primeiro, depois aplicar outros filtros
  // Só filtrar se as permissões já foram carregadas
  const permissionFilteredMachines = permissionsLoading ? [] : filterMachinesByPermissions(machines || [], 'canView');
  
  // Filtrar e ordenar máquinas
  const filteredMachines = permissionFilteredMachines
    .filter(machine => {
      const matchesSearch = machine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           machine.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           machine.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || machine.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'efficiency':
          aValue = a.efficiency;
          bValue = b.efficiency;
          break;
        case 'lastUpdate':
          aValue = a.lastUpdate;
          bValue = b.lastUpdate;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getStatusConfig = (status) => {
    switch (status) {
      case 'FUNCIONANDO':
      case 'RUNNING':
        return {
          label: 'Funcionando',
          color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          icon: PlayIcon,
          iconColor: 'text-green-600 dark:text-green-400'
        };
      case 'PARADA':
      case 'STOPPED':
        return {
          label: 'Parada',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
          icon: StopIcon,
          iconColor: 'text-gray-600 dark:text-gray-400'
        };
      case 'MANUTENCAO':
      case 'MAINTENANCE':
        return {
          label: 'Manutenção',
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          icon: WrenchScrewdriverIcon,
          iconColor: 'text-yellow-600 dark:text-yellow-400'
        };
      case 'ERROR':
        return {
          label: 'Erro',
          color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          icon: ExclamationTriangleIcon,
          iconColor: 'text-red-600 dark:text-red-400'
        };
      case 'FORA_DE_TURNO':
      case 'OFF_SHIFT':
        return {
          label: 'Fora de Turno',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          icon: ClockIcon,
          iconColor: 'text-blue-600 dark:text-blue-400'
        };
      default:
        return {
          label: 'Desconhecido',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
          icon: ClockIcon,
          iconColor: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 90) return 'text-green-600 dark:text-green-400';
    if (efficiency >= 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getAlertSeverityColor = (severity) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'info':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const MachineCard = ({ machine }) => {
    const statusConfig = getStatusConfig(machine.status);
    const StatusIcon = statusConfig.icon;
    
    // Hook para dados de produção em tempo real
    const realTimeProduction = useRealTimeProduction(machine);
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        whileHover={{ scale: 1.02 }}
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={cn(
              'p-2 rounded-lg',
              machine.status === 'FUNCIONANDO' ? 'bg-green-100 dark:bg-green-900/20' :
              machine.status === 'ERROR' ? 'bg-red-100 dark:bg-red-900/20' :
              machine.status === 'MAINTENANCE' ? 'bg-yellow-100 dark:bg-yellow-900/20' :
              'bg-gray-100 dark:bg-gray-700'
            )}>
              <StatusIcon className={cn('h-6 w-6', statusConfig.iconColor)} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {machine.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {machine.id} • {machine.model}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              statusConfig.color
            )}>
              {statusConfig.label}
            </span>
            
            {machine.alerts && machine.alerts.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                {machine.alerts.length}
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Localização</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {machine.location}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Operador</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {machine.operator}
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Eficiência</p>
            <p className={cn(
              'text-lg font-bold',
              getEfficiencyColor(realTimeProduction.efficiency)
            )}>
              {realTimeProduction.efficiency}%
            </p>
            <div className="text-xs text-gray-500 mt-1">
              {realTimeProduction.isRunning ? 'Em Operação' : 'Parada'}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Produção Atual</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {Math.floor(realTimeProduction.currentProduction || 0).toLocaleString()}
              <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                /{(realTimeProduction.targetProduction || 0).toLocaleString()}
              </span>
            </p>

            <div className="text-xs text-green-600 mt-1">
              {realTimeProduction.isRunning ? `+${realTimeProduction.currentSpeed}/min` : 'Velocidade: 0/min'}
            </div>
          </div>
        </div>
        
        {/* Barra de progresso da produção */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Meta de Produção (Turno Atual)</span>
            <span>{Math.round(((realTimeProduction.currentProduction || 0) / (realTimeProduction.targetProduction || 1)) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={cn(
                'h-2 rounded-full transition-all duration-300',
(realTimeProduction.currentProduction || 0) >= (realTimeProduction.targetProduction || 1) 
                  ? 'bg-green-500'
                  : (realTimeProduction.currentProduction || 0) >= (realTimeProduction.targetProduction || 1) * 0.8
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              )}
              style={{ 
                width: `${Math.min(((realTimeProduction.currentProduction || 0) / (realTimeProduction.targetProduction || 1)) * 100, 100)}%` 
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Tempo ativo: {realTimeProduction.formattedRunningTime}</span>
            <span>Última atualização: {new Date().toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
        
        {/* Alertas */}
        {machine.alerts && machine.alerts.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Alertas Ativos
            </p>
            <div className="space-y-1">
              {machine.alerts.slice(0, 2).map((alert) => (
                <div key={alert.id} className={cn(
                  'px-2 py-1 rounded text-xs',
                  getAlertSeverityColor(alert.severity)
                )}>
                  {alert.message}
                </div>
              ))}
              {machine.alerts.length > 2 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  +{machine.alerts.length - 2} mais alertas
                </p>
              )}
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span>Última atualização: {formatDateTime(machine.updatedAt || machine.lastUpdate)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link
              to={`/machines/${machine.id}`}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <EyeIcon className="h-4 w-4 mr-1" />
              Detalhes
            </Link>
            
            {/* Link para página de Status detalhada */}
            {(user?.role === 'OPERATOR' || user?.role === 'LEADER' || user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
              <Link
                to={`/machines/${machine.id}/status`}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <ClockIcon className="h-4 w-4 mr-1" />
                Status
              </Link>
            )}
            
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'LEADER') && (
              <Link
                to={`/machines/${machine.id}/config`}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Cog6ToothIcon className="h-4 w-4 mr-1" />
                Configurar
              </Link>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <ChartBarIcon className="h-4 w-4" />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <DocumentTextIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Máquinas - Sistema ZARA</title>
        <meta name="description" content="Gerenciamento de máquinas do Sistema ZARA" />
      </Helmet>
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Máquinas
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Monitore o status e desempenho de todas as máquinas
            </p>
          </div>
          
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <div className="mt-4 sm:mt-0">
              <Link
                to={ROUTES.MACHINE_NEW}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Nova Máquina
              </Link>
            </div>
          )}
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
              {/* Busca */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar máquinas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              {/* Filtro de Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">Todos os Status</option>
                <option value="RUNNING">Funcionando</option>
                <option value="STOPPED">Paradas</option>
                <option value="MAINTENANCE">Manutenção</option>
                <option value="ERROR">Erro</option>
              </select>
              
              {/* Ordenação */}
              <div className="flex items-center space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="name">Nome</option>
                  <option value="status">Status</option>
                  <option value="efficiency">Eficiência</option>
                  <option value="lastUpdate">Última Atualização</option>
                </select>
                
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredMachines.length} máquinas
              </span>
              
              {/* Status de conexão */}
              <div className={cn(
                'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium',
                isConnected 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              )}>
                <div className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                )} />
                <span>{isConnected ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Máquinas */}
        <AnimatePresence>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMachines.map((machine) => (
              <MachineCard key={machine.id} machine={machine} />
            ))}
          </div>
        </AnimatePresence>
        
        {filteredMachines.length === 0 && (
          <div className="text-center py-12">
            <WrenchScrewdriverIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Nenhuma máquina encontrada
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tente ajustar os filtros de busca.
            </p>
          </div>
        )}
      </div>


    </>
  );
};

export default Machines;