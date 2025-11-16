import { Router } from 'express';
import {
  createGuideReview,
  getGuideReviews,
  getAllGuideReviews,
  moderateGuideReview,
  deleteGuideReview,
  getGuideReviewStats,
} from '../controllers/guideReviewController';
import { authenticateJWT } from '../middleware/auth';
import { adminAuthMiddleware } from '../controllers/adminController';

const router = Router();

// Публичные маршруты
router.post('/', createGuideReview);
router.get('/guide/:guideId', getGuideReviews);
router.get('/guide/:guideId/stats', getGuideReviewStats);

// Защищенные маршруты (только для админа)
router.get('/', authenticateJWT, adminAuthMiddleware, getAllGuideReviews);
router.patch('/:id/moderate', authenticateJWT, adminAuthMiddleware, moderateGuideReview);
router.delete('/:id', authenticateJWT, adminAuthMiddleware, deleteGuideReview);

export default router;
