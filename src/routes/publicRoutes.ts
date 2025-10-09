import { Router } from 'express';
import { PublicController } from '../controllers/publicController';

const router = Router();

// Тестовый эндпоинт
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Public API is working',
    timestamp: new Date().toISOString()
  });
});

// Простой тест CMS блоков
router.get('/test-cms', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const blocks = await prisma.contentBlock.findMany({
      take: 3
    });
    
    res.json({
      success: true,
      data: blocks,
      count: blocks.length
    });
  } catch (error: any) {
    res.json({
      success: false,
      error: error?.message || 'Unknown error'
    });
  }
});

// Данные для главной страницы
router.get('/homepage', PublicController.getHomePageData);

// Статические страницы
router.get('/pages/:slug', PublicController.getPageBySlug);

// Меню сайта
router.get('/menu', PublicController.getMenu);

// Новости
router.get('/news', PublicController.getNews);

export default router;