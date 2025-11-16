import { createClient } from 'redis';

let client = null;

export async function getRedisClient() {
  if (!client) {
    client = createClient({
      socket: {
        host: 'redis',
        port: 6379,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis connection failed after 10 retries');
            return false;
          }
          return Math.min(retries * 50, 500);
        }
      }
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      console.log('Connected to Redis');
    });

    client.on('disconnect', () => {
      console.log('Disconnected from Redis');
    });

    await client.connect();
  }
  
  return client;
}

export async function closeRedisConnection() {
  if (client) {
    await client.quit();
    client = null;
  }
}
