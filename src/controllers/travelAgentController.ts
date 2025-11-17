import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../services/emailService';

const prisma = new PrismaClient();

/**
 * Подать заявку на партнерство (публичная форма)
 */
export const submitApplication = async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      citizenship,
      address,
      phone,
      email,
      agreementAccepted,
      privacyPolicyAccepted
    } = req.body;

    // Валидация
    if (!fullName || !citizenship || !address || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'Заполните все обязательные поля'
      });
    }

    if (!agreementAccepted || !privacyPolicyAccepted) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо принять условия договора и политику конфиденциальности'
      });
    }

    // Проверка существующей заявки
    const existingApplication = await prisma.travelAgentApplication.findFirst({
      where: {
        email,
        status: { in: ['pending', 'approved'] }
      }
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'Заявка с таким email уже существует'
      });
    }

    // Сохранение документов (если загружены)
    const documents: any[] = [];
    if (req.files && typeof req.files === 'object') {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (files.identityDocument) {
        documents.push({
          type: 'identity',
          filename: files.identityDocument[0].filename,
          originalName: files.identityDocument[0].originalname,
          path: files.identityDocument[0].path,
          size: files.identityDocument[0].size
        });
      }

      if (files.otherDocuments) {
        files.otherDocuments.forEach(file => {
          documents.push({
            type: 'other',
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size
          });
        });
      }
    }

    // Создание заявки
    const application = await prisma.travelAgentApplication.create({
      data: {
        fullName,
        citizenship,
        address,
        phone,
        email,
        documents: JSON.stringify(documents),
        agreementAccepted,
        privacyPolicyAccepted
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Заявка успешно отправлена',
      data: {
        id: application.id,
        email: application.email
      }
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при отправке заявки'
    });
  }
};

/**
 * Получить все заявки (админ)
 */
export const getAllApplications = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const applications = await prisma.travelAgentApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Парсинг JSON документов
    const applicationsWithDocs = applications.map(app => ({
      ...app,
      documents: app.documents ? JSON.parse(app.documents) : []
    }));

    return res.json({
      success: true,
      data: applicationsWithDocs
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении заявок'
    });
  }
};

/**
 * Получить заявку по ID (админ)
 */
export const getApplicationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const application = await prisma.travelAgentApplication.findUnique({
      where: { id: parseInt(id) }
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Заявка не найдена'
      });
    }

    return res.json({
      success: true,
      data: {
        ...application,
        documents: application.documents ? JSON.parse(application.documents) : []
      }
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении заявки'
    });
  }
};

/**
 * Генерация агент ID (BT000001, BT000002, ...)
 */
const generateAgentId = async (): Promise<string> => {
  const latestAgent = await prisma.travelAgent.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { agentId: true }
  });

  if (!latestAgent) {
    return 'BT000001';
  }

  const lastNumber = parseInt(latestAgent.agentId.replace('BT', ''));
  const nextNumber = lastNumber + 1;
  return `BT${nextNumber.toString().padStart(6, '0')}`;
};

/**
 * Генерация надежного пароля
 */
const generatePassword = (): string => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

/**
 * Одобрить заявку (админ)
 */
export const approveApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.userId;

    const application = await prisma.travelAgentApplication.findUnique({
      where: { id: parseInt(id) }
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

    // Проверка существующего турагента
    const existingAgent = await prisma.travelAgent.findUnique({
      where: { email: application.email }
    });

    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Турагент с таким email уже существует'
      });
    }

    // Генерация учетных данных
    const agentId = await generateAgentId();
    const tempPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Создание турагента
    const agent = await prisma.travelAgent.create({
      data: {
        applicationId: application.id,
        agentId,
        fullName: application.fullName,
        citizenship: application.citizenship,
        address: application.address,
        phone: application.phone,
        email: application.email,
        password: hashedPassword,
        documents: application.documents,
        mustChangePassword: true
      }
    });

    // Обновление заявки
    await prisma.travelAgentApplication.update({
      where: { id: parseInt(id) },
      data: {
        status: 'approved',
        processedAt: new Date(),
        processedBy: adminId
      }
    });

    // Отправка email с учетными данными
    try {
      const loginUrl = `${process.env.BASE_URL || 'https://bunyod-tour.ru'}/agent-login.html`;
      
      await sendEmail({
        to: application.email,
        subject: 'Ваша заявка на партнерство одобрена - Bunyod-Tour',
        html: `
          <h2>Добро пожаловать в партнерскую программу Bunyod-Tour!</h2>
          <p>Уважаемый(ая) ${application.fullName},</p>
          <p>Ваша заявка на партнерство была одобрена. Ниже ваши учетные данные для входа:</p>
          <ul>
            <li><strong>ID Турагента:</strong> ${agentId}</li>
            <li><strong>Email (логин):</strong> ${application.email}</li>
            <li><strong>Временный пароль:</strong> ${tempPassword}</li>
          </ul>
          <p><strong>Важно:</strong> При первом входе вам необходимо будет сменить пароль.</p>
          <p><a href="${loginUrl}">Войти в личный кабинет</a></p>
          <br>
          <p>С уважением,<br>Команда Bunyod-Tour</p>
        `
      });
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Продолжаем выполнение даже если email не отправился
    }

    return res.json({
      success: true,
      message: 'Заявка одобрена, турагент создан',
      data: {
        agentId: agent.agentId,
        email: agent.email
      }
    });
  } catch (error) {
    console.error('Error approving application:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при одобрении заявки'
    });
  }
};

/**
 * Отклонить заявку (админ)
 */
export const rejectApplication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;

    const application = await prisma.travelAgentApplication.findUnique({
      where: { id: parseInt(id) }
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

    await prisma.travelAgentApplication.update({
      where: { id: parseInt(id) },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        processedAt: new Date(),
        processedBy: adminId
      }
    });

    return res.json({
      success: true,
      message: 'Заявка отклонена'
    });
  } catch (error) {
    console.error('Error rejecting application:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при отклонении заявки'
    });
  }
};

/**
 * Получить всех турагентов (админ)
 */
export const getAllAgents = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const agents = await prisma.travelAgent.findMany({
      where,
      include: {
        bookings: {
          select: {
            id: true,
            bookingNumber: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const agentsWithStats = agents.map(agent => ({
      ...agent,
      documents: agent.documents ? JSON.parse(agent.documents) : [],
      totalBookings: agent.bookings.length,
      password: undefined // Не отправляем пароль
    }));

    return res.json({
      success: true,
      data: agentsWithStats
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка турагентов'
    });
  }
};

/**
 * Получить турагента по ID (админ)
 */
export const getAgentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const agent = await prisma.travelAgent.findUnique({
      where: { id: parseInt(id) },
      include: {
        application: true,
        bookings: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Турагент не найден'
      });
    }

    return res.json({
      success: true,
      data: {
        ...agent,
        documents: agent.documents ? JSON.parse(agent.documents) : [],
        password: undefined
      }
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении данных турагента'
    });
  }
};

/**
 * Обновить статус турагента (админ)
 */
export const updateAgentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный статус'
      });
    }

    const agent = await prisma.travelAgent.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    return res.json({
      success: true,
      message: 'Статус обновлен',
      data: {
        id: agent.id,
        agentId: agent.agentId,
        status: agent.status
      }
    });
  } catch (error) {
    console.error('Error updating agent status:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении статуса'
    });
  }
};

/**
 * Авторизация турагента
 */
export const agentLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Введите email и пароль'
      });
    }

    const agent = await prisma.travelAgent.findUnique({
      where: { email }
    });

    if (!agent) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }

    if (agent.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Ваш аккаунт заблокирован'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, agent.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }

    // Генерация JWT
    const token = jwt.sign(
      {
        agentId: agent.id,
        email: agent.email,
        role: 'agent'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Обновление времени последнего входа
    await prisma.travelAgent.update({
      where: { id: agent.id },
      data: { lastLoginAt: new Date() }
    });

    return res.json({
      success: true,
      message: 'Вход выполнен успешно',
      data: {
        token,
        agent: {
          id: agent.id,
          agentId: agent.agentId,
          fullName: agent.fullName,
          email: agent.email,
          mustChangePassword: agent.mustChangePassword
        }
      }
    });
  } catch (error) {
    console.error('Error during agent login:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при входе'
    });
  }
};

/**
 * Получить профиль текущего турагента
 */
export const getAgentProfile = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agent?.agentId;

    const agent = await prisma.travelAgent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        agentId: true,
        fullName: true,
        citizenship: true,
        address: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        mustChangePassword: true
      }
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Турагент не найден'
      });
    }

    return res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('Error fetching agent profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении профиля'
    });
  }
};

/**
 * Сменить пароль
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).agent?.agentId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Введите текущий и новый пароль'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Новый пароль должен содержать минимум 8 символов'
      });
    }

    const agent = await prisma.travelAgent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Турагент не найден'
      });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, agent.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Неверный текущий пароль'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.travelAgent.update({
      where: { id: agentId },
      data: {
        password: hashedPassword,
        mustChangePassword: false
      }
    });

    return res.json({
      success: true,
      message: 'Пароль успешно изменен'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при смене пароля'
    });
  }
};
