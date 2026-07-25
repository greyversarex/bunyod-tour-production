import { Router } from 'express';
import { sendMessage, getAIStatus } from '../controllers/chatbotController';
import rateLimit from 'express-rate-limit';

const router = Router();

const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please wait a moment' }
});

router.post('/message', chatbotLimiter, sendMessage);
router.get('/status', getAIStatus);

export default router;
