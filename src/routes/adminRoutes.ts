import { Router } from 'express';
import { AdminController, adminAuthMiddleware } from '../controllers/adminController';
import { loginLimiter, registrationLimiter } from '../middleware/rateLimiter';

const router = Router();

// Аутентификация (публичные роуты) с защитой от brute-force
router.post('/login', loginLimiter, AdminController.login);
router.post('/verify-token', AdminController.verifyToken);

// Создание администратора (только для разработки) с защитой от спама
router.post('/create-admin', registrationLimiter, AdminController.createAdmin);

// Защищенные роуты админ панели (требуют аутентификацию)
router.get('/dashboard-stats', adminAuthMiddleware, AdminController.getDashboardStats);
// Temporary public stats endpoint for debugging
router.get('/stats', AdminController.getDashboardStats);
router.get('/tours', adminAuthMiddleware, AdminController.getTours);
router.get('/orders', adminAuthMiddleware, AdminController.getOrders);

export default router;