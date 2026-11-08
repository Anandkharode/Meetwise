import { Router } from 'express';
import { aiHealth } from '../controllers/aiHealthController.js';

const router = Router();
router.get('/health', aiHealth);

export default router;
