import express from 'express';
import { adminAuthMiddleware } from '../controllers/adminController';
import {
    getAllNews,
    getNewsBySlug,
    getNewsById,
    getAllNewsAdmin,
    createNews,
    updateNews,
    deleteNews,
    subscribeNewsletter,
    getNewsletterSubscribers,
    getNewsStats
} from '../controllers/newsController';

const router = express.Router();

// Admin routes - Protected with authentication middleware (MUST be before /:id)
router.get('/admin/all', adminAuthMiddleware, getAllNewsAdmin);
router.get('/admin/stats', adminAuthMiddleware, getNewsStats);
router.get('/admin/newsletter/subscribers', adminAuthMiddleware, getNewsletterSubscribers);
router.get('/admin/:id', adminAuthMiddleware, getNewsById);
router.post('/admin/create', adminAuthMiddleware, createNews);
router.put('/admin/:id', adminAuthMiddleware, updateNews);
router.delete('/admin/:id', adminAuthMiddleware, deleteNews);

// Public routes
router.get('/', getAllNews);
router.get('/slug/:slug', getNewsBySlug);
router.post('/newsletter/subscribe', subscribeNewsletter);
router.get('/:id', getNewsById);

export default router;