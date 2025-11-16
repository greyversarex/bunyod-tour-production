// @ts-nocheck
import { Router } from 'express';
import * as guideController from '../controllers/guideController';
import { upload } from '../controllers/tourGuideController';

const router = Router();

// Public routes
router.get('/tours/:tourId/guides', guideController.getGuidesByTour);

// Admin routes
router.post('/', guideController.createGuide);
router.get('/', guideController.getAllGuides);
router.get('/:id', guideController.getGuideById);
router.put('/:id', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'documents', maxCount: 10 }
]), guideController.updateGuide);
router.delete('/:id', guideController.deleteGuide);
router.post('/link', guideController.linkGuideToTour);

export default router;