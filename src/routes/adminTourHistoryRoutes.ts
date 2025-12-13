import express from 'express';
import {
  getActiveTours,
  getFinishedTours,
  getTourDetailsAdmin,
  createTourGuide,
  getAllTourGuides,
  updateTourGuide,
  assignGuideToTour,
  deleteTourGuide,
  getPaidBookings,
  assignGuideToBooking,
  addGuideToBooking,
  removeGuideFromBooking,
  getBookingGuides,
  updateBookingExecutionStatus,
  getGuideBookings,
  collectBookingReviews,
  syncBookings
} from '../controllers/tourHistoryController';

const router = express.Router();

// Маршруты для истории туров (префикс /admin/history уже добавлен в index.ts)
router.get('/tours/active', getActiveTours);
router.get('/tours/finished', getFinishedTours);
router.get('/tours/:id', getTourDetailsAdmin);

// Маршруты для управления тургидами
router.post('/guides', createTourGuide);
router.get('/guides', getAllTourGuides);
router.put('/guides/:id', updateTourGuide);
router.delete('/guides/:id', deleteTourGuide);

// Назначение тургидов на туры (legacy - для совместимости)
router.post('/tours/assign-guide', assignGuideToTour);

// Новая система: работа с бронированиями
router.get('/bookings/paid', getPaidBookings);
router.post('/bookings/assign-guide', assignGuideToBooking);
router.post('/bookings/add-guide', addGuideToBooking);
router.post('/bookings/remove-guide', removeGuideFromBooking);
router.get('/bookings/:bookingId/guides', getBookingGuides);
router.patch('/bookings/:id/execution-status', updateBookingExecutionStatus);
router.post('/bookings/:id/collect-reviews', collectBookingReviews);
router.get('/guides/:guideId/bookings', getGuideBookings);

// Синхронизация бронирований с оплаченными заказами
router.post('/sync-bookings', syncBookings);

export default router;