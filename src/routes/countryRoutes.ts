import { Router } from 'express';
import { CountryController } from '../controllers/countryController';

const router = Router();

/**
 * @route GET /api/countries
 * @desc Получить все страны
 */
router.get('/', CountryController.getAllCountries);

/**
 * @route GET /api/countries/:id
 * @desc Получить страну по ID
 */
router.get('/:id', CountryController.getCountryById);

/**
 * @route POST /api/countries
 * @desc Создать новую страну
 */
router.post('/', CountryController.createCountry);

/**
 * @route PUT /api/countries/:id
 * @desc Обновить страну
 */
router.put('/:id', CountryController.updateCountry);

/**
 * @route DELETE /api/countries/:id
 * @desc Удалить страну
 */
router.delete('/:id', CountryController.deleteCountry);

export default router;