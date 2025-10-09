import { Router } from 'express';
import {
    getExchangeRates,
    getExchangeRatesMap,
    updateExchangeRate,
    deleteExchangeRate,
    createExchangeRate,
    initializeExchangeRates,
    convertPrice
} from '../controllers/exchangeRateController';
import { adminAuthMiddleware } from '../controllers/adminController';

const router = Router();

// Публичные endpoints (доступны без авторизации)
router.get('/', getExchangeRates);
router.get('/map', getExchangeRatesMap);
router.get('/convert', convertPrice);

// Административные endpoints (требуют авторизации администратора)
router.post('/initialize', adminAuthMiddleware, initializeExchangeRates);
router.post('/', adminAuthMiddleware, createExchangeRate);
router.put('/:currency', adminAuthMiddleware, updateExchangeRate);
router.delete('/:currency', adminAuthMiddleware, deleteExchangeRate);

export default router;