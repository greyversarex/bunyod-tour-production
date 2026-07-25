import { Router } from 'express';
import {
  getAllTrips,
  createTrip,
  getTripById,
  updateTrip,
  deleteTrip,
  updateTripStatus
} from '../controllers/tripController';

const router = Router();

// Получить все поездки
router.get('/', getAllTrips);

// Создать новую поездку
router.post('/', createTrip);

// Получить поездку по ID
router.get('/:id', getTripById);

// Обновить поездку
router.put('/:id', updateTrip);

// Удалить поездку
router.delete('/:id', deleteTrip);

// Обновить статус поездки
router.patch('/:id/status', updateTripStatus);

export default router;