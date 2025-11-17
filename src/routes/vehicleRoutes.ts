import { Router } from 'express';
import {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle
} from '../controllers/vehicleController';

const router = Router();

// Public routes
router.get('/', getVehicles);
router.get('/:id', getVehicle);

// Protected admin routes (add authentication middleware when needed)
router.post('/', createVehicle);
router.put('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);

export default router;
