import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';

const prisma = new PrismaClient();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/tour-agents/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'agent-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения!'));
    }
  }
});

// Получить всех турагентов
export const getAllTourAgents = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔍 Получение списка всех турагентов...');

    const tourAgents = await prisma.tourAgent.findMany({
      include: {
        country: true,
        city: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Найдено ${tourAgents.length} турагентов`);

    res.json({
      success: true,
      data: tourAgents,
      count: tourAgents.length
    });
  } catch (error) {
    console.error('❌ Ошибка при получении турагентов:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении турагентов',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Получить активных турагентов (для публичного API)
export const getActiveTourAgents = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔍 Получение списка активных турагентов...');

    const tourAgents = await prisma.tourAgent.findMany({
      where: {
        isActive: true
      },
      include: {
        country: true,
        city: true,
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`✅ Найдено ${tourAgents.length} активных турагентов`);

    res.json({
      success: true,
      data: tourAgents,
      count: tourAgents.length
    });
  } catch (error) {
    console.error('❌ Ошибка при получении активных турагентов:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении турагентов',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Получить турагента по ID
export const getTourAgentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log(`🔍 Получение турагента с ID: ${id}`);

    const tourAgent = await prisma.tourAgent.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        country: true,
        city: true,
      }
    });

    if (!tourAgent) {
      res.status(404).json({
        success: false,
        message: 'Турагент не найден'
      });
      return;
    }

    console.log(`✅ Турагент найден: ${tourAgent.name}`);

    res.json({
      success: true,
      data: tourAgent
    });
  } catch (error) {
    console.error('❌ Ошибка при получении турагента:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении турагента',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Получить активного турагента по ID (публичный доступ)
export const getActiveTourAgentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log(`🔍 Получение активного турагента с ID: ${id}`);

    const tourAgent = await prisma.tourAgent.findFirst({
      where: {
        id: parseInt(id),
        isActive: true // Только активные турагенты для публичного доступа
      },
      include: {
        country: true,
        city: true,
      }
    });

    if (!tourAgent) {
      res.status(404).json({
        success: false,
        message: 'Турагент не найден или неактивен'
      });
      return;
    }

    console.log(`✅ Активный турагент найден: ${tourAgent.name}`);

    res.json({
      success: true,
      data: tourAgent
    });
  } catch (error) {
    console.error('❌ Ошибка при получении активного турагента:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении турагента',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Создать нового турагента
export const createTourAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      organization,
      website,
      stateRegistration,
      description,
      contactName,
      contactPhone,
      contactEmail,
      address,
      countryId,
      cityId,
      isActive
    } = req.body;

    console.log('📝 Создание нового турагента:', { name, organization });

    // Обработка загруженного фото
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let photoPath = null;
    if (files && files.photo && files.photo[0]) {
      photoPath = files.photo[0].path.replace(/\\/g, '/');
      console.log('📷 Фото загружено:', photoPath);
    }

    const tourAgentData: any = {
      name: name || 'Без названия',
      organization,
      website: website || null,
      stateRegistration: stateRegistration || null,
      description: description || null,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
      address: address || null,
      photo: photoPath,
      countryId: countryId ? parseInt(countryId) : null,
      cityId: cityId ? parseInt(cityId) : null,
      isActive: isActive !== undefined ? isActive === 'true' : true
    };

    const newTourAgent = await prisma.tourAgent.create({
      data: tourAgentData,
      include: {
        country: true,
        city: true,
      }
    });

    console.log('✅ Турагент успешно создан:', newTourAgent.id);

    res.status(201).json({
      success: true,
      message: 'Турагент успешно создан',
      data: newTourAgent
    });
  } catch (error) {
    console.error('❌ Ошибка при создании турагента:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании турагента',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Обновить турагента
export const updateTourAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      organization,
      website,
      stateRegistration,
      description,
      contactName,
      contactPhone,
      contactEmail,
      address,
      countryId,
      cityId,
      isActive
    } = req.body;

    console.log(`📝 Обновление турагента ID: ${id}`);

    // Проверяем существование турагента
    const existingTourAgent = await prisma.tourAgent.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingTourAgent) {
      res.status(404).json({
        success: false,
        message: 'Турагент не найден'
      });
      return;
    }

    // Обработка загруженного фото
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let photoPath = existingTourAgent.photo; // Сохраняем старое фото по умолчанию
    if (files && files.photo && files.photo[0]) {
      photoPath = files.photo[0].path.replace(/\\/g, '/');
      console.log('📷 Новое фото загружено:', photoPath);
    }

    const updateData: any = {
      name: name || existingTourAgent.name,
      organization: organization || existingTourAgent.organization,
      website: website || existingTourAgent.website,
      stateRegistration: stateRegistration || existingTourAgent.stateRegistration,
      description: description || existingTourAgent.description,
      contactName: contactName || existingTourAgent.contactName,
      contactPhone: contactPhone || existingTourAgent.contactPhone,
      contactEmail: contactEmail || existingTourAgent.contactEmail,
      address: address || existingTourAgent.address,
      photo: photoPath,
      countryId: countryId ? parseInt(countryId) : existingTourAgent.countryId,
      cityId: cityId ? parseInt(cityId) : existingTourAgent.cityId,
      isActive: isActive !== undefined ? isActive === 'true' : existingTourAgent.isActive
    };

    const updatedTourAgent = await prisma.tourAgent.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        country: true,
        city: true,
      }
    });

    console.log('✅ Турагент успешно обновлён:', updatedTourAgent.id);

    res.json({
      success: true,
      message: 'Турагент успешно обновлён',
      data: updatedTourAgent
    });
  } catch (error) {
    console.error('❌ Ошибка при обновлении турагента:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении турагента',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Удалить турагента
export const deleteTourAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Удаление турагента ID: ${id}`);

    // Проверяем существование турагента
    const existingTourAgent = await prisma.tourAgent.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingTourAgent) {
      res.status(404).json({
        success: false,
        message: 'Турагент не найден'
      });
      return;
    }

    await prisma.tourAgent.delete({
      where: { id: parseInt(id) }
    });

    console.log('✅ Турагент успешно удалён:', id);

    res.json({
      success: true,
      message: 'Турагент успешно удалён'
    });
  } catch (error) {
    console.error('❌ Ошибка при удалении турагента:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении турагента',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Переключить статус активности турагента
export const toggleTourAgentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log(`🔄 Переключение статуса турагента ID: ${id}`);

    // Получаем текущий статус
    const currentTourAgent = await prisma.tourAgent.findUnique({
      where: { id: parseInt(id) }
    });

    if (!currentTourAgent) {
      res.status(404).json({
        success: false,
        message: 'Турагент не найден'
      });
      return;
    }

    // Переключаем статус
    const updatedTourAgent = await prisma.tourAgent.update({
      where: { id: parseInt(id) },
      data: { isActive: !currentTourAgent.isActive }
    });

    console.log(`✅ Статус турагента изменён на: ${updatedTourAgent.isActive ? 'активен' : 'неактивен'}`);

    res.json({
      success: true,
      message: `Турагент ${updatedTourAgent.isActive ? 'активирован' : 'деактивирован'}`,
      data: updatedTourAgent
    });
  } catch (error) {
    console.error('❌ Ошибка при изменении статуса турагента:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при изменении статуса турагента',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Экспорт multer middleware для использования в routes
export const uploadTourAgentPhoto = upload.fields([{ name: 'photo', maxCount: 1 }]);