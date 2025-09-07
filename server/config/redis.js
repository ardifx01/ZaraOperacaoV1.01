const redis = require('redis');

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      console.error('❌ Erro Redis:', err);
    });

    redisClient.on('connect', () => {
      console.log('🔗 Conectando ao Redis...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis conectado e pronto');
    });

    redisClient.on('end', () => {
      console.log('⚠️ Conexão Redis encerrada');
    });

    await redisClient.connect();
    
  } catch (error) {
    console.error('❌ Erro ao conectar Redis:', error.message);
    // Não encerra o processo, Redis é opcional
  }
};

const getRedisClient = () => {
  return redisClient;
};

// Funções utilitárias para cache
const setCache = async (key, value, expireInSeconds = 3600) => {
  try {
    if (redisClient && redisClient.isReady) {
      await redisClient.setEx(key, expireInSeconds, JSON.stringify(value));
    }
  } catch (error) {
    console.error('Erro ao definir cache:', error);
  }
};

const getCache = async (key) => {
  try {
    if (redisClient && redisClient.isReady) {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    }
    return null;
  } catch (error) {
    console.error('Erro ao obter cache:', error);
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    if (redisClient && redisClient.isReady) {
      await redisClient.del(key);
    }
  } catch (error) {
    console.error('Erro ao deletar cache:', error);
  }
};

// Função para publicar eventos em tempo real
const publishEvent = async (channel, data) => {
  try {
    if (redisClient && redisClient.isReady) {
      await redisClient.publish(channel, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Erro ao publicar evento:', error);
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  publishEvent
};