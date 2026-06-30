import { Request, Response, NextFunction } from 'express';
import { databaseService } from '../../services/database.service';
import { logger } from '../../utils/logger';

export interface AuthRequest extends Request {
  device?: {
    device_id: string;
    device_name: string;
    api_key: string;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'Missing API key' });
      return;
    }

    const device = await databaseService.getDeviceByApiKey(apiKey);

    if (!device) {
      logger.warn('Invalid API key attempt', { api_key: apiKey.substring(0, 8) + '...' });
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.device = {
      device_id: device.device_id,
      device_name: device.device_name,
      api_key: device.api_key,
    };

    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}
