import { Router } from 'express';
import { 
  TourController, 
  CategoryController, 
  BookingRequestController, 
  ReviewController 
} from '../controllers/tourController';

const router = Router();

// Tour routes
router.get('/', TourController.getAllTours);
router.get('/search', TourController.searchTours);
router.get('/suggestions', TourController.getSearchSuggestions);
router.get('/:id/main-image', TourController.getTourMainImage);
router.get('/:id/similar', TourController.getSimilarTours);
router.get('/:id', TourController.getTourById);
router.post('/', TourController.createTour);
router.put('/:id', TourController.updateTour);
router.post('/:id/publish', TourController.publishTour); // 📝 Публикация черновика
router.post('/:id/duplicate', TourController.duplicateTour); // 📋 Дублирование тура
router.delete('/:id', TourController.deleteTour);

// Booking request routes for tours
router.post('/booking-requests', BookingRequestController.createBookingRequest);
router.get('/booking-requests', BookingRequestController.getAllBookingRequests);

// Review routes for tours
router.post('/reviews', ReviewController.createReview);
router.get('/reviews', ReviewController.getAllReviews);
router.put('/reviews/:id', ReviewController.updateReview);

export default router;
