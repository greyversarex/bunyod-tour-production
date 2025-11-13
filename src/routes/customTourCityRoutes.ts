import express from 'express';
import * as customTourCityController from '../controllers/customTourCityController';
import { adminAuthMiddleware } from '../controllers/adminController';

const router = express.Router();

// Public routes (for frontend form)
router.get('/cities', customTourCityController.getAllCities);

// Admin routes (protected)
router.get(
  '/admin/countries/:countryId/cities', 
  adminAuthMiddleware, 
  customTourCityController.getCitiesByCountry
);

router.post(
  '/admin/countries/:countryId/cities', 
  adminAuthMiddleware, 
  customTourCityController.createCity
);

router.put(
  '/admin/cities/:id', 
  adminAuthMiddleware, 
  customTourCityController.updateCity
);

router.delete(
  '/admin/cities/:id', 
  adminAuthMiddleware, 
  customTourCityController.deleteCity
);

export default router;
