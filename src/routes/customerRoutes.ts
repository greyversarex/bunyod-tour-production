import { Router } from 'express';
import * as customerController from '../controllers/customerController';

const router = Router();

// Public routes
router.post('/', customerController.createCustomer);
router.post('/get-or-create', customerController.getOrCreateCustomer);

// Admin routes
router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

export default router;