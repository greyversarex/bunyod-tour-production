import express from 'express';
import * as customTourController from '../controllers/customTourController';
import { adminAuthMiddleware } from '../controllers/adminController';

const router = express.Router();

/**
 * 🔒 ALL ROUTES REQUIRE ADMIN AUTHENTICATION
 */

/**
 * GET /api/custom-tour-components
 * Get all custom tour components (with optional filters)
 */
router.get('/', adminAuthMiddleware, customTourController.getAllComponents);

/**
 * GET /api/custom-tour-components/country/:countryId
 * Get components by country
 */
router.get('/country/:countryId', adminAuthMiddleware, customTourController.getComponentsByCountry);

/**
 * GET /api/custom-tour-components/categories
 * Get all unique categories
 */
router.get('/categories', adminAuthMiddleware, customTourController.getCategories);

/**
 * GET /api/custom-tour-components/:id
 * Get single component by ID
 */
router.get('/:id', adminAuthMiddleware, customTourController.getComponentById);

/**
 * POST /api/custom-tour-components
 * Create a new custom tour component
 */
router.post('/', adminAuthMiddleware, customTourController.createComponent);

/**
 * PUT /api/custom-tour-components/:id
 * Update a custom tour component
 */
router.put('/:id', adminAuthMiddleware, customTourController.updateComponent);

/**
 * DELETE /api/custom-tour-components/:id
 * Delete (soft delete) a custom tour component
 */
router.delete('/:id', adminAuthMiddleware, customTourController.deleteComponent);

export default router;
