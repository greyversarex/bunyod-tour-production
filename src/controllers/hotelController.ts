import { Request, Response } from 'express';
import { HotelModel } from '../models';
import prisma from '../config/database';
import { 
  getLanguageFromRequest, 
  createLocalizedResponse, 
  parseMultilingualField,
  localizeArray,
  safeJsonParse
} from '../utils/multilingual';

// ✅ Используем строки вместо enum (как в форме отеля)
const getHotelCategoryTranslation = (category: string | null, language: string): string => {
  if (!category) return '';
  
  const translations: Record<string, { ru: string; en: string }> = {
    'STANDARD': { ru: 'Стандарт', en: 'Standard' },
    'SEMI_LUX': { ru: 'Полулюкс', en: 'Semi-Luxury' },
    'LUX': { ru: 'Люкс', en: 'Luxury' },
    'DELUXE': { ru: 'Делюкс', en: 'Deluxe' }
  };
  
  return translations[category]?.[language as 'ru' | 'en'] || translations[category]?.ru || category;
};

// Get all hotels with multilingual support
// GET /api/hotels?lang=en/ru&includeRaw=true&tourId=123
export const getHotels = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { tourId } = req.query;
    const language = getLanguageFromRequest(req);
    const includeRaw = req.query.includeRaw === 'true';
    
    let hotels;
    if (tourId) {
      // Get hotels for specific tour
      hotels = await HotelModel.findByTourId(parseInt(tourId as string));
    } else {
      // Get all hotels
      hotels = await HotelModel.findAll();
    }

    // Localize hotels data with safe JSON parsing
    const localizedHotels = hotels.map((hotel: any) => {
      try {
        if (includeRaw) {
          // ДЛЯ АДМИНКИ: возвращаем ТОЛЬКО БЕЗОПАСНЫЕ поля + raw JSON + локализованные поля
          return {
            id: hotel.id,
            images: hotel.images,
            rating: hotel.rating,
            stars: hotel.stars,
            amenities: hotel.amenities,
            brand: hotel.brand,
            category: hotel.category,
            categoryTranslated: getHotelCategoryTranslation(hotel.category, language),
            countryId: hotel.countryId,
            cityId: hotel.cityId,
            country: hotel.hotelCountry, // ДОБАВЛЕНО: связанная страна (правильное имя поля)
            city: hotel.hotelCity, // ДОБАВЛЕНО: связанный город (правильное имя поля)
            pension: hotel.pension,
            roomTypes: hotel.roomTypes,
            mealTypes: hotel.mealTypes,
            isActive: hotel.isActive,
            isDraft: hotel.isDraft, // 📝 Добавлено поле isDraft для админки
            createdAt: hotel.createdAt,
            updatedAt: hotel.updatedAt,
            _localized: {
              name: parseMultilingualField(hotel.name, language),
              description: parseMultilingualField(hotel.description, language),
              address: parseMultilingualField(hotel.address, language)
            },
            // Добавляем raw JSON для админки
            _raw: {
              name: safeJsonParse(hotel.name),
              description: safeJsonParse(hotel.description),
              address: safeJsonParse(hotel.address)
            }
          };
        } else {
          // ДЛЯ ПУБЛИЧНОГО ИСПОЛЬЗОВАНИЯ: включаем оба языка для фронтенда
          const parsedName = safeJsonParse(hotel.name);
          const parsedDescription = safeJsonParse(hotel.description);
          const parsedAddress = safeJsonParse(hotel.address);
          
          return {
            ...hotel,
            name: parseMultilingualField(hotel.name, language), // Текущий язык для обратной совместимости
            nameRu: typeof parsedName === 'object' ? parsedName.ru : parsedName,
            nameEn: typeof parsedName === 'object' ? parsedName.en : parsedName,
            description: parseMultilingualField(hotel.description, language),
            descriptionRu: typeof parsedDescription === 'object' ? parsedDescription.ru : parsedDescription,
            descriptionEn: typeof parsedDescription === 'object' ? parsedDescription.en : parsedDescription,
            address: parseMultilingualField(hotel.address, language),
            addressRu: typeof parsedAddress === 'object' ? parsedAddress.ru : parsedAddress,
            addressEn: typeof parsedAddress === 'object' ? parsedAddress.en : parsedAddress,
            categoryTranslated: getHotelCategoryTranslation(hotel.category, language),
            country: hotel.hotelCountry, // Добавляем связанную страну для публичного API (уже содержит nameRu/nameEn)
            city: hotel.hotelCity // Добавляем связанный город для публичного API (уже содержит nameRu/nameEn)
          };
        }
      } catch (jsonError) {
        console.error('Error parsing hotel JSON fields:', jsonError, 'Hotel ID:', hotel.id);
        return {
          ...hotel,
          name: hotel.name || '',
          description: hotel.description || '',
          address: hotel.address || ''
        };
      }
    });

    const response = createLocalizedResponse(
      localizedHotels,
      [], // Поля уже обработаны выше
      language,
      'Hotels retrieved successfully'
    );

    return res.json(response);
  } catch (error) {
    console.error('Error fetching hotels:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching hotels',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get single hotel with multilingual support
// GET /api/hotels/:id?lang=en/ru&includeRaw=true
export const getHotel = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const language = getLanguageFromRequest(req);
    const includeRaw = req.query.includeRaw === 'true';
    
    const hotel = await HotelModel.findById(parseInt(id));
    
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    // Localize hotel data with safe JSON parsing
    let localizedHotel;
    try {
      if (includeRaw) {
        // ДЛЯ АДМИНКИ: возвращаем ТОЛЬКО БЕЗОПАСНЫЕ поля + raw JSON + локализованные поля
        localizedHotel = {
          id: hotel.id,
          images: hotel.images,
          rating: hotel.rating,
          stars: hotel.stars,
          amenities: hotel.amenities,
          brand: hotel.brand,
          category: hotel.category,
          countryId: hotel.countryId,
          cityId: hotel.cityId,
          pension: hotel.pension,
          roomTypes: hotel.roomTypes,
          mealTypes: hotel.mealTypes,
          isActive: hotel.isActive,
          createdAt: hotel.createdAt,
          updatedAt: hotel.updatedAt,
          _localized: {
            name: parseMultilingualField(hotel.name, language),
            description: parseMultilingualField(hotel.description, language),
            address: parseMultilingualField(hotel.address, language)
          },
          // Добавляем raw JSON для админки
          _raw: {
            name: safeJsonParse(hotel.name),
            description: safeJsonParse(hotel.description),
            address: safeJsonParse(hotel.address)
          }
        };
      } else {
        // ДЛЯ ПУБЛИЧНОГО ИСПОЛЬЗОВАНИЯ: включаем оба языка для фронтенда
        const parsedName = safeJsonParse(hotel.name);
        const parsedDescription = safeJsonParse(hotel.description);
        const parsedAddress = safeJsonParse(hotel.address);
        
        localizedHotel = {
          ...hotel,
          name: parseMultilingualField(hotel.name, language), // Текущий язык для обратной совместимости
          nameRu: typeof parsedName === 'object' ? parsedName.ru : parsedName,
          nameEn: typeof parsedName === 'object' ? parsedName.en : parsedName,
          description: parseMultilingualField(hotel.description, language),
          descriptionRu: typeof parsedDescription === 'object' ? parsedDescription.ru : parsedDescription,
          descriptionEn: typeof parsedDescription === 'object' ? parsedDescription.en : parsedDescription,
          address: parseMultilingualField(hotel.address, language),
          addressRu: typeof parsedAddress === 'object' ? parsedAddress.ru : parsedAddress,
          addressEn: typeof parsedAddress === 'object' ? parsedAddress.en : parsedAddress,
          country: hotel.hotelCountry, // Добавляем связанную страну для публичного API (уже содержит nameRu/nameEn)
          city: hotel.hotelCity // Добавляем связанный город для публичного API (уже содержит nameRu/nameEn)
        };
      }
    } catch (jsonError) {
      console.error('Error parsing hotel JSON fields:', jsonError, 'Hotel ID:', hotel.id);
      localizedHotel = {
        ...hotel,
        name: hotel.name || '',
        description: hotel.description || '',
        address: hotel.address || ''
      };
    }

    const response = createLocalizedResponse(
      localizedHotel,
      [], // Поля уже обработаны выше
      language,
      'Hotel retrieved successfully'
    );

    return res.json(response);
  } catch (error) {
    console.error('Error fetching hotel:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching hotel',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create hotel
export const createHotel = async (req: Request, res: Response): Promise<Response> => {
  try {
    let { name, description, address, countryId, cityId, isDraft } = req.body;
    
    // ✅ ВАЛИДАЦИЯ КАК У ТУРОВ: Парсинг JSON строк если нужно
    if (typeof name === 'string') {
      try {
        name = JSON.parse(name);
        req.body.name = name; // ✅ Записываем обратно в req.body
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid name format - must be valid JSON'
        });
      }
    }
    
    if (typeof description === 'string') {
      try {
        description = JSON.parse(description);
        req.body.description = description; // ✅ Записываем обратно в req.body
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid description format - must be valid JSON'
        });
      }
    }
    
    // ✅ Парсинг address если это JSON строка
    if (address && typeof address === 'string') {
      try {
        address = JSON.parse(address);
        req.body.address = address;
      } catch (e) {
        // address может быть просто строкой, игнорируем ошибку парсинга
      }
    }
    
    // 📝 Условная валидация: для черновиков не требуем строгой валидации
    const isSavingDraft = isDraft === true || isDraft === 'true';
    
    if (!isSavingDraft) {
      // ✅ СТРОГАЯ ВАЛИДАЦИЯ для публикации
      if (!name || !name.ru || !name.en) {
        return res.status(400).json({
          success: false,
          error: 'Hotel name is required in both Russian and English'
        });
      }
      
      // ✅ ВАЛИДАЦИЯ: Описание должно быть на обоих языках если указано
      if (description) {
        if (typeof description === 'object') {
          if ((description.ru && !description.en) || (!description.ru && description.en)) {
            return res.status(400).json({
              success: false,
              error: 'Description must be provided in both languages if specified'
            });
          }
        }
      }
      
      // ✅ ВАЛИДАЦИЯ: Страна и город обязательны
      if (!countryId) {
        return res.status(400).json({
          success: false,
          error: 'Country is required'
        });
      }
      
      if (!cityId) {
        return res.status(400).json({
          success: false,
          error: 'City is required'
        });
      }
    } else {
      // 📝 МЯГКАЯ ВАЛИДАЦИЯ для черновиков
      console.log('💾 Saving hotel as draft - skipping strict validation');
    }
    
    const hotel = await HotelModel.create(req.body);

    return res.status(201).json({
      success: true,
      data: hotel,
      message: 'Hotel created successfully'
    });
  } catch (error) {
    console.error('Error creating hotel:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating hotel',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update hotel
export const updateHotel = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    let { name, description, address, isDraft } = req.body;
    
    // ✅ ВАЛИДАЦИЯ КАК У ТУРОВ: Парсинг JSON строк если нужно
    if (typeof name === 'string') {
      try {
        name = JSON.parse(name);
        req.body.name = name; // ✅ Записываем обратно в req.body
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid name format - must be valid JSON'
        });
      }
    }
    
    if (typeof description === 'string') {
      try {
        description = JSON.parse(description);
        req.body.description = description; // ✅ Записываем обратно в req.body
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid description format - must be valid JSON'
        });
      }
    }
    
    // ✅ Парсинг address если это JSON строка
    if (address && typeof address === 'string') {
      try {
        address = JSON.parse(address);
        req.body.address = address;
      } catch (e) {
        // address может быть просто строкой, игнорируем ошибку парсинга
      }
    }
    
    // 📝 Условная валидация: для черновиков не требуем строгой валидации
    const isSavingDraft = isDraft === true || isDraft === 'true';
    
    if (!isSavingDraft) {
      // ✅ СТРОГАЯ ВАЛИДАЦИЯ для публикации
      if (name && (!name.ru || !name.en)) {
        return res.status(400).json({
          success: false,
          error: 'Hotel name must include both Russian and English'
        });
      }
      
      // ✅ ВАЛИДАЦИЯ: Если описание передано, оно должно быть на обоих языках
      if (description && typeof description === 'object') {
        if ((description.ru && !description.en) || (!description.ru && description.en)) {
          return res.status(400).json({
            success: false,
            error: 'Description must be provided in both languages if specified'
          });
        }
      }
    } else {
      // 📝 МЯГКАЯ ВАЛИДАЦИЯ для черновиков
      console.log('💾 Updating hotel as draft - skipping strict validation');
    }
    
    const hotel = await HotelModel.update(parseInt(id), req.body);

    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    return res.json({
      success: true,
      data: hotel,
      message: 'Hotel updated successfully'
    });
  } catch (error) {
    console.error('Error updating hotel:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating hotel',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Publish a draft hotel
// POST /api/hotels/:id/publish
export const publishHotel = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const hotelId = parseInt(id);

    if (isNaN(hotelId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hotel ID'
      });
    }

    // Получаем отель для проверки что он существует и является черновиком
    const existingHotel = await prisma.hotel.findUnique({
      where: { id: hotelId }
    });

    if (!existingHotel) {
      return res.status(404).json({
        success: false,
        error: 'Hotel not found'
      });
    }

    if (!existingHotel.isDraft) {
      return res.status(400).json({
        success: false,
        error: 'Hotel is already published'
      });
    }

    // Парсим JSON поля для валидации
    let name, description;
    try {
      name = safeJsonParse(existingHotel.name);
      description = existingHotel.description ? safeJsonParse(existingHotel.description) : null;
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid multilingual data format'
      });
    }

    // ✅ СТРОГАЯ ВАЛИДАЦИЯ перед публикацией
    if (!name || !name.ru || !name.en) {
      return res.status(400).json({
        success: false,
        error: 'Cannot publish: Hotel name must include both Russian and English'
      });
    }

    if (description && typeof description === 'object') {
      if ((description.ru && !description.en) || (!description.ru && description.en)) {
        return res.status(400).json({
          success: false,
          error: 'Cannot publish: Description must be provided in both languages if specified'
        });
      }
    }

    if (!existingHotel.countryId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot publish: Country is required'
      });
    }

    if (!existingHotel.cityId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot publish: City is required'
      });
    }

    // Публикуем отель (isDraft = false)
    const publishedHotel = await prisma.hotel.update({
      where: { id: hotelId },
      data: { isDraft: false }
    });

    return res.json({
      success: true,
      data: publishedHotel,
      message: 'Hotel published successfully'
    });
  } catch (error) {
    console.error('Error publishing hotel:', error);
    return res.status(500).json({
      success: false,
      error: 'Error publishing hotel: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
};

// Delete hotel
export const deleteHotel = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    const deleted = await HotelModel.delete(parseInt(id));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found'
      });
    }

    return res.json({
      success: true,
      message: 'Hotel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting hotel:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting hotel',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Add hotel to tour
export const addHotelToTour = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Support both URL params and body data
    const tourId = req.params.tourId || req.body.tourId;
    const hotelId = req.params.hotelId || req.body.hotelId;
    const { pricePerNight, isDefault } = req.body;
    
    const tourHotel = await HotelModel.addToTour(
      parseInt(tourId), 
      parseInt(hotelId), 
      pricePerNight,
      isDefault
    );

    return res.json({
      success: true,
      data: tourHotel,
      message: 'Hotel added to tour successfully'
    });
  } catch (error) {
    console.error('Error adding hotel to tour:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding hotel to tour',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Remove hotel from tour
export const removeHotelFromTour = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { tourId, hotelId } = req.params;
    
    const removed = await HotelModel.removeFromTour(parseInt(tourId), parseInt(hotelId));

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Hotel-Tour association not found'
      });
    }

    return res.json({
      success: true,
      message: 'Hotel removed from tour successfully'
    });
  } catch (error) {
    console.error('Error removing hotel from tour:', error);
    return res.status(500).json({
      success: false,
      message: 'Error removing hotel from tour',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};