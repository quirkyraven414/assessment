import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateTelemetry } from '../middlewares/validation.middleware';
import {
  postTelemetry,
  getLatestTelemetry,
  getAlerts,
  healthCheck,
} from '../controllers/telemetry.controller';

const router = Router();

router.post('/telemetry', authMiddleware, validateTelemetry, postTelemetry);

router.get('/devices/:deviceId/latest', authMiddleware, getLatestTelemetry);

router.get('/alerts', authMiddleware, getAlerts);

router.get('/health', healthCheck);

export default router;
