import { Router } from 'express';
import { translationController } from '../controllers/translationController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Translation routes - require admin authentication
router.post('/text', authenticateJWT, (req, res) => 
  translationController.translateText(req, res)
);

router.post('/tour/:id', authenticateJWT, (req, res) => 
  translationController.translateTour(req, res)
);

router.post('/tours/batch', authenticateJWT, (req, res) => 
  translationController.batchTranslateTours(req, res)
);

router.post('/detect', authenticateJWT, (req, res) => 
  translationController.detectLanguage(req, res)
);

router.get('/languages', (req, res) => 
  translationController.getSupportedLanguages(req, res)
);

export default router;