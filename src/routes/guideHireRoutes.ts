import { Router } from 'express';
import {
  getGuideAvailability,
  updateGuideAvailability,
  createGuideHireRequest,
  getGuideHireRequests,
  updateGuideHireRequestStatus,
  getAvailableGuides,
  createDirectGuideHireOrder,
  getMyHires
} from '../controllers/guideHireController';
import { adminAuthMiddleware } from '../controllers/adminController';
import { authenticateTourGuide } from '../middleware/tourGuideAuth';
import { orderLimiter } from '../middleware/rateLimiter';

const router = Router();

// Публичные endpoints (доступны без авторизации)
router.get('/available', getAvailableGuides);
router.get('/:guideId/availability', getGuideAvailability);
router.post('/hire-request', createGuideHireRequest);
router.post('/orders', orderLimiter, createDirectGuideHireOrder); // НОВЫЙ: Прямой заказ без одобрения + rate limiting

// Endpoints для тургидов (требуют авторизации тургида)
router.put('/:guideId/availability', authenticateTourGuide, updateGuideAvailability);
router.get('/my-hires', authenticateTourGuide, getMyHires); // Наймы гида для его кабинета

// Административные endpoints (требуют авторизации администратора)
router.get('/hire-requests', adminAuthMiddleware, getGuideHireRequests);
router.put('/hire-requests/:requestId/status', adminAuthMiddleware, updateGuideHireRequestStatus);

export default router;