import express from 'express';
import * as customTourOrderController from '../controllers/customTourOrderController';
import { adminAuthMiddleware } from '../controllers/adminController';

const router = express.Router();

/**
 * PUBLIC endpoint for direct custom tour order creation with payment
 * POST /api/custom-tour-orders/create-payable-order
 * Creates order and redirects to payment (NO admin approval needed)
 */
router.post('/create-payable-order', customTourOrderController.createDirectCustomTourOrder);

/**
 * Public endpoint - Create new custom tour order
 * POST /api/custom-tour-orders
 */
router.post('/', customTourOrderController.createOrder);

/**
 * 🔒 ADMIN ONLY ENDPOINTS BELOW
 */

/**
 * GET /api/custom-tour-orders
 * Get all custom tour orders (with optional status filter)
 */
router.get('/', adminAuthMiddleware, customTourOrderController.getAllOrders);

/**
 * GET /api/custom-tour-orders/:id
 * Get single custom tour order by ID
 */
router.get('/:id', adminAuthMiddleware, customTourOrderController.getOrderById);

/**
 * PUT /api/custom-tour-orders/:id
 * Update custom tour order (status, admin notes, price)
 */
router.put('/:id', adminAuthMiddleware, customTourOrderController.updateOrder);

/**
 * DELETE /api/custom-tour-orders/:id
 * Delete custom tour order
 */
router.delete('/:id', adminAuthMiddleware, customTourOrderController.deleteOrder);

export default router;
