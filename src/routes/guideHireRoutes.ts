import { Router } from 'express';
import {
  getGuideAvailability,
  updateGuideAvailability,
  createGuideHireRequest,
  getGuideHireRequests,
  updateGuideHireRequestStatus,
  getAvailableGuides
} from '../controllers/guideHireController';
import { guidePaymentController } from '../controllers/guidePaymentController';
import { adminAuthMiddleware } from '../controllers/adminController';
import { authenticateTourGuide } from '../middleware/tourGuideAuth';

const router = Router();

// Публичные endpoints (доступны без авторизации)
router.get('/available', getAvailableGuides);
router.get('/:guideId/availability', getGuideAvailability);
router.post('/hire-request', createGuideHireRequest);

// Payment endpoint для создания заказа из заявки на найм (ТОЛЬКО для админов)
router.post('/:id/create-order', adminAuthMiddleware, guidePaymentController.createOrderFromGuideHire);

// Endpoints для тургидов (требуют авторизации тургида)
router.put('/:guideId/availability', authenticateTourGuide, updateGuideAvailability);

// Административные endpoints (требуют авторизации администратора)
router.get('/hire-requests', adminAuthMiddleware, getGuideHireRequests);
router.put('/hire-requests/:requestId/status', adminAuthMiddleware, updateGuideHireRequestStatus);

export default router;