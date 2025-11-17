import express from 'express';
import multer from 'multer';
import path from 'path';
import * as travelAgentController from '../controllers/travelAgentController';
import * as agentBookingController from '../controllers/agentBookingController';
import { authenticateJWT as authMiddleware } from '../middleware/auth';
import { agentAuthMiddleware, requirePasswordChange } from '../middleware/agentAuthMiddleware';

const router = express.Router();

// Настройка multer для загрузки документов
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.NODE_ENV === 'production'
      ? '/var/bunyod-tour/uploads/documents'
      : 'uploads/documents';
    
    // Создаем директорию если не существует
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Sanitize filename - убираем опасные символы
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + '-' + sanitizedName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Разрешены только документы: PDF, DOC, DOCX, JPG, PNG'));
    }
  }
});

// ============ ПУБЛИЧНЫЕ МАРШРУТЫ ============

// Подать заявку на партнерство
router.post(
  '/applications',
  upload.fields([
    { name: 'identityDocument', maxCount: 1 },
    { name: 'otherDocuments', maxCount: 5 }
  ]),
  travelAgentController.submitApplication
);

// Авторизация турагента
router.post('/auth/login', travelAgentController.agentLogin);

// ============ МАРШРУТЫ ДЛЯ ТУРАГЕНТОВ (требуют auth) ============

// Получить профиль
router.get('/profile', agentAuthMiddleware, travelAgentController.getAgentProfile);

// Сменить пароль
router.post('/profile/change-password', agentAuthMiddleware, travelAgentController.changePassword);

// Заявки на туры (с проверкой смены пароля)
router.post('/bookings', agentAuthMiddleware, requirePasswordChange, agentBookingController.createBooking);
router.get('/bookings', agentAuthMiddleware, requirePasswordChange, agentBookingController.getMyBookings);
router.get('/bookings/stats', agentAuthMiddleware, requirePasswordChange, agentBookingController.getBookingStats);
router.get('/bookings/:id', agentAuthMiddleware, requirePasswordChange, agentBookingController.getBookingById);
router.put('/bookings/:id', agentAuthMiddleware, requirePasswordChange, agentBookingController.updateBooking);
router.delete('/bookings/:id', agentAuthMiddleware, requirePasswordChange, agentBookingController.deleteBooking);

// ============ АДМИНСКИЕ МАРШРУТЫ (требуют admin auth) ============

// Заявки на партнерство
router.get('/admin/applications', authMiddleware, travelAgentController.getAllApplications);
router.get('/admin/applications/:id', authMiddleware, travelAgentController.getApplicationById);
router.post('/admin/applications/:id/approve', authMiddleware, travelAgentController.approveApplication);
router.post('/admin/applications/:id/reject', authMiddleware, travelAgentController.rejectApplication);

// Управление турагентами
router.get('/admin/agents', authMiddleware, travelAgentController.getAllAgents);
router.get('/admin/agents/:id', authMiddleware, travelAgentController.getAgentById);
router.put('/admin/agents/:id', authMiddleware, travelAgentController.updateAgent);
router.patch('/admin/agents/:id/status', authMiddleware, travelAgentController.updateAgentStatus);

// Заявки от турагентов
router.get('/admin/bookings', authMiddleware, agentBookingController.getAllBookings);
router.patch('/admin/bookings/:id/status', authMiddleware, agentBookingController.updateBookingStatus);

export default router;
