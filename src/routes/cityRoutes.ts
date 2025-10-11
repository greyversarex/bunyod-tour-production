import { Router } from 'express';
import { CityController } from '../controllers/cityController';

const router = Router();

/**
 * @route GET /api/cities
 * @desc Получить все города
 */
router.get('/', CityController.getAllCities);

/**
 * @route GET /api/cities/country/:countryId
 * @desc Получить города по стране
 */
router.get('/country/:countryId', CityController.getCitiesByCountry);

/**
 * @route GET /api/cities/:id
 * @desc Получить город по ID
 */
router.get('/:id', CityController.getCityById);

/**
 * @route POST /api/cities
 * @desc Создать новый город
 */
router.post('/', CityController.createCity);

/**
 * @route PUT /api/cities/:id
 * @desc Обновить город
 */
router.put('/:id', CityController.updateCity);

/**
 * @route DELETE /api/cities/:id
 * @desc Удалить город
 */
router.delete('/:id', CityController.deleteCity);

export default router;