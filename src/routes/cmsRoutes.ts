import { Router } from 'express';
import { CMSController } from '../controllers/cmsController';
import { adminAuthMiddleware } from '../controllers/adminController';

const router = Router();

// Блоки контента
router.get('/content-blocks', CMSController.getContentBlocks);
router.post('/content-blocks', adminAuthMiddleware, CMSController.createContentBlock);
router.put('/content-blocks/:id', adminAuthMiddleware, CMSController.updateContentBlock);
router.delete('/content-blocks/:id', adminAuthMiddleware, CMSController.deleteContentBlock);

// Настройки сайта
router.get('/settings', CMSController.getSiteSettings);
router.post('/settings', adminAuthMiddleware, CMSController.upsertSiteSetting);

// Страницы
router.get('/pages', CMSController.getPages);
router.post('/pages', adminAuthMiddleware, CMSController.createPage);
router.put('/pages/:id', adminAuthMiddleware, CMSController.updatePage);

// Меню
router.get('/menu-items', CMSController.getMenuItems);
router.post('/menu-items', adminAuthMiddleware, CMSController.createMenuItem);
router.put('/menu-items/:id', adminAuthMiddleware, CMSController.updateMenuItem);
router.delete('/menu-items/:id', adminAuthMiddleware, CMSController.deleteMenuItem);

// Temporary alias for backwards compatibility
router.get('/menu', CMSController.getMenuItems);

// Новости
router.get('/news', CMSController.getNews);

export default router;