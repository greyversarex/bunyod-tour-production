import express from 'express';
import { authenticateTourGuide } from '../middleware/tourGuideAuth';
import { loginLimiter, registrationLimiter } from '../middleware/rateLimiter';
import {
  loginTourGuide,
  getGuideTours,
  getTourDetails,
  startTour,
  finishTour,
  collectReviews,
  createTourGuideProfile,
  updateGuideProfile,
  uploadGuideAvatar,
  uploadGuideDocuments,
  deleteGuideDocument,
  upload
} from '../controllers/tourGuideController';

const router = express.Router();

// Авторизация с защитой от brute-force
router.post('/login', loginLimiter, loginTourGuide);

// Создание тургида с аутентификацией (для админ панели) - с поддержкой загрузки файлов
router.post('/create-with-auth', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'documents', maxCount: 10 }
]), createTourGuideProfile);

// Защищённые маршруты для тургидов (требуют авторизации)
router.get('/tours', authenticateTourGuide, getGuideTours);
router.get('/tours/:id', authenticateTourGuide, getTourDetails);
router.post('/tours/:id/start', authenticateTourGuide, startTour);
router.post('/tours/:id/finish', authenticateTourGuide, finishTour);
router.post('/tours/:id/collect-reviews', authenticateTourGuide, collectReviews);

// Маршруты для управления профилем гида (админ панель) - с поддержкой загрузки файлов
router.put('/profile/:id', upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'documents', maxCount: 10 }
]), updateGuideProfile);
router.post('/profile/:id/avatar', upload.single('avatar'), uploadGuideAvatar);
router.post('/profile/:id/documents', upload.array('documents', 10), uploadGuideDocuments);
router.delete('/profile/:id/document', deleteGuideDocument);

export default router;