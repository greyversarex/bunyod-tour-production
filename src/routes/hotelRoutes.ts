import { Router } from 'express';
import {
  getHotels,
  getHotel,
  createHotel,
  updateHotel,
  publishHotel,
  deleteHotel,
  addHotelToTour,
  removeHotelFromTour
} from '../controllers/hotelController';

const router = Router();

// Public routes
router.get('/', getHotels);
router.get('/:id', getHotel);

// Protected admin routes (add authentication middleware when needed)
router.post('/', createHotel);
router.put('/:id', updateHotel);
router.post('/:id/publish', publishHotel); // 📝 Публикация черновика
router.delete('/:id', deleteHotel);

// Tour-Hotel association routes
router.post('/tours/:tourId/hotels/:hotelId', addHotelToTour);
router.delete('/tours/:tourId/hotels/:hotelId', removeHotelFromTour);
router.post('/link', addHotelToTour);

export default router;