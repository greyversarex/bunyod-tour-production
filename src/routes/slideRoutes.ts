import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getSlides,
  getAllSlides,
  getSlideById,
  createSlide,
  updateSlide,
  deleteSlide,
  updateSlideOrder
} from '../controllers/slideController';

// Configure multer for slide image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/slides';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'slide-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const router = Router();

// Public routes
router.get('/', getSlides); // Get active slides for frontend

// Admin routes
router.get('/admin', getAllSlides); // Get all slides for admin
router.get('/:id', getSlideById);
router.post('/', upload.single('image'), createSlide); // With file upload
router.put('/:id', upload.single('image'), updateSlide);
router.delete('/:id', deleteSlide);
router.put('/reorder', updateSlideOrder);

export default router;