import express from 'express';
import {
  getActiveTours,
  getFinishedTours,
  getTourDetailsAdmin,
  createTourGuide,
  getAllTourGuides,
  updateTourGuide,
  assignGuideToTour,
  deleteTourGuide
} from '../controllers/tourHistoryController';

const router = express.Router();

// Маршруты для истории туров
router.get('/tours/history/active', getActiveTours);
router.get('/tours/history/finished', getFinishedTours);
router.get('/tours/:id', getTourDetailsAdmin);

// Маршруты для управления тургидами
router.post('/tour-guides', createTourGuide);
router.get('/tour-guides', getAllTourGuides);
router.put('/tour-guides/:id', updateTourGuide);
router.delete('/tour-guides/:id', deleteTourGuide);

// Назначение тургидов на туры
router.post('/tours/assign-guide', assignGuideToTour);

export default router;