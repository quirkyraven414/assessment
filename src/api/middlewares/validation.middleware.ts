import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { logger } from '../../utils/logger';
import { databaseService } from '../../services/database.service';
import { redisService } from '../../services/redis.service';
import { v4 as uuidv4 } from 'uuid';

async function logInvalidMessage(device_id: string, body: any, reason: string): Promise<void> {
  try {
    const invalidKey = `invalid:${device_id}`;
    
    const alreadyLogged = await redisService.checkIdempotency(invalidKey);
    if (alreadyLogged) {
      logger.debug('Invalid message already logged (within 10s)', { device_id, reason });
      return;
    }

    await databaseService.insertInvalidMessage({
      message_id: uuidv4(),
      device_id,
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      telemetry_message: body,
      reason_for_failure: reason,
      rejected_at: new Date(),
    });
    
    await redisService.setIdempotency(invalidKey, { logged: true });
    
    logger.warn('Invalid message logged', { device_id, reason });
  } catch (error) {
    logger.error('Failed to log invalid message', { error, device_id });
  }
}

export async function validateTelemetry(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { temperature, energy_kwh, voltage, current, status, timestamp } = req.body;
    const device_id = req.device?.device_id;

    if (!device_id) {
      res.status(401).json({ error: 'Device not authenticated' });
      return;
    }

    if (typeof temperature !== 'number') {
      await logInvalidMessage(device_id, req.body, 'Missing or invalid temperature field');
      res.status(400).json({ error: 'temperature is required and must be a number' });
      return;
    }

    if (temperature < -100 || temperature > 200) {
      await logInvalidMessage(device_id, req.body, `Temperature out of range: ${temperature}°C (valid: -100 to 200)`);
      res.status(400).json({ error: 'temperature must be between -100 and 200°C' });
      return;
    }

    if (typeof voltage !== 'number') {
      await logInvalidMessage(device_id, req.body, 'Missing or invalid voltage field');
      res.status(400).json({ error: 'voltage is required and must be a number' });
      return;
    }

    if (voltage < 0 || voltage > 500) {
      await logInvalidMessage(device_id, req.body, `Voltage out of range: ${voltage}V (valid: 0 to 500)`);
      res.status(400).json({ error: 'voltage must be between 0 and 500V' });
      return;
    }

    if (typeof current !== 'number') {
      await logInvalidMessage(device_id, req.body, 'Missing or invalid current field');
      res.status(400).json({ error: 'current is required and must be a number' });
      return;
    }

    if (current < 0 || current > 150) {
      await logInvalidMessage(device_id, req.body, `Current out of range: ${current}A (valid: 0 to 150)`);
      res.status(400).json({ error: 'current must be between 0 and 150A' });
      return;
    }

    if (typeof energy_kwh !== 'number') {
      await logInvalidMessage(device_id, req.body, 'Missing or invalid energy_kwh field');
      res.status(400).json({ error: 'energy_kwh is required and must be a number' });
      return;
    }

    if (energy_kwh < 0) {
      await logInvalidMessage(device_id, req.body, `Negative energy value: ${energy_kwh} kWh`);
      res.status(400).json({ error: 'energy_kwh must be >= 0' });
      return;
    }

    if (!status || typeof status !== 'string') {
      await logInvalidMessage(device_id, req.body, 'Missing or invalid status field');
      res.status(400).json({ error: 'status is required and must be a string' });
      return;
    }

    const eventTime = new Date(timestamp);
    const now = new Date();

    if (isNaN(eventTime.getTime())) {
      await logInvalidMessage(device_id, req.body, `Invalid timestamp format: ${timestamp}`);
      res.status(400).json({ error: 'Invalid timestamp format' });
      return;
    }

    if (eventTime > now) {
      await logInvalidMessage(device_id, req.body, `Future timestamp: ${timestamp}`);
      res.status(400).json({ error: 'Timestamp cannot be in the future' });
      return;
    }

    const ageInMinutes = (now.getTime() - eventTime.getTime()) / 1000 / 60;
    if (ageInMinutes > 5) {
      await logInvalidMessage(device_id, req.body, `Late event: ${ageInMinutes.toFixed(1)} minutes old (max: 5 minutes)`);
      res.status(400).json({ error: `Event is too old (${ageInMinutes.toFixed(1)} minutes)` });
      return;
    }

    next();
  } catch (error) {
    logger.error('Validation error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}
