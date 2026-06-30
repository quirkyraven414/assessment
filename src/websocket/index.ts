import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { redisService } from '../services/redis.service';
import { logger } from '../utils/logger';

const PORT = 8000;
const server = createServer();
const wss = new WebSocketServer({ server, path: '/ws/telemetry' });

const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  logger.info('WebSocket client connected', { total_clients: clients.size });

  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to IoT Telemetry WebSocket',
    timestamp: new Date().toISOString()
  }));

  ws.on('close', () => {
    clients.delete(ws);
    logger.info('WebSocket client disconnected', { total_clients: clients.size });
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error', { error });
    clients.delete(ws);
  });
});

function broadcast(data: any) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

async function startWebSocketServer() {
  try {
    await redisService.connect();

    await redisService.psubscribe('telemetry:device:*', (channel, message) => {
      logger.debug('Broadcasting telemetry', { device_id: message.device_id, channel });
      broadcast({
        type: 'telemetry',
        data: message,
        timestamp: new Date().toISOString()
      });
    });

    await redisService.subscribe('alerts:all', (alert) => {
      logger.debug('Broadcasting alert', { alert_type: alert.alert_type });
      broadcast({
        type: 'alert',
        data: alert,
        timestamp: new Date().toISOString()
      });
    });

    server.listen(PORT, () => {
      logger.info('WebSocket server started', { 
        port: PORT,
        endpoint: `ws://localhost:${PORT}/ws/telemetry`
      });
      console.log(`\n🔌 WebSocket server running at ws://localhost:${PORT}/ws/telemetry\n`);
    });

  } catch (error) {
    logger.error('Failed to start WebSocket server', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('Shutting down WebSocket server...');
  wss.close();
  await redisService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down WebSocket server...');
  wss.close();
  await redisService.close();
  process.exit(0);
});

startWebSocketServer();
