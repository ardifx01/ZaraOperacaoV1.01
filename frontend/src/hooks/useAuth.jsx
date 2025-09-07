import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { authService } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Verificar token ao inicializar
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        try {
          // Verificar se o token ainda é válido
          const response = await authService.getProfile();
          
          if (response.data.success) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            setToken(storedToken);
            setIsAuthenticated(true);
          } else {
            // Token inválido, limpar dados
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
          }
        } catch (error) {
          console.error('Erro ao verificar autenticação:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
        }
      } else {
        // Auto-login para desenvolvimento
        try {
          const response = await authService.login({
            email: 'admin@zara.com',
            password: '123456'
          });
          
          if (response.data.success) {
            const { token: authToken, user: userData } = response.data.data || {};
            
            if (authToken && userData) {
              localStorage.setItem('token', authToken);
              localStorage.setItem('user', JSON.stringify(userData));
              setToken(authToken);
              setUser(userData);
              setIsAuthenticated(true);
            }
          }
        } catch (error) {
          console.error('Erro no auto-login:', error);
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    try {
      setIsLoading(true);
      
      const response = await authService.login(credentials);

      const data = response.data;

      if (data.success) {
        const { token: authToken, user: userData } = data.data || {};
        
        // Verificar se os dados estão presentes
        if (!authToken || !userData) {
          throw new Error('Dados de autenticação incompletos');
        }
        
        // Salvar no localStorage
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Atualizar estado
        setToken(authToken);
        setUser(userData);
        setIsAuthenticated(true);
        
        toast.success(`Bem-vindo, ${userData.name || 'Usuário'}!`);
        return { success: true };
      } else {
        toast.error(data.message || 'Erro ao fazer login');
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      toast.error('Erro de conexão. Tente novamente.');
      return { success: false, error: 'Erro de conexão' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Chamar endpoint de logout se necessário
      if (token) {
        await authService.logout();
      }
    } catch (error) {
      console.error('Erro ao fazer logout no servidor:', error);
    } finally {
      // Limpar dados locais
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      
      toast.success('Logout realizado com sucesso');
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await authService.updateProfile(profileData);

      const data = response.data;

      if (data.success) {
        const updatedUser = data.data;
        updateUser(updatedUser);
        return updatedUser;
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authService.changePassword({
        currentPassword,
        newPassword
      });

      const data = response.data;

      if (data.success) {
        toast.success('Senha alterada com sucesso!');
        return data;
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      throw error;
    }
  };

  const hasRole = (role) => {
    return user?.role === role;
  };

  const hasPermission = (permission) => {
    const rolePermissions = {
      ADMIN: ['all'],
      MANAGER: ['view_reports', 'manage_users', 'view_quality_tests', 'create_quality_tests'],
      LEADER: ['view_reports', 'view_quality_tests', 'create_quality_tests', 'manage_machines'],
      OPERATOR: ['view_quality_tests', 'create_quality_tests', 'view_machines']
    };
    
    const userPermissions = rolePermissions[user?.role] || [];
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    token,
    login,
    logout,
    updateUser,
    updateProfile,
    changePassword,
    hasRole,
    hasPermission,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;