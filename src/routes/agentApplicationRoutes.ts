// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import FileType from 'file-type';
import { sendAgentWelcomeEmail } from '../services/emailServiceSendGrid';
import { adminAuthMiddleware } from '../controllers/adminController';

const router = Router();
const prisma = new PrismaClient();

// Валидация email формата
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

// Валидация телефона (международный формат)
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
}

// Безопасная генерация имени файла (защита от path traversal)
function generateSafeFilename(originalname: string): string {
  const ext = path.extname(originalname).toLowerCase();
  const randomName = crypto.randomBytes(16).toString('hex');
  return `${randomName}${ext}`;
}

// Валидация типа файла по магическим байтам
async function validateFileType(filePath: string): Promise<boolean> {
  try {
    const buffer = await fs.readFile(filePath);
    const fileType = await FileType.fromBuffer(buffer);
    
    if (!fileType) {
      // Если не удалось определить тип, проверим PDF заголовок
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.pdf') {
        // Проверяем PDF signature: "%PDF"
        const pdfHeader = buffer.slice(0, 5).toString('ascii');
        return pdfHeader.startsWith('%PDF');
      }
      return false;
    }
    
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    return allowedMimeTypes.includes(fileType.mime);
  } catch (error) {
    console.error('Error validating file type:', error);
    return false;
  }
}

// Настройка multer для загрузки документов
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'agent-documents');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      return cb(null, uploadDir);
    } catch (error) {
      return cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    // Безопасная генерация имени файла
    const safeFilename = generateSafeFilename(file.originalname);
    return cb(null, safeFilename);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 6 // Максимум 6 файлов
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = allowedMimeTypes.includes(file.mimetype);
    const extOk = allowedExtensions.includes(ext);
    
    if (extOk) {
      return cb(null, true);
    } else {
      return cb(new Error('Только JPG, PNG и PDF файлы разрешены'));
    }
  }
});

// POST /api/agent-applications - Подача заявки на партнерство
router.post('/', upload.fields([
  { name: 'idDocument', maxCount: 1 },
  { name: 'otherDocuments', maxCount: 5 }
]), async (req, res) => {
  try {
    const { fullName, citizenship, address, phone, email, partnershipAgreement, privacyAgreement } = req.body;
    
    // Валидация обязательных полей
    if (!fullName || !citizenship || !address || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'Все обязательные поля должны быть заполнены'
      });
    }
    
    // Валидация длины и формата
    if (fullName.length > 255 || citizenship.length > 100 || address.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Превышена максимальная длина полей'
      });
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат email'
      });
    }
    
    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат телефона (используйте международный формат)'
      });
    }
    
    // Проверка дубликатов email
    const existingApplication = await prisma.agentApplication.findFirst({
      where: {
        email,
        status: { in: ['pending', 'approved'] }
      }
    });
    
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'Заявка с этим email уже существует'
      });
    }
    
    if (partnershipAgreement !== 'true' || privacyAgreement !== 'true') {
      return res.status(400).json({
        success: false,
        message: 'Необходимо согласиться с договором и политикой конфиденциальности'
      });
    }
    
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    // Валидация загруженных файлов по магическим байтам
    const allFiles: Express.Multer.File[] = [
      ...(files.idDocument || []),
      ...(files.otherDocuments || [])
    ];
    
    for (const file of allFiles) {
      const isValid = await validateFileType(file.path);
      if (!isValid) {
        // Удаляем все загруженные файлы
        for (const f of allFiles) {
          try {
            await fs.unlink(f.path);
          } catch (err) {
            console.error('Error deleting file:', err);
          }
        }
        return res.status(400).json({
          success: false,
          message: 'Недопустимый тип файла. Разрешены только JPG, PNG и PDF файлы.'
        });
      }
    }
    
    const idDocument = files.idDocument?.[0]?.filename || null;
    const otherDocuments = files.otherDocuments?.map(f => f.filename).join(',') || null;
    
    // Создание заявки
    const application = await prisma.agentApplication.create({
      data: {
        fullName,
        citizenship,
        address,
        phone,
        email,
        idDocument,
        otherDocuments,
        partnershipAgreement: true,
        privacyPolicyAgreement: true,
        status: 'pending'
      }
    });
    
    return res.status(201).json({
      success: true,
      message: 'Заявка успешно отправлена',
      applicationId: application.id
    });
  } catch (error) {
    console.error('Error creating agent application:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при создании заявки'
    });
  }
});

// GET /api/agent-applications - Получение списка заявок (для админа)
router.get('/', adminAuthMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    
    const applications = await prisma.agentApplication.findMany({
      where: status ? { status: status as string } : undefined,
      orderBy: { createdAt: 'desc' }
    });
    
    return res.json({
      success: true,
      applications
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении заявок'
    });
  }
});

// POST /api/agent-applications/:id/approve - Одобрение заявки
router.post('/:id/approve', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const appId = parseInt(id);
    
    // Валидация ID
    if (isNaN(appId) || appId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Неверный ID заявки'
      });
    }
    
    // Получаем заявку
    const application = await prisma.agentApplication.findUnique({
      where: { id: appId }
    });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
    }
    
    if (application.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Заявка уже обработана'
      });
    }
    
    // Проверка существующего пользователя с таким email
    const existingUser = await prisma.agent_users.findUnique({
      where: { email: application.email }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким email уже существует'
      });
    }
    
    // Генерация уникального ID для агента (формат: BT000001)
    const lastAgent = await prisma.agent_users.findFirst({
      orderBy: { id: 'desc' }
    });
    
    let nextNumber = 1;
    if (lastAgent && lastAgent.unique_id.startsWith('BT')) {
      const numPart = lastAgent.unique_id.replace('BT', '');
      const parsed = parseInt(numPart);
      nextNumber = isNaN(parsed) ? 1 : parsed + 1;
    }
    const uniqueId = `BT${String(nextNumber).padStart(6, '0')}`;
    
    // Генерация надежного пароля
    const password = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создание аккаунта турагента
    const agentUser = await prisma.agent_users.create({
      data: {
        uniqueId,
        fullName: application.full_name,
        email: application.email,
        password: hashedPassword,
        citizenship: application.citizenship,
        address: application.address,
        phone: application.phone,
        is_active: true
      }
    });
    
    // Обновление статуса заявки
    await prisma.agentApplication.update({
      where: { id: appId },
      data: { status: 'approved' }
    });
    
    // Отправка письма с данными для входа через SendGrid
    try {
      await sendAgentWelcomeEmail(application.email, {
        fullName: application.full_name,
        uniqueId,
        email: application.email,
        password,
        loginUrl: `${process.env.SITE_URL || 'http://localhost:5000'}/agent-login.html`
      });
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError);
      // Продолжаем, даже если письмо не отправилось
    }
    
    return res.json({
      success: true,
      message: 'Заявка одобрена, аккаунт создан',
      agentUser: {
        uniqueId: agentUser.unique_id,
        email: agentUser.email,
        fullName: agentUser.full_name
      }
    });
  } catch (error: any) {
    console.error('Error approving application:', error);
    
    // Специальная обработка ошибок уникальности email
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким email уже существует'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при одобрении заявки'
    });
  }
});

// DELETE /api/agent-applications/:id - Отклонение заявки
router.delete('/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const appId = parseInt(id);
    
    // Валидация ID
    if (isNaN(appId) || appId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Неверный ID заявки'
      });
    }
    
    const application = await prisma.agentApplication.findUnique({
      where: { id: appId }
    });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
    }
    
    // Удаление загруженных файлов
    if (application.idDocument) {
      const idDocPath = path.join(process.cwd(), 'uploads', 'agent-documents', application.idDocument);
      try {
        await fs.unlink(idDocPath);
      } catch (err) {
        console.error('Error deleting ID document:', err);
      }
    }
    
    if (application.otherDocuments) {
      const otherDocs = application.otherDocuments.split(',');
      for (const doc of otherDocs) {
        const docPath = path.join(process.cwd(), 'uploads', 'agent-documents', doc);
        try {
          await fs.unlink(docPath);
        } catch (err) {
          console.error('Error deleting document:', err);
        }
      }
    }
    
    // Удаление заявки
    await prisma.agentApplication.delete({
      where: { id: appId }
    });
    
    return res.json({
      success: true,
      message: 'Заявка отклонена и удалена'
    });
  } catch (error) {
    console.error('Error deleting application:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при удалении заявки'
    });
  }
});

// Функция генерации надежного пароля
function generateSecurePassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export default router;
