import { Router } from 'express';
import { 
  getAllComponents, 
  getComponentById,
  getComponentByKey, 
  createComponent, 
  updateComponent, 
  deleteComponent, 
  initializeDefaults,
  calculateTourPrice
} from '../controllers/priceCalculatorController';

const router = Router();

// Get all pricing components
router.get('/', getAllComponents);

// Get component by ID (numeric)  
router.get('/id/:id', getComponentById);

// Get component by key (string)
router.get('/:key', getComponentByKey);

// Create new component
router.post('/', createComponent);

// Update component
router.put('/:id', updateComponent);

// Delete component
router.delete('/:id', deleteComponent);

// Initialize default components
router.post('/initialize', initializeDefaults);

// Calculate tour price based on components
router.post('/calculate', calculateTourPrice);

export default router;