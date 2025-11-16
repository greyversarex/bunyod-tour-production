import express from 'express';
import { bookingController } from '../controllers/bookingController';
import { orderLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Booking routes - 3-step booking system с защитой от спама на ВСЕХ этапах
router.post('/start', orderLimiter, bookingController.startBooking);              // Step 1: Start booking
router.put('/:id/step1', orderLimiter, bookingController.updateBookingStep1);     // Step 1: Hotel/room selection
router.post('/:id/calculate-price', orderLimiter, bookingController.calculatePrice);  // Calculate price in real-time
router.put('/:id/details', orderLimiter, bookingController.updateBookingDetails); // Step 2: Tourist details
router.post('/:id/create-order', orderLimiter, bookingController.createOrderFromBooking); // Step 3: Create Order
router.put('/:id/pay', orderLimiter, bookingController.processPayment);           // Step 3: Payment
router.get('/:id', bookingController.getBooking);                   // Get booking details

// Helper routes
router.get('/tour/:tourId/hotels', bookingController.getTourHotels);

export default router;