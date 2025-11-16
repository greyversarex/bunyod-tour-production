import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/images';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept only image files
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

// Simple image upload endpoint
router.post('/simple', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded' });
      return;
    }

    // Return the file path for storage in database
    const imagePath = `/uploads/images/${req.file.filename}`;
    
    res.json({
      success: true,
      imagePath: imagePath,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Serve uploaded images
router.get('/images/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), 'uploads', 'images', filename);
    
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    // Serve the image file
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Add PUT endpoint for ObjectUploader compatibility
router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageURL } = req.body;
    
    if (!imageURL) {
      res.status(400).json({ error: 'No image URL provided' });
      return;
    }

    // Normalize the path for database storage
    const objectPath = imageURL.replace(/^.*\/uploads\//, '/uploads/');
    
    res.json({
      success: true,
      objectPath: objectPath,
      imageURL: imageURL
    });
  } catch (error) {
    console.error('Error processing image URL:', error);
    res.status(500).json({ error: 'Failed to process image URL' });
  }
});

// Add POST endpoint for /api/images (frontend compatibility)
router.post('/', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file uploaded' });
      return;
    }

    // Return the file path for storage in database
    const imagePath = `/uploads/images/${req.file.filename}`;
    
    res.json({
      success: true,
      imagePath: imagePath,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router;