import { Router, Request, Response } from 'express';
import { ObjectStorageService, ObjectNotFoundError } from '../services/objectStorage';

const router = Router();

// This endpoint is used to serve public assets.
router.get('/public-objects/:filePath', async (req: Request, res: Response): Promise<void> => {
  const filePath = req.params.filePath;
  const objectStorageService = new ObjectStorageService();
  try {
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    await objectStorageService.downloadObject(file, res);
  } catch (error) {
    console.error('Error searching for public object:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// This endpoint is used to serve private objects that can be accessed publicly
// (i.e.: without authentication and ACL check).
router.get('/objects/uploads/:fileName', async (req: Request, res: Response): Promise<void> => {
  const objectStorageService = new ObjectStorageService();
  try {
    // Extract the fileName from params
    const fileName = req.params.fileName;
    const objectFile = await objectStorageService.getObjectEntityFile(
      `/objects/uploads/${fileName}`,
    );
    await objectStorageService.downloadObject(objectFile, res);
  } catch (error) {
    console.error('Error checking object access:', error);
    if (error instanceof ObjectNotFoundError) {
      res.sendStatus(404);
      return;
    }
    res.sendStatus(500);
  }
});

// Simple image upload endpoint (fallback when Object Storage is not configured)
router.post('/objects/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    // Return a mock upload URL for now since Object Storage is not configured
    // In production, this would be replaced with proper cloud storage
    const mockUploadURL = '/api/upload/simple';
    res.json({ uploadURL: mockUploadURL });
  } catch (error) {
    console.error('Error getting upload URL:', error);
    res.status(500).json({ error: 'Failed to get upload URL' });
  }
});

// Example endpoint for updating the model state after an object entity is uploaded.
router.put('/images', async (req: Request, res: Response): Promise<void> => {
  if (!req.body.imageURL) {
    res.status(400).json({ error: 'imageURL is required' });
    return;
  }

  try {
    const objectStorageService = new ObjectStorageService();
    const objectPath = objectStorageService.normalizeObjectEntityPath(
      req.body.imageURL,
    );

    // Return the normalized path for use in database
    res.status(200).json({
      objectPath: objectPath,
      success: true
    });
  } catch (error) {
    console.error('Error setting image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;