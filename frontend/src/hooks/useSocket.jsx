import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { useAuth } from './useAuth';

const SocketContext = createContext({});

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket deve ser usado dentro de um SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Conectar ao socket quando autenticado
  useEffect(() => {
    if (isAuthenticated && token && user) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, token, user]);

  const connectSocket = () => {
    if (socket?.connected) return;

    // Detectar automaticamente a URL do socket baseada no hostname
    const getSocketUrl = () => {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return import.meta.env.VITE_SOCKET_URL_LOCAL || 'http://localhost:3001';
      } else {
        return import.meta.env.VITE_SOCKET_URL || `http://${hostname}:3001`;
      }
    };

    const newSocket = io(getSocketUrl(), {
      auth: {
        token,
        userId: user?.id
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    // Eventos de conexão
    newSocket.on('connect', () => {
      console.log('Socket conectado:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      
      // Entrar na sala do usuário
      newSocket.emit('join-user-room', user.id);
      
      // Entrar na sala baseada no papel do usuário
      if (user.role) {
        newSocket.emit('join-role-room', user.role);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket desconectado:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Reconectar se o servidor desconectou
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Erro de conexão do socket:', error);
      setConnectionError(error.message);
      setIsConnected(false);
      
      // Tentar reconectar com backoff exponencial
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.pow(2, reconnectAttempts.current) * 1000;
        setTimeout(() => {
          reconnectAttempts.current++;
          newSocket.connect();
        }, delay);
      } else {
        toast.error('Não foi possível conectar ao servidor. Verifique sua conexão.');
      }
    });

    // Eventos de usuários online
    newSocket.on('users-online', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('user-joined', (userData) => {
      setOnlineUsers(prev => [...prev.filter(u => u.id !== userData.id), userData]);
    });

    newSocket.on('user-left', (userId) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== userId));
    });

    // Eventos de notificações
    newSocket.on('notification', (notification) => {
      toast.success(notification.message, {
        duration: 5000,
        icon: '🔔'
      });
    });

    newSocket.on('alert', (alert) => {
      toast.error(alert.message, {
        duration: 8000,
        icon: '⚠️'
      });
    });

    // Eventos de máquinas
    newSocket.on('machine:status:changed', (data) => {
      console.log('🔄 Dados recebidos do WebSocket:', data);
      const machineName = data.machineName || 'Desconhecida';
      const status = data.newStatus || data.status || 'Status desconhecido';
      toast(`Máquina ${machineName}: ${status}`, {
        duration: 4000,
        icon: '🏭'
      });
    });

    // Eventos de operações
    newSocket.on('machine:operation-started', (data) => {
      console.log('🚀 Operação iniciada via WebSocket:', data);
      if (user.role === 'LEADER' || user.role === 'MANAGER' || user.role === 'ADMIN') {
        toast(`Operação iniciada na ${data.machineName} por ${data.operatorName}`, {
          duration: 5000,
          icon: '🚀'
        });
      }
    });

    newSocket.on('machine:operation-ended', (data) => {
      console.log('🛑 Operação finalizada via WebSocket:', data);
      if (user.role === 'LEADER' || user.role === 'MANAGER' || user.role === 'ADMIN') {
        toast(`Operação finalizada na ${data.machineName}`, {
          duration: 5000,
          icon: '🛑'
        });
      }
    });

    // Eventos de testes de qualidade
    newSocket.on('quality-test-created', (data) => {
      if (user.role === 'LEADER' || user.role === 'MANAGER' || user.role === 'ADMIN') {
        toast.success(`Novo teste de qualidade criado por ${data.operatorName}`, {
          duration: 5000,
          icon: '✅'
        });
      }
    });

    newSocket.on('quality-test-failed', (data) => {
      if (user.role === 'LEADER' || user.role === 'MANAGER' || user.role === 'ADMIN') {
        const machineName = data.machineName || 'Desconhecida';
        toast.error(`Teste de qualidade reprovado - Máquina ${machineName}`, {
          duration: 8000,
          icon: '❌'
        });
      }
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
    }
  };

  // Funções para emitir eventos
  const emit = (event, data) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket não conectado. Evento não enviado:', event);
    }
  };

  const on = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  // Função para entrar em uma sala específica
  const joinRoom = (room) => {
    emit('join-room', room);
  };

  // Função para sair de uma sala específica
  const leaveRoom = (room) => {
    emit('leave-room', room);
  };

  // Função para enviar mensagem para uma sala
  const sendToRoom = (room, event, data) => {
    emit('room-message', { room, event, data });
  };

  const value = {
    socket,
    isConnected,
    connectionError,
    onlineUsers,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
    sendToRoom,
    reconnect: connectSocket
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;