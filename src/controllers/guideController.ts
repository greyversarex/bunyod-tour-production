import { Request, Response } from 'express';
import prisma from '../config/database';
import { GuideData } from '../types/booking';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { 
  getLanguageFromRequest, 
  createLocalizedResponse, 
  parseMultilingualField,
  safeJsonParse
} from '../utils/multilingual';

async function isAdminRequest(req: Request): Promise<boolean> {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return false;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    if (!decoded.adminId) return false;
    const admin = await prisma.admin.findUnique({ where: { id: decoded.adminId } });
    return !!(admin && admin.isActive);
  } catch {
    return false;
  }
}
import { emailService } from '../services/emailService';

// ✅ Унифицированная функция нормализации путей к фото
const normalizePhotoPath = (photoPath: string | null): string | null => {
  if (!photoPath) return null;
  
  // Убираем абсолютные пути файловой системы для безопасности
  let normalizedPath = photoPath;
  
  // Удаляем абсолютные префиксы workspace
  if (normalizedPath.includes('/home/runner/workspace/')) {
    normalizedPath = normalizedPath.replace('/home/runner/workspace/', '/');
  }
  
  // Удаляем любой возможный абсолютный путь к проекту
  if (normalizedPath.includes(process.cwd())) {
    normalizedPath = normalizedPath.replace(process.cwd(), '');
  }
  
  // Убеждаемся что путь начинается с /
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
};

export const createGuide = async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      description, 
      photo, 
      languages, 
      contact,
      email, // 📧 Поле email из формы
      experience, 
      rating, 
      isActive,
      login,
      password,
      countryId,
      cityId,
      passportSeries,
      registration,
      residenceAddress,
      pricePerDay,
      currency,
      isHireable
    } = req.body;
    
    // 🔍 DEBUG: Логируем входящие данные для отладки email
    console.log('🔍 DEBUG createGuide - email поле:', email);
    console.log('🔍 DEBUG createGuide - contact поле:', contact);
    console.log('🔍 DEBUG createGuide - login:', login);
    
    // Convert numeric fields
    const experienceNumber = experience ? parseInt(experience) : null;
    const ratingNumber = rating ? parseFloat(rating) : null;
    
    // ✅ Безопасная обработка pricePerDay с валидацией
    let pricePerDayNumber: number | null = null;
    if (pricePerDay) {
      const parsed = parseFloat(pricePerDay);
      if (!isNaN(parsed) && parsed > 0) {
        pricePerDayNumber = parsed;
      }
    }
    
    // 🔒 Хешируем пароль для безопасности
    let hashedPassword = null;
    if (password) {
      const saltRounds = 10;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }
    
    // ✅ Безопасная обработка isActive с правильным значением по умолчанию
    const active = isActive === undefined ? true : (typeof isActive === 'boolean' ? isActive : String(isActive).toLowerCase() === 'true');
    
    // ✅ Валидация currency
    const validCurrencies = ['TJS', 'USD', 'EUR', 'RUB', 'CNY'];
    const validatedCurrency = currency && validCurrencies.includes(currency) ? currency : 'TJS';
    
    // ✅ Безопасная обработка isHireable с логической связкой к цене
    let hireable = isHireable === undefined ? true : (typeof isHireable === 'boolean' ? isHireable : String(isHireable).toLowerCase() === 'true');
    
    // ✅ Если нет цены или цена <= 0, то гид не может быть доступен для найма
    if (!pricePerDayNumber || pricePerDayNumber <= 0) {
      hireable = false;
    }
    
    // Проверка уникальности логина если он задан
    if (login) {
      const existingGuide = await prisma.guide.findFirst({ where: { login } });
      if (existingGuide) {
        res.status(400).json({
          success: false,
          message: 'Логин уже используется другим гидом'
        });
        return;
      }
    }
    
    // Parse multilingual fields properly
    const parsedName = safeJsonParse(name);
    const parsedDescription = safeJsonParse(description);
    
    const guide = await prisma.guide.create({
      data: {
        name: parsedName,
        description: parsedDescription,
        photo,
        languages: typeof languages === 'string' ? languages : JSON.stringify(languages),
        contact: contact ? (typeof contact === 'string' ? contact : JSON.stringify(contact)) : null,
        experience: experienceNumber,
        rating: ratingNumber,
        isActive: active,
        login: login || null,
        password: hashedPassword,
        countryId: countryId ? parseInt(String(countryId)) : null,
        cityId: cityId ? parseInt(String(cityId)) : null,
        passportSeries: passportSeries || null,
        registration: registration || null,
        residenceAddress: residenceAddress || null,
        pricePerDay: pricePerDayNumber,
        currency: validatedCurrency,
        isHireable: hireable
      },
      include: {
        guideCountry: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          },
        },
        guideCity: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          },
        },
      },
    });

    // ✅ Нормализация пути к фото
    const photoPath = normalizePhotoPath(guide.photo);

    // ✅ Обработка связанной страны с безопасным парсингом
    const processedGuideCountry = guide.guideCountry ? {
      id: guide.guideCountry.id,
      name: safeJsonParse(guide.guideCountry.name),
      nameRu: guide.guideCountry.nameRu,
      nameEn: guide.guideCountry.nameEn,
    } : null;

    // ✅ Обработка связанного города с безопасным парсингом  
    const processedGuideCity = guide.guideCity ? {
      id: guide.guideCity.id,
      name: safeJsonParse(guide.guideCity.name),
      nameRu: guide.guideCity.nameRu,
      nameEn: guide.guideCity.nameEn,
    } : null;

    // 🔒 БЕЗОПАСНОСТЬ: Возвращаем только публичные поля, исключаем PII
    const safeGuide = {
      id: guide.id,
      name: safeJsonParse(guide.name),
      description: safeJsonParse(guide.description),
      photo: photoPath,
      languages: safeJsonParse(guide.languages),
      experience: guide.experience,
      rating: guide.rating,
      pricePerDay: guide.pricePerDay,
      currency: guide.currency,
      isHireable: guide.isHireable,
      isActive: guide.isActive,
      createdAt: guide.createdAt,
      updatedAt: guide.updatedAt,
      guideCountry: processedGuideCountry,
      guideCity: processedGuideCity,
      hasPassword: !!guide.password && guide.password.trim() !== '', // ✅ Показываем наличие пароля
    };

    // 📧 Отправить email уведомление гиду (если указан email)
    try {
      const guideName = typeof guide.name === 'string' ? JSON.parse(guide.name) : guide.name;
      const guideNameRu = guideName?.ru || guideName?.en || 'Неизвестный гид';
      
      // 📧 Получить email гида напрямую из поля email или из contact
      let guideEmail = null;
      
      // Сначала проверяем отдельное поле email
      if (email && typeof email === 'string' && email.includes('@') && !email.includes('noemail')) {
        guideEmail = email;
      }
      // Если нет, пробуем получить из contact
      else if (contact) {
        try {
          const contactData = typeof contact === 'string' ? JSON.parse(contact) : contact;
          guideEmail = contactData?.email || null;
        } catch {
          if (typeof contact === 'string' && contact.includes('@')) {
            guideEmail = contact;
          }
        }
      }

      console.log(`📧 Попытка отправки email гиду: ${guideEmail || 'email не указан'}`);

      // Отправить email гиду
      if (guideEmail && guideEmail.includes('@') && !guideEmail.includes('noemail')) {
        const loginCredentials = login && password ? `
          <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #4caf50; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2e7d32;">🔑 Ваши данные для входа:</h3>
            <p><strong>Логин:</strong> ${login}</p>
            <p><strong>Временный пароль:</strong> ${password}</p>
            <p style="font-size: 13px; color: #666; margin-top: 10px;">⚠️ Рекомендуем сменить пароль после первого входа</p>
          </div>
        ` : '';

        await emailService.sendEmail({
          to: guideEmail,
          subject: `🎉 Добро пожаловать в Bunyod-Tour, ${guideNameRu}!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                <h1>🌟 Добро пожаловать в команду Bunyod-Tour!</h1>
              </div>
              
              <div style="padding: 30px; background: #f8f9fa;">
                <p style="font-size: 16px;">Здравствуйте, <strong>${guideNameRu}</strong>!</p>
                <p>Вы успешно добавлены в нашу платформу в качестве гида.</p>

                ${loginCredentials}

                <a href="https://bunyodtour.tj/guide-login.html" 
                   style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
                  🔐 Войти в личный кабинет
                </a>

                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  Если у вас есть вопросы, свяжитесь с нами:<br>
                  📧 Email: booking@bunyodtour.tj<br>
                  📞 Телефоны: +992 44 625 7575; +992 93-126-1134<br>
                  📞 +992 00-110-0087; +992 88-235-3434<br>
                  🌐 Сайт: bunyodtour.tj
                </p>
              </div>
            </div>
          `
        });
        console.log(`✅ Email приветствие отправлено гиду: ${guideEmail}`);
      }

      // Отправить уведомление админу
      await emailService.sendEmail({
        to: process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj',
        subject: `🎉 Новый гид добавлен: ${guideNameRu}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
              <h1>✨ Новый гид добавлен!</h1>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #1f2937;">Информация о гиде:</h2>
              
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Имя:</strong> ${guideNameRu}</p>
                <p><strong>ID:</strong> ${guide.id}</p>
                <p><strong>Email:</strong> ${guideEmail || 'Не указан'}</p>
                <p><strong>Опыт:</strong> ${guide.experience || 'Не указан'} лет</p>
                <p><strong>Цена за день:</strong> ${guide.pricePerDay || 'Не указана'} ${guide.currency || 'TJS'}</p>
                <p><strong>Доступен для найма:</strong> ${guide.isHireable ? 'Да' : 'Нет'}</p>
                <p><strong>Активен:</strong> ${guide.isActive ? 'Да' : 'Нет'}</p>
              </div>

              <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}/admin-dashboard.html" 
                 style="display: inline-block; background: #3E3E3E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
                Перейти в админ панель
              </a>
            </div>
          </div>
        `
      });
      console.log(`📧 Email уведомление о новом гиде отправлено админу`);
    } catch (emailError) {
      console.error('⚠️ Не удалось отправить email о новом гиде (некритично):', emailError);
    }
    
    return res.status(201).json({
      success: true,
      message: 'Guide created successfully',
      data: safeGuide,
    });
  } catch (error) {
    console.error('Error creating guide:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create guide',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get all guides with multilingual support
// GET /api/guides?lang=en/ru&includeRaw=true
export const getAllGuides = async (req: Request, res: Response) => {
  try {
    const language = getLanguageFromRequest(req);
    const requestRaw = req.query.includeRaw === 'true';
    const isAdmin = requestRaw ? await isAdminRequest(req) : false;
    const includeRaw = requestRaw && isAdmin;
    
    const guides = await prisma.guide.findMany({
      where: isAdmin ? {} : { isActive: true },
      include: {
        tourGuides: {
          include: {
            tour: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        guideCountry: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          },
        },
        guideCity: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          },
        },
      },
    });

    // Localize guides data with safe JSON parsing
    const localizedGuides = guides.map((guide: any) => {
      try {
        // ✅ Нормализация пути к фото
        const photoPath = normalizePhotoPath(guide.photo);

        // Process country and city for multilingual support - include both languages
        const processedGuideCountry = guide.guideCountry ? {
          id: guide.guideCountry.id,
          name: guide.guideCountry.name,
          nameRu: guide.guideCountry.nameRu,
          nameEn: guide.guideCountry.nameEn,
        } : null;

        const processedGuideCity = guide.guideCity ? {
          id: guide.guideCity.id,
          name: guide.guideCity.name,
          nameRu: guide.guideCity.nameRu,
          nameEn: guide.guideCity.nameEn,
        } : null;

        if (includeRaw) {
          // ДЛЯ АДМИНКИ: возвращаем ТОЛЬКО БЕЗОПАСНЫЕ поля + raw JSON + локализованные поля
          return {
            id: guide.id,
            photo: photoPath,
            languages: guide.languages,
            experience: guide.experience,
            rating: guide.rating,
            pricePerDay: guide.pricePerDay,
            currency: guide.currency,
            isHireable: guide.isHireable,
            isActive: guide.isActive,
            createdAt: guide.createdAt,
            updatedAt: guide.updatedAt,
            countryId: guide.countryId,
            cityId: guide.cityId,
            contact: guide.contact,
            _localized: {
              name: parseMultilingualField(guide.name, language),
              description: parseMultilingualField(guide.description, language),
            },
            // Добавляем raw JSON для админки
            _raw: {
              name: safeJsonParse(guide.name),
              description: safeJsonParse(guide.description),
            },
            guideCountry: processedGuideCountry,
            guideCity: processedGuideCity,
            hasPassword: !!guide.password && guide.password.trim() !== '',
            // 🔐 АДМИН ПОЛЯ: для includeRaw=true возвращаем безопасные админ данные
            login: guide.login,
            passportSeries: guide.passportSeries,
            registration: guide.registration,
            residenceAddress: guide.residenceAddress,
          };
        } else {
          // ДЛЯ ПУБЛИЧНОГО ИСПОЛЬЗОВАНИЯ: включаем оба языка для фронтенда
          const parsedName = safeJsonParse(guide.name);
          const parsedDescription = safeJsonParse(guide.description);
          
          return {
            id: guide.id,
            name: parseMultilingualField(guide.name, language), // Текущий язык для обратной совместимости
            nameRu: typeof parsedName === 'object' ? parsedName.ru : parsedName,
            nameEn: typeof parsedName === 'object' ? parsedName.en : parsedName,
            description: parseMultilingualField(guide.description, language),
            descriptionRu: typeof parsedDescription === 'object' ? parsedDescription.ru : parsedDescription,
            descriptionEn: typeof parsedDescription === 'object' ? parsedDescription.en : parsedDescription,
            photo: photoPath,
            languages: guide.languages,
            experience: guide.experience,
            rating: guide.rating,
            pricePerDay: guide.pricePerDay,
            currency: guide.currency,
            isHireable: guide.isHireable,
            isActive: guide.isActive,
            createdAt: guide.createdAt,
            updatedAt: guide.updatedAt,
            tourGuides: guide.tourGuides.map((tg: any) => ({
              ...tg,
              tour: tg.tour ? {
                ...tg.tour,
                title: parseMultilingualField(tg.tour.title, language)
              } : null
            })),
            guideCountry: processedGuideCountry,
            guideCity: processedGuideCity,
            hasPassword: !!guide.password && guide.password.trim() !== '',
          };
        }
      } catch (jsonError) {
        console.error('Error parsing guide JSON fields:', jsonError, 'Guide ID:', guide.id);
        return {
          id: guide.id,
          name: guide.name || '',
          description: guide.description || '',
          photo: normalizePhotoPath(guide.photo),
          languages: guide.languages,
          experience: guide.experience,
          rating: guide.rating,
          currency: guide.currency,
          isHireable: guide.isHireable,
          isActive: guide.isActive,
          createdAt: guide.createdAt,
          updatedAt: guide.updatedAt,
          tourGuides: guide.tourGuides || [],
          guideCountry: guide.guideCountry,
          guideCity: guide.guideCity,
          hasPassword: !!guide.password && guide.password.trim() !== '',
          // 🔒 ИСКЛЮЧЕНЫ: password, login, passportSeries, registration, residenceAddress
        };
      }
    });

    const response = createLocalizedResponse(
      localizedGuides,
      [], // Поля уже обработаны выше
      language,
      'Guides retrieved successfully'
    );

    return res.json(response);
  } catch (error) {
    console.error('Error fetching guides:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch guides',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getGuideById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const requestRaw = req.query.includeRaw === 'true';
    const includeRaw = requestRaw ? await isAdminRequest(req) : false;
    
    const guide = await prisma.guide.findUnique({
      where: { id: parseInt(id) },
      include: {
        tourGuides: {
          include: {
            tour: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        guideCountry: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          },
        },
        guideCity: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          },
        },
      },
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Guide not found',
      });
    }

    // 🔒 БЕЗОПАСНОСТЬ: Неактивных гидов могут видеть только админы
    if (!includeRaw && !guide.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Guide not found',
      });
    }

    // ✅ Нормализация пути к фото
    const photoPath = normalizePhotoPath(guide.photo);

    // ✅ Обработка связанной страны с безопасным парсингом
    const processedGuideCountry = guide.guideCountry ? {
      id: guide.guideCountry.id,
      name: safeJsonParse(guide.guideCountry.name),
      nameRu: guide.guideCountry.nameRu,
      nameEn: guide.guideCountry.nameEn,
    } : null;

    // ✅ Обработка связанного города с безопасным парсингом  
    const processedGuideCity = guide.guideCity ? {
      id: guide.guideCity.id,
      name: safeJsonParse(guide.guideCity.name),
      nameRu: guide.guideCity.nameRu,
      nameEn: guide.guideCity.nameEn,
    } : null;

    // 🔒 БЕЗОПАСНОСТЬ: Публичные поля (без PII — contact только в админ режиме)
    const baseGuide = {
      id: guide.id,
      name: safeJsonParse(guide.name),
      description: safeJsonParse(guide.description),
      photo: photoPath,
      languages: safeJsonParse(guide.languages),
      experience: guide.experience,
      rating: guide.rating,
      pricePerDay: guide.pricePerDay, // 💰 Цена за день
      currency: guide.currency,
      isHireable: guide.isHireable,
      isActive: guide.isActive,
      createdAt: guide.createdAt,
      updatedAt: guide.updatedAt,
      tourGuides: guide.tourGuides,
      guideCountry: processedGuideCountry,
      guideCity: processedGuideCity,
      hasPassword: !!guide.password && guide.password.trim() !== '', // ✅ Показываем наличие пароля
      registration: guide.registration, // 📜 Номер сертификата для публичного профиля
    };

    // 🔐 АДМИН РЕЖИМ: при includeRaw=true добавляем sensitive data
    const formattedGuide = includeRaw ? {
      ...baseGuide,
      login: guide.login,
      // 🔒 БЕЗОПАСНОСТЬ: Никогда не возвращаем пароль, даже хешированный
      passportSeries: guide.passportSeries,
      registration: guide.registration,
      residenceAddress: guide.residenceAddress,
      contact: guide.contact, // ✅ Добавляем contact для админ режима
    } : baseGuide;

    return res.json({
      success: true,
      data: formattedGuide,
    });
  } catch (error) {
    console.error('Error fetching guide:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch guide',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getGuidesByTour = async (req: Request, res: Response) => {
  try {
    const { tourId } = req.params;

    const tourGuides = await prisma.tourGuide.findMany({
      where: {
        tourId: parseInt(tourId),
        guide: {
          isActive: true,
        },
      },
      include: {
        guide: {
          include: {
            guideCountry: {
              select: {
                id: true,
                name: true,
                nameRu: true,
                nameEn: true,
              },
            },
            guideCity: {
              select: {
                id: true,
                name: true,
                nameRu: true,
                nameEn: true,
              },
            },
          },
        },
      },
      orderBy: {
        isDefault: 'desc',
      },
    });

    // 🔒 БЕЗОПАСНОСТЬ: Возвращаем только публичные поля, исключаем PII
    const formattedGuides = tourGuides.map((tg: any) => {
      // ✅ Нормализация пути к фото
      const photoPath = normalizePhotoPath(tg.guide.photo);

      // ✅ Обработка связанной страны с безопасным парсингом
      const processedGuideCountry = tg.guide.guideCountry ? {
        id: tg.guide.guideCountry.id,
        name: safeJsonParse(tg.guide.guideCountry.name),
        nameRu: tg.guide.guideCountry.nameRu,
        nameEn: tg.guide.guideCountry.nameEn,
      } : null;

      // ✅ Обработка связанного города с безопасным парсингом  
      const processedGuideCity = tg.guide.guideCity ? {
        id: tg.guide.guideCity.id,
        name: safeJsonParse(tg.guide.guideCity.name),
        nameRu: tg.guide.guideCity.nameRu,
        nameEn: tg.guide.guideCity.nameEn,
      } : null;

      return {
        id: tg.guide.id,
        name: safeJsonParse(tg.guide.name),
        description: safeJsonParse(tg.guide.description),
        photo: photoPath,
        languages: safeJsonParse(tg.guide.languages),
        experience: tg.guide.experience,
        rating: tg.guide.rating,
        currency: tg.guide.currency,
        isHireable: tg.guide.isHireable,
        isActive: tg.guide.isActive,
        createdAt: tg.guide.createdAt,
        updatedAt: tg.guide.updatedAt,
        guideCountry: processedGuideCountry,
        guideCity: processedGuideCity,
        isDefault: tg.isDefault,
        hasPassword: !!tg.guide.password && tg.guide.password.trim() !== '', // ✅ Показываем наличие пароля
      };
    });

    return res.json({
      success: true,
      data: formattedGuides,
    });
  } catch (error) {
    console.error('Error fetching guides for tour:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch guides for tour',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const updateGuide = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    // Получаем данные из FormData (все приходят как строки)
    const {
      name,
      description,
      login,
      password,
      email,
      phone,
      languages,
      experience,
      isActive,
      countryId,
      cityId,
      passportSeries,
      registration,
      residenceAddress,
      pricePerDay,
      currency,
      isHireable
    } = req.body;

    console.log('📝 Обновление гида #' + id);
    console.log('📥 Полученные данные:', req.body);
    console.log('📁 Полученные файлы:', files);

    const updateData: any = {};
    
    // Обрабатываем JSON поля
    if (name) {
      updateData.name = safeJsonParse(name);
    }
    if (description) {
      updateData.description = safeJsonParse(description);
    }
    
    // Обрабатываем массив языков
    if (languages) {
      updateData.languages = typeof languages === 'string' ? languages : JSON.stringify(languages);
    }
    
    // Обрабатываем контактную информацию
    if (email || phone) {
      const currentGuide = await prisma.guide.findUnique({ where: { id: parseInt(id) } });
      const currentContact = currentGuide?.contact ? JSON.parse(currentGuide.contact) : {};
      updateData.contact = JSON.stringify({
        email: email || currentContact.email || '',
        phone: phone || currentContact.phone || ''
      });
    }
    
    // Числовые поля
    if (experience !== undefined) updateData.experience = parseInt(experience) || 0;
    
    // Связи с Country и City (используем Prisma connect синтаксис)
    if (countryId) {
      updateData.guideCountry = {
        connect: { id: parseInt(countryId) }
      };
    }
    if (cityId) {
      updateData.guideCity = {
        connect: { id: parseInt(cityId) }
      };
    }
    
    // Текстовые поля
    if (passportSeries !== undefined) updateData.passportSeries = passportSeries;
    if (registration !== undefined) updateData.registration = registration;
    if (residenceAddress !== undefined) updateData.residenceAddress = residenceAddress;
    
    // 💰 Поля ценообразования
    if (pricePerDay !== undefined && pricePerDay !== null && pricePerDay !== '') {
      updateData.pricePerDay = parseFloat(pricePerDay);
    }
    if (currency) updateData.currency = currency;
    if (isHireable !== undefined) {
      updateData.isHireable = isHireable === 'true' || isHireable === true;
    }
    
    // 🔒 Обработка полей авторизации
    if (login !== undefined && login.trim()) {
      // Проверка уникальности логина
      const existingGuide = await prisma.guide.findFirst({ 
        where: { login: login.trim(), id: { not: parseInt(id) } } 
      });
      if (existingGuide) {
        res.status(400).json({
          success: false,
          message: 'Логин уже используется другим гидом'
        });
        return;
      }
      updateData.login = login.trim();
    }
    
    // Статусы
    if (isActive !== undefined) {
      updateData.isActive = isActive === 'true' || isActive === true;
    }
    
    // 🔒 Хешируем новый пароль если он передан
    if (password && password.trim()) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password.trim(), saltRounds);
    }

    // 📁 Обрабатываем загруженный аватар
    if (files && files.avatar && files.avatar[0]) {
      const fullPath = files.avatar[0].path;
      updateData.photo = fullPath.replace('/home/runner/workspace', '');
      console.log('📷 Аватар обновлен:', updateData.photo);
    }

    // 📄 Обрабатываем загруженные документы (добавляем к существующим)
    if (files && files.documents && files.documents.length > 0) {
      const currentGuide = await prisma.guide.findUnique({ where: { id: parseInt(id) } });
      const existingDocuments = currentGuide?.documents ? JSON.parse(currentGuide.documents) : [];
      
      const newDocuments = files.documents.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path.replace('/home/runner/workspace', ''),
        size: file.size,
        uploadedAt: new Date().toISOString()
      }));
      
      updateData.documents = JSON.stringify([...existingDocuments, ...newDocuments]);
      console.log('📄 Добавлено документов:', newDocuments.length);
    }

    console.log('💾 Данные для обновления:', updateData);

    const guide = await prisma.guide.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    const formattedGuide = {
      ...guide,
      name: safeJsonParse(guide.name),
      description: safeJsonParse(guide.description),
      languages: safeJsonParse(guide.languages),
      contact: safeJsonParse(guide.contact),
      password: undefined, // 🔒 БЕЗОПАСНОСТЬ: Исключаем пароль из ответа
    };

    return res.json({
      success: true,
      message: 'Guide updated successfully',
      data: formattedGuide,
    });
  } catch (error) {
    console.error('Error updating guide:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update guide',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Удалить гида полностью или деактивировать (админ)
 * ?permanent=true - полное удаление гида, заявок на найм, отзывов, связей с турами
 * Без параметра - деактивация + удаление доступа к кабинету
 */
export const deleteGuide = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query; // ?permanent=true для полного удаления
    const guideId = parseInt(id);

    // Получаем гида со всеми связями для отчёта
    const guide = await prisma.guide.findUnique({
      where: { id: guideId },
      include: {
        guideHireRequests: true,
        guideReviews: true,
        tourGuides: true,
        orders: true
      }
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Гид не найден'
      });
    }

    const guideName = typeof guide.name === 'string' 
      ? safeJsonParse(guide.name)?.ru || guide.name 
      : (guide.name as any)?.ru || 'Неизвестный';

    if (permanent === 'true') {
      console.log(`🗑️ Начало полного удаления гида: ${guideName} (ID: ${guideId})`);
      console.log(`   - Логин кабинета: ${guide.login || 'нет'}`);
      console.log(`   - Заявок на найм: ${guide.guideHireRequests?.length || 0}`);
      console.log(`   - Отзывов: ${guide.guideReviews?.length || 0}`);
      console.log(`   - Связей с турами: ${guide.tourGuides?.length || 0}`);
      console.log(`   - Заказов: ${guide.orders?.length || 0}`);

      // Используем транзакцию для атомарного удаления
      await prisma.$transaction(async (tx) => {
        // 1. Удаляем связи с турами
        if (guide.tourGuides && guide.tourGuides.length > 0) {
          await tx.tourGuide.deleteMany({ where: { guideId } });
          console.log(`   ✅ Удалено ${guide.tourGuides.length} связей с турами`);
        }

        // 2. Обнуляем guideId в заказах (чтобы не потерять историю заказов)
        if (guide.orders && guide.orders.length > 0) {
          await tx.order.updateMany({
            where: { guideId },
            data: { guideId: null }
          });
          console.log(`   ✅ Отвязано ${guide.orders.length} заказов`);
        }

        // 3. Удаляем гида (guideHireRequests и guideReviews удалятся каскадно)
        await tx.guide.delete({ where: { id: guideId } });
        console.log(`   ✅ Гид удалён (заявки и отзывы удалены каскадно)`);
      });

      console.log(`🗑️ Гид ${guideName} полностью удалён из системы`);
      
      return res.json({
        success: true,
        message: `Гид "${guideName}" и все связанные данные успешно удалены`,
        deletedData: {
          guideName,
          login: guide.login,
          hireRequestsCount: guide.guideHireRequests?.length || 0,
          reviewsCount: guide.guideReviews?.length || 0,
          tourLinksCount: guide.tourGuides?.length || 0
        }
      });
    } else {
      // Деактивация + сброс доступа к кабинету (удалить login/password)
      await prisma.guide.update({
        where: { id: guideId },
        data: { 
          isActive: false,
          login: null,      // Удалить логин - не может войти в кабинет
          password: null    // Удалить пароль - не может войти в кабинет
        },
      });

      console.log(`⛔ Гид ${guideName} (ID: ${guideId}) деактивирован, доступ к кабинету закрыт`);

      return res.json({
        success: true,
        message: `Гид "${guideName}" деактивирован, доступ к кабинету закрыт`,
        deactivated: {
          guideName,
          previousLogin: guide.login
        }
      });
    }
  } catch (error) {
    console.error('Error deleting guide:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка при удалении гида',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const linkGuideToTour = async (req: Request, res: Response) => {
  try {
    const { tourId, guideId, isDefault } = req.body;

    // If this is set as default, remove default from other guides for this tour
    if (isDefault) {
      await prisma.tourGuide.updateMany({
        where: { tourId },
        data: { isDefault: false },
      });
    }

    const tourGuide = await prisma.tourGuide.upsert({
      where: {
        tourId_guideId: {
          tourId,
          guideId,
        },
      },
      update: {
        isDefault,
      },
      create: {
        tourId,
        guideId,
        isDefault,
      },
    });

    return res.json({
      success: true,
      message: 'Guide linked to tour successfully',
      data: tourGuide,
    });
  } catch (error) {
    console.error('Error linking guide to tour:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to link guide to tour',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// 📧 Отправка учётных данных гиду на email (генерация нового пароля)
export const resendGuideCredentials = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const guideId = parseInt(id);

    if (isNaN(guideId)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный ID гида'
      });
    }

    // Получаем гида
    const guide = await prisma.guide.findUnique({
      where: { id: guideId }
    });

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Гид не найден'
      });
    }

    // Проверяем наличие email - contact хранится как JSON строка
    let guideEmail: string | null = null;
    if (guide.contact) {
      try {
        const contactData = typeof guide.contact === 'string' 
          ? JSON.parse(guide.contact) 
          : guide.contact;
        guideEmail = contactData?.email || null;
      } catch (e) {
        console.error('Failed to parse guide contact:', e);
      }
    }
    if (!guideEmail) {
      return res.status(400).json({
        success: false,
        message: 'У гида не указан email'
      });
    }

    // Проверяем наличие логина
    if (!guide.login) {
      return res.status(400).json({
        success: false,
        message: 'У гида не указан логин'
      });
    }

    // Генерируем криптографически безопасный временный пароль
    const crypto = require('crypto');
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const passwordBytes = crypto.randomBytes(12);
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += charset[passwordBytes[i] % charset.length];
    }
    
    // Хешируем пароль
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Обновляем пароль в БД
    await prisma.guide.update({
      where: { id: guideId },
      data: { password: hashedPassword }
    });

    // Получаем имя гида (name хранится как JSON-строка {"ru":"...","en":"..."})
    const _parsedGuideName = safeJsonParse(guide.name as string);
    const guideName = _parsedGuideName
      ? (_parsedGuideName.ru || _parsedGuideName.en || guide.login || 'Гид')
      : (guide.name as string || guide.login || 'Гид');

    // Отправляем email с учётными данными
    // Пароль уже обновлён в БД — email отправляем в try/catch, чтобы не блокировать ответ
    let emailSent = false;
    let emailError = '';
    try {
      await emailService.sendEmail({
        to: guideEmail,
        subject: `🔑 Ваши учётные данные для входа в кабинет гида - Bunyod-Tour`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 20px;">
              <img src="https://bunyodtour.tj/Logo-Ru_1754635713718.png" 
                   alt="Bunyod-Tour" 
                   style="height: 60px; width: auto; border-radius: 50%;"
                   onerror="this.style.display='none'">
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
              <h1>🔑 Данные для входа в кабинет гида</h1>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <p style="font-size: 16px;">Здравствуйте, <strong>${guideName}</strong>!</p>
              <p>Администратор отправил вам данные для входа в личный кабинет гида.</p>
              
              <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #856404;">📋 Ваши данные для входа:</h3>
                <p style="margin: 10px 0;"><strong>Логин:</strong> <code style="background: #f8f9fa; padding: 4px 8px; border-radius: 4px;">${guide.login}</code></p>
                <p style="margin: 10px 0;"><strong>Пароль:</strong> <code style="background: #f8f9fa; padding: 4px 8px; border-radius: 4px;">${newPassword}</code></p>
              </div>
              
              <div style="background: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #155724;">
                  <strong>⚠️ Важно:</strong> После первого входа рекомендуем сменить пароль в настройках личного кабинета.
                </p>
              </div>

              <a href="https://bunyodtour.tj/guide-login.html" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                🚀 Войти в кабинет гида
              </a>
              
              <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
                Если вы не запрашивали эти данные, пожалуйста, проигнорируйте это письмо.
              </p>
            </div>
            
            <div style="background: #343a40; color: white; padding: 20px; text-align: center;">
              <p style="margin: 0;">С уважением, команда Bunyod-Tour</p>
              <p style="margin: 5px 0; font-size: 14px;">🌍 bunyodtour.tj</p>
            </div>
          </div>
        `
      });
      emailSent = true;
      console.log(`📧 Учётные данные отправлены гиду ${guideName} (ID: ${guideId}) на ${guideEmail}`);
    } catch (emailErr) {
      emailError = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error(`❌ Не удалось отправить email гиду ${guideName} (${guideEmail}):`, emailError);
    }

    // Пароль обновлён в БД — возвращаем успех в любом случае
    // Если email не отправился — сообщаем об этом администратору с новым паролем в ответе
    return res.json({
      success: true,
      emailSent,
      message: emailSent
        ? `Учётные данные успешно отправлены на ${guideEmail}`
        : `Пароль обновлён, но email не удалось отправить (${emailError}). Сообщите гиду вручную: логин — ${guide.login}, пароль — ${newPassword}`,
      ...(emailSent ? {} : { login: guide.login, newPassword })
    });

  } catch (error) {
    console.error('Ошибка при отправке учётных данных гиду:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка сервера',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Создаём alias для совместимости
export const createTourGuideProfile = createGuide;
