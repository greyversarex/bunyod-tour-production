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

// Public routes
router.get('/', getAllNews);
router.get('/slug/:slug', getNewsBySlug);
router.get('/:id', getNewsById);
router.post('/newsletter/subscribe', subscribeNewsletter);

// Admin routes - Protected with authentication middleware
router.get('/admin/all', adminAuthMiddleware, getAllNewsAdmin);
router.get('/admin/stats', adminAuthMiddleware, getNewsStats);
router.post('/admin/create', adminAuthMiddleware, createNews);
router.put('/admin/:id', adminAuthMiddleware, updateNews);
router.delete('/admin/:id', adminAuthMiddleware, deleteNews);
router.get('/admin/newsletter/subscribers', adminAuthMiddleware, getNewsletterSubscribers);

export default router;