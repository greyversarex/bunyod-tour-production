// @ts-nocheck
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { CityCardPhotoController } from '../controllers/cityCardPhotoController';

const router = Router();

// Создаем папку для фото карточек городов
const uploadDir = 'attached_assets/city-card-photos';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for city card photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'city-card-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
    }
  }
});

/**
 * @route GET /api/city-card-photos
 * @desc Получить все фото карточек городов
 */
router.get('/', CityCardPhotoController.getAllCityCardPhotos);

/**
 * @route GET /api/city-card-photos/:id
 * @desc Получить фото карточки города по ID
 */
router.get('/:id', CityCardPhotoController.getCityCardPhotoById);

/**
 * @route POST /api/city-card-photos
 * @desc Создать новое фото карточки города
 */
router.post('/', upload.single('image'), CityCardPhotoController.createCityCardPhoto);

/**
 * @route PUT /api/city-card-photos/:id
 * @desc Обновить фото карточки города
 */
router.put('/:id', upload.single('image'), CityCardPhotoController.updateCityCardPhoto);

/**
 * @route DELETE /api/city-card-photos/:id
 * @desc Удалить фото карточки города
 */
router.delete('/:id', CityCardPhotoController.deleteCityCardPhoto);

export default router;
