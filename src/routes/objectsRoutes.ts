import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/images/';
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// POST /api/objects/upload - Generate upload URL for ObjectUploader
router.post('/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    // Generate a unique URL for direct file upload
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = 'image-' + uniqueSuffix + '.png';
    const uploadURL = `/api/objects/direct/${fileName}`;
    
    res.json({
      success: true,
      uploadURL: uploadURL,
      fileName: fileName
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate upload URL' 
    });
  }
});

// PUT /api/objects/direct/:fileName - Direct file upload endpoint
router.put('/direct/:fileName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName } = req.params;
    const uploadPath = 'uploads/images/';
    const filePath = path.join(uploadPath, fileName);
    
    // Ensure directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    // Write the file
    const fileStream = fs.createWriteStream(filePath);
    req.pipe(fileStream);
    
    fileStream.on('finish', () => {
      const publicURL = `/uploads/images/${fileName}`;
      res.json({
        success: true,
        url: publicURL,
        fileName: fileName
      });
    });
    
    fileStream.on('error', (error) => {
      console.error('File write error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save file'
      });
    });
    
  } catch (error) {
    console.error('Error handling direct upload:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload file' 
    });
  }
});

export default router;