import { Router } from 'express';
import * as orderController from '../controllers/orderController';
import { orderLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes с защитой от спама заказов
router.post('/', orderLimiter, orderController.createOrder);
router.get('/number/:orderNumber', orderController.getOrder);

// Admin routes с защитой от спама на критические операции
router.get('/', orderController.getAllOrders);
router.get('/:id', orderController.getOrderById);
router.put('/:id/status', orderLimiter, orderController.updateOrderStatusById);
router.put('/:orderNumber/status', orderLimiter, orderController.updateOrderStatus);
router.put('/:orderNumber/cancel', orderLimiter, orderController.cancelOrder);

export default router;