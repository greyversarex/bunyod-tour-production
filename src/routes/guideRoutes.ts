import { Router } from 'express';
import * as guideController from '../controllers/guideController';
import { upload } from '../controllers/tourGuideController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Public routes (списки/просмотр — контроллер сам отфильтрует sensitive поля)
router.get('/tours/:tourId/guides', guideController.getGuidesByTour);
router.get('/', guideController.getAllGuides);
router.get('/:id', guideController.getGuideById);

// Admin-only routes (требуют JWT администратора)
router.post('/', requireAdmin, guideController.createGuide);
router.put('/:id', requireAdmin, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'documents', maxCount: 10 }
]), guideController.updateGuide);
router.delete('/:id', requireAdmin, guideController.deleteGuide);
router.post('/link', requireAdmin, guideController.linkGuideToTour);
router.post('/:id/resend-credentials', requireAdmin, guideController.resendGuideCredentials);

export default router;