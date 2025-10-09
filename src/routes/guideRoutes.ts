import { Router } from 'express';
import * as guideController from '../controllers/guideController';

const router = Router();

// Public routes
router.get('/tours/:tourId/guides', guideController.getGuidesByTour);

// Admin routes
router.post('/', guideController.createGuide);
router.get('/', guideController.getAllGuides);
router.get('/:id', guideController.getGuideById);
router.put('/:id', guideController.updateGuide);
router.delete('/:id', guideController.deleteGuide);
router.post('/link', guideController.linkGuideToTour);

export default router;