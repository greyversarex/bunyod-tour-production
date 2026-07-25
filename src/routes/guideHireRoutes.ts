import { Router } from 'express';
import {
  getGuideAvailability,
  updateGuideAvailability,
  createGuideHireRequest,
  getGuideHireRequests,
  updateGuideHireRequestStatus,
  getAvailableGuides,
  createDirectGuideHireOrder,
  getMyHires,
  respondToHireRequest,
  getGuideHireRequestById,
  deleteGuideHireRequest,
  getGuideBookedDates
} from '../controllers/guideHireController';
import { adminAuthMiddleware } from '../controllers/adminController';
import { authenticateTourGuide } from '../middleware/tourGuideAuth';
import { orderLimiter } from '../middleware/rateLimiter';

const router = Router();

// Публичные endpoints (доступны без авторизации)
router.get('/available', getAvailableGuides);
router.get('/:guideId/availability', getGuideAvailability);
router.get('/booked-dates/:guideId', getGuideBookedDates);
router.post('/hire-request', createGuideHireRequest);
router.post('/orders', orderLimiter, createDirectGuideHireOrder);

// Endpoints для тургидов (требуют авторизации тургида)
router.put('/:guideId/availability', authenticateTourGuide, updateGuideAvailability);
router.get('/my-hires', authenticateTourGuide, getMyHires); // Наймы гида для его кабинета
router.put('/my-hires/:requestId/respond', authenticateTourGuide, respondToHireRequest); // Принять/отклонить заявку

// Административные endpoints (требуют авторизации администратора)
router.get('/hire-requests', adminAuthMiddleware, getGuideHireRequests);
router.put('/hire-requests/:requestId/status', adminAuthMiddleware, updateGuideHireRequestStatus);
router.get('/hire-requests/:requestId', adminAuthMiddleware, getGuideHireRequestById);
router.delete('/hire-requests/:requestId', adminAuthMiddleware, deleteGuideHireRequest);

export default router;