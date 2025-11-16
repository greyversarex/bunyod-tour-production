import { Router } from 'express';
import { AgentUserController } from '../controllers/agentUserController';
import { agentAuthMiddleware } from '../middleware/agentAuth';

const router = Router();

// POST /api/agent/login - Вход для агентов
router.post('/login', AgentUserController.login);

// GET /api/agent/profile - Получение профиля агента (требует авторизации)
router.get('/profile', agentAuthMiddleware, AgentUserController.getProfile);

// POST /api/agent/tour-bookings - Создание заявки на тур (требует авторизации)
router.post('/tour-bookings', agentAuthMiddleware, AgentUserController.createTourBooking);

// GET /api/agent/tour-bookings - Получение списка заявок агента (требует авторизации)
router.get('/tour-bookings', agentAuthMiddleware, AgentUserController.getTourBookings);

export default router;
