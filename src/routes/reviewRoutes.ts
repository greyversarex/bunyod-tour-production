import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as reviewController from '../controllers/reviewController';
import { adminAuthMiddleware } from '../controllers/adminController';

const router = Router();

// Настройка multer для загрузки фотографий отзывов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'attached_assets/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'review-photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB максимум
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только изображения
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены!'));
    }
  }
});

// Public routes
router.post('/', reviewController.createReview);
router.get('/tours/:tourId', reviewController.getReviewsByTour);
router.get('/tours/:tourId/stats', reviewController.getReviewStats);
router.get('/homepage', reviewController.getHomepageReviews);

// Загрузка фотографий для отзывов
router.post('/upload-photos', upload.array('photos', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Не загружено ни одного файла'
      });
    }

    const files = req.files as Express.Multer.File[];
    const photoUrls = files.map(file => `/attached_assets/${file.filename}`);

    return res.json({
      success: true,
      data: {
        photos: photoUrls
      },
      message: `Загружено ${files.length} фотографий`
    });
  } catch (error) {
    console.error('Ошибка загрузки фотографий:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке фотографий'
    });
  }
});

// Admin routes (protected)
router.get('/', adminAuthMiddleware, reviewController.getAllReviews);
router.put('/:id/moderate', adminAuthMiddleware, reviewController.moderateReview);
router.put('/:id/approve', adminAuthMiddleware, reviewController.approveReview);
router.put('/:id/reject', adminAuthMiddleware, reviewController.rejectReview);
router.put('/:id/toggle-homepage', adminAuthMiddleware, reviewController.toggleShowOnHomepage);
router.delete('/:id', adminAuthMiddleware, reviewController.deleteReview);

export default router;