import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { CityController } from '../controllers/cityController';

const router = Router();

// Configure multer for city image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'attached_assets/cities/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'city-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF)'));
    }
  }
});

/**
 * @route GET /api/cities
 * @desc Получить все города
 */
router.get('/', CityController.getAllCities);

/**
 * @route GET /api/cities/country/:countryId
 * @desc Получить города по стране
 */
router.get('/country/:countryId', CityController.getCitiesByCountry);

/**
 * @route GET /api/cities/:id
 * @desc Получить город по ID
 */
router.get('/:id', CityController.getCityById);

/**
 * @route POST /api/cities
 * @desc Создать новый город
 */
router.post('/', upload.single('image'), CityController.createCity);

/**
 * @route PUT /api/cities/:id
 * @desc Обновить город
 */
router.put('/:id', upload.single('image'), CityController.updateCity);

/**
 * @route DELETE /api/cities/:id
 * @desc Удалить город
 */
router.delete('/:id', CityController.deleteCity);

export default router;