import { Request, Response, NextFunction } from 'express';
import { TourModel, CategoryModel, BookingRequestModel, ReviewModel, TourBlockModel, HotelModel } from '../models';
import { sendAdminNotification, sendCustomerConfirmation } from '../config/email';
import { 
  CreateTourData, 
  CreateCategoryData,
  CreateBookingRequestData,
  CreateReviewData,
  UpdateReviewData,
  ApiResponse, 
  MultilingualContent 
} from '../types';
import prisma from '../config/database';
import { 
  getLanguageFromRequest, 
  createLocalizedResponse, 
  parseMultilingualField,
  safeJsonParse,
  mapTour
} from '../utils/multilingual';

export class TourController {
  /**
   * Get all tours with multilingual support
   * GET /api/tours?lang=en/ru
   */
  static async getAllTours(req: Request, res: Response, next: NextFunction) {
    try {
      const { blockId, limit } = req.query;
      const language = getLanguageFromRequest(req);
      
      let filters: any = {};
      // Note: blockId filtering now handled by TourBlockAssignment system
      // This filter is deprecated - use /api/tour-blocks/:id/tours instead
      
      const tours = await TourModel.search(filters);
      
      // Apply limit if specified
      const limitedTours = limit ? tours.slice(0, parseInt(limit as string)) : tours;
      
      // Use centralized mapTour utility for consistent localization
      const localizedTours = limitedTours.map((tour: any) => 
        mapTour(tour, language, {
          includeRaw: req.query.includeRaw === 'true',
          removeImages: true // Performance optimization for list view
        })
      );

      const response = createLocalizedResponse(
        localizedTours,
        [], // Поля уже обработаны выше
        language,
        'Tours retrieved successfully'
      );

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tour main image
   * GET /api/tours/:id/main-image
   */
  static async getTourMainImage(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tour ID'
        });
      }

      const tour = await TourModel.findById(id);
      
      if (!tour) {
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }

      // Get main image path
      let imagePath = tour.mainImage;
      
      // If no main image, try to get first image from gallery
      if (!imagePath && tour.images) {
        try {
          const images = safeJsonParse(tour.images, []);
          if (images && images.length > 0) {
            imagePath = images[0];
          }
        } catch (e) {
          console.error('Error parsing tour images:', e);
        }
      }

      if (!imagePath) {
        return res.status(404).json({
          success: false,
          error: 'No image found for this tour'
        });
      }

      // Redirect to the image path - this should be handled by object storage middleware
      if (imagePath.startsWith('/objects/')) {
        return res.redirect(imagePath);
      } else {
        // For external URLs, redirect directly
        return res.redirect(imagePath);
      }

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single tour by ID with multilingual support
   * GET /api/tours/:id?lang=en/ru&includeRaw=true
   */
  static async getTourById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const language = getLanguageFromRequest(req);
      const includeRaw = req.query.includeRaw === 'true';
      
      console.log('📋 getTourById called with:', { id, language, includeRaw });
      
      if (isNaN(id)) {
        console.log('❌ Invalid tour ID provided:', req.params.id);
        return res.status(400).json({
          success: false,
          error: 'Invalid tour ID'
        });
      }

      console.log('🔍 Searching for tour with ID:', id);
      const tour = await TourModel.findById(id) as any; // Явное приведение из-за Prisma типов
      console.log('📦 Found tour:', tour ? 'Yes' : 'No');
      
      if (!tour) {
        console.log('❌ Tour not found with ID:', id);
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }

      // Parse JSON fields for response
      let parsedTour;
      try {
        if (includeRaw) {
          // ДЛЯ РЕДАКТИРОВАНИЯ: возвращаем raw JSON + локализованные поля
          parsedTour = {
            ...tour,
            title: safeJsonParse(tour.title),
            description: safeJsonParse(tour.description),
            category: tour.category ? {
              ...tour.category,
              name: safeJsonParse(tour.category.name)
            } : null,
            // Парсим services для включения nameEn
            services: tour.services ? safeJsonParse(tour.services, []) : [],
            // 🗺️ Преобразуем tourMapPoints в формат для фронтенда (АДМИНКА)
            tourMapPoints: tour.tourMapPoints ? tour.tourMapPoints.map((point: any) => ({
              lat: point.latitude,
              lng: point.longitude,
              title: point.description || `Point ${point.stepNumber}`,
              description: point.description || '',
              stepNumber: point.stepNumber
            })) : [],
            // Добавляем локализованные версии для превью
            _localized: {
              title: parseMultilingualField(tour.title, language),
              description: parseMultilingualField(tour.description, language),
              categoryName: tour.category ? parseMultilingualField(tour.category.name, language) : null
            }
            // НЕ удаляем mainImage и images - они нужны для редактирования!
          };
        } else {
          // ДЛЯ ПУБЛИЧНОГО ПРОСМОТРА: возвращаем только локализованный контент
          parsedTour = {
            ...tour,
            title: parseMultilingualField(tour.title, language),
            description: parseMultilingualField(tour.description, language),
            category: tour.category ? {
              ...tour.category,
              name: parseMultilingualField(tour.category.name, language)
            } : null,
            // Парсим services для включения nameEn
            services: tour.services ? safeJsonParse(tour.services, []) : [],
            // 🗺️ Преобразуем tourMapPoints в формат для фронтенда (ПУБЛИЧНЫЙ ПРОСМОТР)
            tourMapPoints: tour.tourMapPoints ? tour.tourMapPoints.map((point: any) => ({
              lat: point.latitude,
              lng: point.longitude,
              title: point.description || `Point ${point.stepNumber}`,
              description: point.description || ''
            })) : []
          };
        }
        
        // Обогащаем services данными nameEn из предопределенных компонентов
        if (parsedTour.services && Array.isArray(parsedTour.services) && parsedTour.services.length > 0) {
          // Маппинг предопределенных компонентов (синхронизирован с src/models/index.ts)
          const componentNamesEn: Record<string, string> = {
            'accommodation_std': 'Accommodation, STD',
            'accommodation_comfort': 'Accommodation, Comfort',
            'accommodation_vip': 'Accommodation, VIP',
            'guide_daily': 'Tour Guide, Daily',
            'guide_vip': 'Tour Guide, VIP',
            'driver_4wd': 'Driver, 4WD',
            'driver_car': 'Driver, Car',
            'driver_minibus': 'Driver, Minibus',
            'meals_full_board': 'Meals, Full Board',
            'meals_half_board': 'Meals, Half Board',
            'meals_breakfast': 'Meals, Breakfast Only',
            'entry_museum': 'Entry Tickets, Museum',
            'entry_park': 'Entry Tickets, National Park',
            'entry_monument': 'Entry Tickets, Monument',
            'equipment_trekking': 'Equipment, Trekking',
            'equipment_camping': 'Equipment, Camping',
            'equipment_climbing': 'Equipment, Climbing',
            'insurance_basic': 'Insurance, Basic',
            'insurance_premium': 'Insurance, Premium',
            'transfer_airport': 'Transfer, Airport',
            'transfer_hotel': 'Transfer, Hotel',
            'transfer_station': 'Transfer, Train/Bus Station',
            'transport_tour_4wd': 'Transport During Tour, 4WD',
            'transport_tour_car': 'Transport During Tour, Car',
            'transport_tour_minibus': 'Transport During Tour, Minibus'
          };
          
          // Добавляем nameEn к каждому service
          parsedTour.services = parsedTour.services.map((service: any) => ({
            ...service,
            nameEn: service.nameEn || componentNamesEn[service.key] || service.name
          }));
        }
      } catch (jsonError) {
        console.error('Error parsing tour JSON fields:', jsonError, 'Tour ID:', tour.id);
        parsedTour = {
          ...tour,
          title: tour.title || '',
          description: tour.description || '',
          // category: ВРЕМЕННО ОТКЛЮЧЕНО
        };
      }

      const response = createLocalizedResponse(
        parsedTour,
        [], // Поля уже обработаны выше
        language,
        'Tour retrieved successfully'
      );

      console.log('✅ Returning tour data successfully for ID:', id, 'Language:', language);
      return res.status(200).json(response);
    } catch (error) {
      console.error('❌ Error in getTourById:', error);
      return next(error);
    }
  }

  /**
   * Create a new tour
   * POST /api/tours
   */
  static async createTour(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('Creating tour with data:', req.body);
      let { title, description, shortDescription, duration, price, priceType, originalPrice, categoryId, categoriesIds, countryId, cityId, country, city, countriesIds, citiesIds, cityNights, durationDays, durationType, format, tourType, difficulty, maxPeople, minPeople, mainImage, images, services, highlights, itinerary, itineraryEn, included, includes, excluded, pickupInfo, pickupInfoEn, startTimeOptions, languages, availableMonths, availableDays, isFeatured, isDraft, isPromotion, discountPercent, startDate, endDate, rating, reviewsCount, hotelIds, guideIds, driverIds, tourBlockIds, pricingComponents, profitMargin, mapPoints } = req.body;

      console.log('💰 Received profitMargin from frontend:', profitMargin, 'Type:', typeof profitMargin);

      // 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Нормализация русских значений в английские enum
      const normalizePriceType = (value: string | undefined): string => {
        if (!value) return 'per_person'; // Дефолт для create
        const map: Record<string, string> = {
          'за человека': 'per_person',
          'за группу': 'per_group',
          'per_person': 'per_person',
          'per_group': 'per_group'
        };
        const normalized = map[value];
        if (!normalized) {
          console.warn(`⚠️ Unknown priceType value: "${value}", using default: per_person`);
          return 'per_person';
        }
        return normalized;
      };
      
      const normalizeTourType = (value: string | undefined): string => {
        if (!value) return 'individual'; // Дефолт для create
        const map: Record<string, string> = {
          'Персональный': 'individual',
          'Групповой приватный': 'group_private',
          'Групповой общий': 'group_shared',
          'individual': 'individual',
          'group_private': 'group_private',
          'group_shared': 'group_shared'
        };
        const normalized = map[value];
        if (!normalized) {
          console.warn(`⚠️ Unknown tourType/format value: "${value}", using default: individual`);
          return 'individual';
        }
        return normalized;
      };
      
      // Применяем нормализацию
      priceType = normalizePriceType(priceType);
      tourType = normalizeTourType(tourType);
      format = normalizeTourType(format);
      
      console.log('✅ Normalized priceType:', priceType, 'tourType:', tourType, 'format:', format);

      // Parse JSON strings if needed
      if (typeof title === 'string') {
        try {
          title = safeJsonParse(title);
          console.log('Parsed title:', title);
        } catch (e) {
          console.error('Failed to parse title:', e);
          return res.status(400).json({
            success: false,
            error: 'Invalid title format'
          });
        }
      }

      // Parse shortDescription if description is not provided
      if (!description && shortDescription) {
        description = shortDescription;
        console.log('Using shortDescription as description:', shortDescription);
      }

      if (typeof description === 'string') {
        try {
          description = safeJsonParse(description);
          console.log('Parsed description:', description);
        } catch (e) {
          console.error('Failed to parse description:', e);
          return res.status(400).json({
            success: false,
            error: 'Invalid description format'
          });
        }
      }

      // 📝 Условная валидация: для черновиков не требуем обязательные поля
      const isSavingDraft = isDraft === true || isDraft === 'true';
      
      if (!isSavingDraft) {
        // ✅ ПОЛНАЯ ВАЛИДАЦИЯ для публикации
        if (!title || !title.en || !title.ru) {
          return res.status(400).json({
            success: false,
            error: 'Title is required in both English and Russian'
          });
        }

        // Make description optional or use shortDescription
        if (description && (typeof description === 'object')) {
          if (!description.en || !description.ru) {
            return res.status(400).json({
              success: false,
              error: 'Description must have both English and Russian versions if provided'
            });
          }
        } else if (!description) {
          // Set default empty description if none provided
          description = { ru: '', en: '' };
          console.log('Using default empty description');
        }

        // Use durationDays if duration is not provided
        const finalDuration = duration || durationDays;
        if (!finalDuration) {
          return res.status(400).json({
            success: false,
            error: 'Duration is required'
          });
        }

        if (!price) {
          return res.status(400).json({
            success: false,
            error: 'Price is required'
          });
        }

        if (!categoryId) {
          return res.status(400).json({
            success: false,
            error: 'Category ID is required'
          });
        }
      } else {
        // 📝 МЯГКАЯ ВАЛИДАЦИЯ для черновиков
        console.log('💾 Saving as draft - skipping strict validation');
        
        // Установим дефолтные значения если не указаны
        if (!description) {
          description = { ru: '', en: '' };
        }
      }
      
      // Use durationDays if duration is not provided (для обоих режимов)
      const finalDuration = duration || durationDays;

      // Parse arrays for multiple countries and cities
      let countriesIdsNumbers: number[] | undefined;
      let citiesIdsNumbers: number[] | undefined;

      if (countriesIds && Array.isArray(countriesIds) && countriesIds.length > 0) {
        countriesIdsNumbers = countriesIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (countriesIdsNumbers.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid countries IDs format'
          });
        }
      }

      if (citiesIds && Array.isArray(citiesIds) && citiesIds.length > 0) {
        citiesIdsNumbers = citiesIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (citiesIdsNumbers.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid cities IDs format'
          });
        }
      }
      
      // Parse array for multiple categories and set fallback BEFORE parsing categoryIdNumber
      let categoriesIdsNumbers: number[] | undefined;
      if (categoriesIds && Array.isArray(categoriesIds) && categoriesIds.length > 0) {
        categoriesIdsNumbers = categoriesIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id));
        if (categoriesIdsNumbers.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Invalid categories IDs format'
          });
        }
        // Use first category as primary for backward compatibility
        if (!categoryId || isNaN(parseInt(categoryId))) {
          categoryId = categoriesIdsNumbers[0];
        }
      }

      // Convert string fields to numbers for Prisma (AFTER setting categoryId fallback)
      const categoryIdNumber = parseInt(categoryId);
      const countryIdNumber = countryId ? parseInt(countryId) : undefined;
      const cityIdNumber = cityId ? parseInt(cityId) : undefined;
      const durationDaysNumber = durationDays ? parseInt(durationDays) : undefined;
      const maxPeopleNumber = maxPeople ? parseInt(maxPeople) : undefined;
      const minPeopleNumber = minPeople ? parseInt(minPeople) : undefined;
      const ratingNumber = rating ? parseFloat(rating) : undefined;
      const reviewsCountNumber = reviewsCount ? parseInt(reviewsCount) : undefined;
      const profitMarginNumber = profitMargin !== undefined ? parseFloat(profitMargin) : 0;
      
      if (isNaN(categoryIdNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID format'
        });
      }

      console.log('Converted numeric fields:', {
        categoryId: categoryIdNumber,
        countryId: countryIdNumber,
        cityId: cityIdNumber,
        durationDays: durationDaysNumber,
        maxPeople: maxPeopleNumber,
        minPeople: minPeopleNumber,
        rating: ratingNumber,
        reviewsCount: reviewsCountNumber
      });

      console.log('🔄 Starting tour creation in database...');
      
      let tour;
      try {
        tour = await TourModel.create({
        title,
        description,
        shortDescription: shortDescription || null,
        duration: String(finalDuration), // Convert to string for Prisma
        price: String(price),
        priceType: priceType || 'per_person', // 🎯 ИСПРАВЛЕНО: дефолт теперь английский enum
        originalPrice: originalPrice || null,
        categoryId: categoryIdNumber,
        // Старые одиночные поля для совместимости
        countryId: countryIdNumber,
        cityId: cityIdNumber,
        country: country || null,
        city: city || null,
        // Новые массивы для множественного выбора
        countriesIds: countriesIdsNumbers,
        citiesIds: citiesIdsNumbers,
        cityNights: cityNights, // 🆕 Количество ночей для каждого города
        categoriesIds: categoriesIdsNumbers,
        format: format || null,
        tourType: tourType || null,
        durationDays: durationDaysNumber,
        durationType: durationType || 'days',
        difficulty: difficulty || null,
        maxPeople: maxPeopleNumber,
        minPeople: minPeopleNumber,
        mainImage: mainImage || null,
        images: images || null,
        services: services || null,
        highlights: highlights || null,
        itinerary: itinerary || null,
        itineraryEn: itineraryEn || null,
        includes: includes || included || null,
        excluded: excluded || null,
        pickupInfo: pickupInfo || null,
        pickupInfoEn: pickupInfoEn || null,
        startTimeOptions: startTimeOptions || null,
        languages: languages || null,
        availableMonths: availableMonths || null,
        availableDays: availableDays || null,
        isFeatured: isFeatured || false,
        isDraft: isSavingDraft, // 📝 Сохраняем статус черновика
        isActive: !isSavingDraft, // 📝 Черновики неактивны
        isPromotion: isPromotion === true || isPromotion === 'true' || false, // 🔥 Флаг акции
        discountPercent: parseFloat(discountPercent) || 0, // 🔥 Процент скидки
        startDate: startDate || null,
        endDate: endDate || null,
        rating: ratingNumber,
        reviewsCount: reviewsCountNumber,
        pricingComponents: pricingComponents || null,
        profitMargin: profitMarginNumber,
        mapPoints: mapPoints || null // 🗺️ Точки карты тура
      });
      } catch (createError) {
        console.error('❌ Error in TourModel.create:', createError);
        throw createError;
      }
      
      if (!tour) {
        throw new Error('Failed to create tour');
      }

      console.log('✅ Tour created successfully in database with ID:', tour.id);

      // Create hotel associations if provided
      if (hotelIds && Array.isArray(hotelIds) && hotelIds.length > 0) {
        console.log('🏨 Creating hotel associations:', hotelIds);
        try {
          const tourHotelData = hotelIds.map((hotelId: number) => ({
            tourId: tour.id,
            hotelId: hotelId,
            isDefault: false
          }));
          
          console.log('🏨 TourHotel data to create:', tourHotelData);
          
          await prisma.tourHotel.createMany({
            data: tourHotelData
          });
          
          console.log('✅ Hotel associations created successfully');
        } catch (hotelError) {
          console.error('❌ Error creating hotel associations:', hotelError);
          throw hotelError;
        }
      }

      // Create guide associations if provided
      if (guideIds && Array.isArray(guideIds) && guideIds.length > 0) {
        console.log('👨‍🏫 Creating guide associations:', guideIds);
        try {
          const tourGuideData = guideIds.map((guideId: number) => ({
            tourId: tour.id,
            guideId: guideId,
            isDefault: false
          }));
          
          console.log('👨‍🏫 TourGuide data to create:', tourGuideData);
          
          await prisma.tourGuide.createMany({
            data: tourGuideData
          });
          
          console.log('✅ Guide associations created successfully');
        } catch (guideError) {
          console.error('❌ Error creating guide associations:', guideError);
          throw guideError;
        }
      }

      // Create driver associations if provided
      if (driverIds && Array.isArray(driverIds) && driverIds.length > 0) {
        console.log('🚗 Creating driver associations:', driverIds);
        try {
          const tourDriverData = driverIds.map((driverId: number) => ({
            tourId: tour.id,
            driverId: driverId,
            isDefault: false
          }));
          
          console.log('🚗 TourDriver data to create:', tourDriverData);
          
          await prisma.tourDriver.createMany({
            data: tourDriverData
          });
          
          console.log('✅ Driver associations created successfully');
        } catch (driverError) {
          console.error('❌ Error creating driver associations:', driverError);
          throw driverError;
        }
      }

      // Create tour block associations if provided
      if (tourBlockIds && Array.isArray(tourBlockIds) && tourBlockIds.length > 0) {
        console.log('📦 Creating tour block associations:', tourBlockIds);
        try {
          const tourBlockData = tourBlockIds.map((blockId: number, index: number) => ({
            tourId: tour.id,
            tourBlockId: blockId,
            isPrimary: index === 0 // Первый блок считается основным
          }));
          
          console.log('📦 TourBlockAssignment data to create:', tourBlockData);
          
          await prisma.tourBlockAssignment.createMany({
            data: tourBlockData
          });
          
          console.log('✅ Tour block associations created successfully');
        } catch (blockError) {
          console.error('❌ Error creating tour block associations:', blockError);
          throw blockError;
        }
      }

      // ✅ ИСПРАВЛЕНО: Категории уже созданы в TourModel.create() - не дублируем
      // TourModel.create() внутри транзакции создаёт связи категорий из categoriesIds
      console.log('✅ Category associations created by TourModel.create()')

      // Parse JSON fields for response with safe parsing
      let parsedTour;
      try {
        parsedTour = {
          ...tour,
          title: safeJsonParse(tour.title),
          description: safeJsonParse(tour.description),
          // category будет загружена отдельно если нужно
        };
      } catch (jsonError) {
        console.error('Error parsing tour JSON fields:', jsonError, 'Tour ID:', tour.id);
        // Use mapTour utility for consistent fallback handling
        parsedTour = mapTour(tour, 'ru', { includeRaw: true });
      }

      const response: ApiResponse = {
        success: true,
        data: parsedTour,
        message: 'Tour created successfully'
      };

      return res.status(201).json(response);
    } catch (error) {
      console.error('❌ Error creating tour:', error);
      
      // Detailed error logging
      if (error instanceof Error) {
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      
      if (error instanceof Error && error.message === 'Category not found') {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Database error: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  }

  /**
   * Update a tour
   * PUT /api/tours/:id
   */
  static async updateTour(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tour ID'
        });
      }

      console.log('🔍 FULL REQUEST BODY:', JSON.stringify(req.body, null, 2));
      
      let { title, description, duration, price, categoryId, categoriesIds, countryId, cityId, country, city, countriesIds, citiesIds, cityNights, durationDays, durationType, format, tourType, priceType, pickupInfo, pickupInfoEn, startTimeOptions, languages, availableMonths, availableDays, startDate, endDate, shortDescription, mainImage, images, services, highlights, itinerary, itineraryEn, included, includes, excluded, difficulty, maxPeople, minPeople, rating, reviewsCount, isFeatured, isDraft, isPromotion, discountPercent, hotelIds, guideIds, driverIds, tourBlockIds, pricingComponents, profitMargin, mapPoints } = req.body;

      console.log('💰 UPDATE: Received profitMargin from frontend:', profitMargin, 'Type:', typeof profitMargin);
      console.log('📊 All keys in req.body:', Object.keys(req.body));

      // 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Нормализация русских значений в английские enum
      // ВАЖНО: Для update возвращаем undefined если значение не передано (частичное обновление)
      const normalizePriceType = (value: string | undefined): string | undefined => {
        if (value === undefined || value === null || value === '') return undefined;
        const map: Record<string, string> = {
          'за человека': 'per_person',
          'за группу': 'per_group',
          'per_person': 'per_person',
          'per_group': 'per_group'
        };
        const normalized = map[value];
        if (!normalized) {
          console.warn(`⚠️ Unknown priceType value: "${value}", keeping as-is`);
          return value;
        }
        return normalized;
      };
      
      const normalizeTourType = (value: string | undefined): string | undefined => {
        if (value === undefined || value === null || value === '') return undefined;
        const map: Record<string, string> = {
          'Персональный': 'individual',
          'Групповой приватный': 'group_private',
          'Групповой общий': 'group_shared',
          'individual': 'individual',
          'group_private': 'group_private',
          'group_shared': 'group_shared'
        };
        const normalized = map[value];
        if (!normalized) {
          console.warn(`⚠️ Unknown tourType/format value: "${value}", keeping as-is`);
          return value;
        }
        return normalized;
      };
      
      // Применяем нормализацию только если значения явно переданы (не undefined)
      if (priceType !== undefined) {
        priceType = normalizePriceType(priceType);
      }
      if (tourType !== undefined) {
        tourType = normalizeTourType(tourType);
      }
      if (format !== undefined) {
        format = normalizeTourType(format);
      }
      
      console.log('✅ Normalized (update) priceType:', priceType, 'tourType:', tourType, 'format:', format);

      // Parse JSON strings if needed (same as createTour)
      if (typeof title === 'string') {
        try {
          title = safeJsonParse(title);
          console.log('Parsed title for update:', title);
        } catch (e) {
          console.error('Failed to parse title:', e);
          return res.status(400).json({
            success: false,
            error: 'Invalid title format'
          });
        }
      }

      if (typeof description === 'string') {
        try {
          description = safeJsonParse(description);
          console.log('Parsed description for update:', description);
        } catch (e) {
          console.error('Failed to parse description:', e);
          return res.status(400).json({
            success: false,
            error: 'Invalid description format'
          });
        }
      }

      // 📝 Условная валидация: для черновиков не требуем строгой валидации
      const isSavingDraft = isDraft === true || isDraft === 'true';
      
      if (!isSavingDraft) {
        // ✅ ПОЛНАЯ ВАЛИДАЦИЯ для публикации
        if (title && (!title.en || !title.ru)) {
          return res.status(400).json({
            success: false,
            error: 'Title must include both English and Russian'
          });
        }

        if (description && (!description.en || !description.ru)) {
          return res.status(400).json({
            success: false,
            error: 'Description must include both English and Russian'
          });
        }
      } else {
        // 📝 МЯГКАЯ ВАЛИДАЦИЯ для черновиков
        console.log('💾 Updating as draft - skipping strict validation');
      }

      // Convert numeric fields like in createTour
      const categoryIdNumber = categoryId ? parseInt(categoryId) : undefined;
      const countryIdNumber = countryId ? parseInt(countryId) : undefined;
      const cityIdNumber = cityId ? parseInt(cityId) : undefined;
      const durationDaysNumber = durationDays ? parseInt(durationDays) : undefined;
      const maxPeopleNumber = maxPeople ? parseInt(maxPeople) : undefined;
      const minPeopleNumber = minPeople ? parseInt(minPeople) : undefined;
      const ratingNumber = rating ? parseFloat(rating) : undefined;
      const reviewsCountNumber = reviewsCount ? parseInt(reviewsCount) : undefined;
      const profitMarginNumber = profitMargin !== undefined ? parseFloat(profitMargin) : undefined;
      console.log('💰 UPDATE: Parsed profitMarginNumber:', profitMarginNumber, 'Will update:', profitMarginNumber !== undefined);

      // Parse arrays for multiple countries, cities, and categories
      let countriesIdsNumbers: number[] | undefined;
      let citiesIdsNumbers: number[] | undefined;
      let categoriesIdsNumbers: number[] | undefined;

      if (countriesIds !== undefined) {
        if (Array.isArray(countriesIds) && countriesIds.length > 0) {
          countriesIdsNumbers = countriesIds.map(id => parseInt(id)).filter(id => !isNaN(id));
          if (countriesIdsNumbers.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'Invalid countries IDs format'
            });
          }
        } else {
          countriesIdsNumbers = []; // Empty array to clear existing relations
        }
      }

      if (citiesIds !== undefined) {
        if (Array.isArray(citiesIds) && citiesIds.length > 0) {
          citiesIdsNumbers = citiesIds.map(id => parseInt(id)).filter(id => !isNaN(id));
          if (citiesIdsNumbers.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'Invalid cities IDs format'
            });
          }
        } else {
          citiesIdsNumbers = []; // Empty array to clear existing relations
        }
      }

      if (categoriesIds !== undefined) {
        if (Array.isArray(categoriesIds) && categoriesIds.length > 0) {
          categoriesIdsNumbers = categoriesIds.map(id => parseInt(id)).filter(id => !isNaN(id));
          if (categoriesIdsNumbers.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'Invalid categories IDs format'
            });
          }
        } else {
          categoriesIdsNumbers = []; // Empty array to clear existing relations
        }
      }

      const updateData: Partial<CreateTourData> = {};
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (shortDescription) updateData.shortDescription = shortDescription;
      if (duration) updateData.duration = String(duration);
      if (price) updateData.price = String(price);
      if (categoryIdNumber) updateData.categoryId = categoryIdNumber;
      if (countryIdNumber !== undefined) updateData.countryId = countryIdNumber;
      if (cityIdNumber !== undefined) updateData.cityId = cityIdNumber;
      if (country !== undefined) updateData.country = country;
      if (city !== undefined) updateData.city = city;
      // Новые поля для множественного выбора
      if (countriesIdsNumbers !== undefined) updateData.countriesIds = countriesIdsNumbers;
      if (citiesIdsNumbers !== undefined) updateData.citiesIds = citiesIdsNumbers;
      if (cityNights !== undefined) updateData.cityNights = cityNights; // 🆕 Количество ночей для каждого города
      if (categoriesIdsNumbers !== undefined) updateData.categoriesIds = categoriesIdsNumbers;
      if (durationDaysNumber !== undefined) updateData.durationDays = durationDaysNumber;
      if (durationType !== undefined) updateData.durationType = durationType;
      if (format !== undefined) updateData.format = format;
      if (tourType !== undefined) updateData.tourType = tourType;
      if (priceType !== undefined) updateData.priceType = priceType;
      if (pickupInfo !== undefined) updateData.pickupInfo = pickupInfo;
      if (pickupInfoEn !== undefined) updateData.pickupInfoEn = pickupInfoEn;
      if (startTimeOptions !== undefined) updateData.startTimeOptions = startTimeOptions;
      if (languages !== undefined) updateData.languages = languages;
      if (availableMonths !== undefined) updateData.availableMonths = availableMonths;
      if (availableDays !== undefined) updateData.availableDays = availableDays;
      if (startDate !== undefined) updateData.startDate = startDate;
      if (endDate !== undefined) updateData.endDate = endDate;
      if (mainImage !== undefined) updateData.mainImage = mainImage;
      if (images !== undefined) updateData.images = images;
      if (services !== undefined) updateData.services = services;
      if (highlights !== undefined) updateData.highlights = highlights;
      if (itinerary !== undefined) updateData.itinerary = itinerary;
      if (itineraryEn !== undefined) updateData.itineraryEn = itineraryEn;
      if (includes !== undefined) updateData.includes = includes;
      if (included !== undefined) updateData.includes = included;
      if (excluded !== undefined) updateData.excluded = excluded;
      if (difficulty !== undefined) updateData.difficulty = difficulty;
      if (maxPeopleNumber !== undefined) updateData.maxPeople = maxPeopleNumber;
      if (minPeopleNumber !== undefined) updateData.minPeople = minPeopleNumber;
      if (ratingNumber !== undefined) updateData.rating = ratingNumber;
      if (reviewsCountNumber !== undefined) updateData.reviewsCount = reviewsCountNumber;
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
      if (isDraft !== undefined) {
        updateData.isDraft = isSavingDraft; // 📝 Обновляем статус черновика
        updateData.isActive = !isSavingDraft; // 📝 Черновики неактивны
      }
      // 🔥 Обновляем данные акции
      if (isPromotion !== undefined) {
        updateData.isPromotion = isPromotion === true || isPromotion === 'true';
      }
      if (discountPercent !== undefined) {
        updateData.discountPercent = parseFloat(discountPercent) || 0;
      }
      if (pricingComponents !== undefined) updateData.pricingComponents = pricingComponents;
      if (profitMarginNumber !== undefined) updateData.profitMargin = profitMarginNumber;
      if (mapPoints !== undefined) updateData.mapPoints = mapPoints; // 🗺️ Точки карты тура
      
      // Add support for assignedGuideId
      if (req.body.assignedGuideId !== undefined) {
        const assignedGuideIdNumber = req.body.assignedGuideId ? parseInt(req.body.assignedGuideId) : null;
        updateData.assignedGuideId = assignedGuideIdNumber;
      }

      const tour = await TourModel.update(id, updateData);

      if (!tour) {
        return res.status(404).json({
          success: false,
          error: 'Tour not found or could not be updated'
        });
      }

      // Update hotel associations if provided
      if (hotelIds && Array.isArray(hotelIds)) {
        console.log('🏨 Updating hotel associations:', hotelIds);
        
        // Delete existing associations
        await prisma.tourHotel.deleteMany({
          where: { tourId: id }
        });
        
        // Create new associations
        if (hotelIds.length > 0) {
          const tourHotelData = hotelIds.map(hotelId => ({
            tourId: id,
            hotelId: hotelId,
            isDefault: false
          }));
          
          await prisma.tourHotel.createMany({
            data: tourHotelData
          });
        }
      }

      // Update guide associations if provided
      if (guideIds && Array.isArray(guideIds)) {
        console.log('👨‍🏫 Updating guide associations:', guideIds);
        
        // Delete existing associations
        await prisma.tourGuide.deleteMany({
          where: { tourId: id }
        });
        
        // Create new associations
        if (guideIds.length > 0) {
          const tourGuideData = guideIds.map(guideId => ({
            tourId: id,
            guideId: guideId,
            isDefault: false
          }));
          
          await prisma.tourGuide.createMany({
            data: tourGuideData
          });
        }
      }

      // Update driver associations if provided
      if (driverIds && Array.isArray(driverIds)) {
        console.log('🚗 Updating driver associations:', driverIds);
        
        // Delete existing associations
        await prisma.tourDriver.deleteMany({
          where: { tourId: id }
        });
        
        // Create new associations
        if (driverIds.length > 0) {
          const tourDriverData = driverIds.map(driverId => ({
            tourId: id,
            driverId: driverId,
            isDefault: false
          }));
          
          await prisma.tourDriver.createMany({
            data: tourDriverData
          });
        }
      }

      // 🎯 ИСПРАВЛЕНО: Update tour block associations if provided
      if (tourBlockIds && Array.isArray(tourBlockIds)) {
        console.log('📦 Updating tour block associations:', tourBlockIds);
        
        // Delete existing tour block associations
        await prisma.tourBlockAssignment.deleteMany({
          where: { tourId: id }
        });
        
        // Create new tour block associations
        if (tourBlockIds.length > 0) {
          const tourBlockData = tourBlockIds.map((blockId: number, index: number) => ({
            tourId: id,
            tourBlockId: blockId,
            isPrimary: index === 0 // Первый блок считается основным
          }));
          
          console.log('📦 TourBlockAssignment data to create:', tourBlockData);
          
          await prisma.tourBlockAssignment.createMany({
            data: tourBlockData
          });
          
          console.log('✅ Tour block associations updated successfully');
        } else {
          console.log('📦 No tour blocks to assign, existing associations cleared');
        }
      }

      // ✅ ИСПРАВЛЕНО: Категории уже обновлены в TourModel.update() - не дублируем
      // TourModel.update() внутри транзакции обновляет связи категорий из categoriesIds
      console.log('✅ Category associations updated by TourModel.update()')

      // Parse JSON fields for response with safe parsing
      let parsedTour;
      try {
        parsedTour = {
          ...tour,
          title: safeJsonParse(tour.title),
          description: safeJsonParse(tour.description),
          // category будет загружена отдельно если нужно
        };
      } catch (jsonError) {
        console.error('Error parsing tour JSON fields:', jsonError, 'Tour ID:', tour.id);
        // Use mapTour utility for consistent fallback handling
        parsedTour = mapTour(tour, 'ru', { includeRaw: true });
      }

      const response: ApiResponse = {
        success: true,
        data: parsedTour,
        message: 'Tour updated successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      console.error('❌ Error updating tour:', error);
      
      // Detailed error logging
      if (error instanceof Error) {
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      
      if (error instanceof Error && error.message === 'Category not found') {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID'
        });
      }
      
      if (error instanceof Error && error.message === 'Tour not found') {
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Database error: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  }

  /**
   * Publish a draft tour
   * POST /api/tours/:id/publish
   */
  static async publishTour(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tour ID'
        });
      }

      // Получаем тур для проверки что он существует и является черновиком
      const existingTour = await prisma.tour.findUnique({
        where: { id }
      });

      if (!existingTour) {
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }

      if (!existingTour.isDraft) {
        return res.status(400).json({
          success: false,
          error: 'Tour is already published'
        });
      }

      // Парсим JSON поля для валидации
      let title, description;
      try {
        title = safeJsonParse(existingTour.title);
        description = safeJsonParse(existingTour.description);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid multilingual data format'
        });
      }

      // ✅ СТРОГАЯ ВАЛИДАЦИЯ перед публикацией
      if (!title || !title.ru || !title.en) {
        return res.status(400).json({
          success: false,
          error: 'Cannot publish: Title must include both Russian and English'
        });
      }

      if (!description || !description.ru || !description.en) {
        return res.status(400).json({
          success: false,
          error: 'Cannot publish: Description must include both Russian and English'
        });
      }

      // Публикуем тур (isDraft = false)
      const publishedTour = await prisma.tour.update({
        where: { id },
        data: { isDraft: false }
      });

      return res.json({
        success: true,
        data: publishedTour,
        message: 'Tour published successfully'
      });
    } catch (error) {
      console.error('Error publishing tour:', error);
      return res.status(500).json({
        success: false,
        error: 'Error publishing tour: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  }

  /**
   * Delete a tour
   * DELETE /api/tours/:id
   */
  static async deleteTour(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tour ID'
        });
      }

      // Check if tour exists
      const existingTour = await TourModel.findById(id);
      if (!existingTour) {
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }

      await TourModel.delete(id);

      const response: ApiResponse = {
        success: true,
        message: 'Tour deleted successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Duplicate a tour (copy)
   * POST /api/tours/:id/duplicate
   */
  static async duplicateTour(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tour ID'
        });
      }

      console.log('📋 Duplicating tour with ID:', id);

      const originalTour = await TourModel.findById(id);
      
      if (!originalTour) {
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }

      console.log('✅ Original tour found, creating duplicate...');

      const titleObj = safeJsonParse(originalTour.title);
      const newTitle = {
        ru: `${titleObj.ru || 'Тур'} (Копия)`,
        en: titleObj.en ? `${titleObj.en} (Copy)` : null
      };

      const newTourData: any = {
        title: newTitle,
        description: originalTour.description,
        duration: originalTour.duration,
        price: originalTour.price,
        priceType: originalTour.priceType,
        originalPrice: originalTour.originalPrice,
        categoryId: originalTour.categoryId,
        countryId: originalTour.countryId,
        cityId: originalTour.cityId,
        country: originalTour.country,
        city: originalTour.city,
        durationDays: originalTour.durationDays,
        durationType: originalTour.durationType,
        format: originalTour.format,
        tourType: originalTour.tourType,
        difficulty: originalTour.difficulty,
        maxPeople: originalTour.maxPeople,
        minPeople: originalTour.minPeople,
        mainImage: originalTour.mainImage,
        images: originalTour.images,
        services: originalTour.services,
        highlights: originalTour.highlights,
        itinerary: originalTour.itinerary,
        itineraryEn: originalTour.itineraryEn,
        includes: originalTour.includes,
        excluded: originalTour.excluded,
        pickupInfo: originalTour.pickupInfo,
        pickupInfoEn: originalTour.pickupInfoEn,
        startTimeOptions: originalTour.startTimeOptions,
        languages: originalTour.languages,
        availableMonths: originalTour.availableMonths,
        availableDays: originalTour.availableDays,
        isFeatured: false,
        isDraft: true,
        startDate: originalTour.startDate,
        endDate: originalTour.endDate,
        rating: 0,
        reviewsCount: 0
      };

      if ((originalTour as any).profitMargin !== undefined) {
        newTourData.profitMargin = (originalTour as any).profitMargin;
      }

      if ((originalTour as any).pricingComponents !== undefined) {
        newTourData.pricingComponents = (originalTour as any).pricingComponents;
      }

      if ((originalTour as any).tourCountries && (originalTour as any).tourCountries.length > 0) {
        newTourData.countriesIds = (originalTour as any).tourCountries
          .sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
          .map((tc: any) => tc.countryId);
        console.log('📍 Copying countries:', newTourData.countriesIds);
      } else if (originalTour.countryId) {
        newTourData.countryId = originalTour.countryId;
        console.log('📍 Copying single country:', originalTour.countryId);
      }

      if ((originalTour as any).tourCities && (originalTour as any).tourCities.length > 0) {
        const sortedCities = (originalTour as any).tourCities
          .sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
        
        newTourData.citiesIds = sortedCities.map((tc: any) => tc.cityId);
        
        const cityNights: Record<string, number> = {};
        sortedCities.forEach((tc: any) => {
          cityNights[tc.cityId.toString()] = tc.nightsCount || 1;
        });
        newTourData.cityNights = cityNights;
        console.log('🏙️ Copying cities:', newTourData.citiesIds, 'with nights:', cityNights);
      } else if (originalTour.cityId) {
        newTourData.cityId = originalTour.cityId;
        console.log('🏙️ Copying single city:', originalTour.cityId);
      }

      if ((originalTour as any).tourCategoryAssignments && (originalTour as any).tourCategoryAssignments.length > 0) {
        newTourData.categoriesIds = (originalTour as any).tourCategoryAssignments
          .sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
          .map((tca: any) => tca.categoryId);
        console.log('🏷️ Copying categories:', newTourData.categoriesIds);
      } else if (originalTour.categoryId) {
        newTourData.categoryId = originalTour.categoryId;
        console.log('🏷️ Copying single category:', originalTour.categoryId);
      }

      if ((originalTour as any).tourHotels && (originalTour as any).tourHotels.length > 0) {
        newTourData.hotelIds = (originalTour as any).tourHotels.map((th: any) => th.hotelId);
        console.log('🏨 Copying hotels:', newTourData.hotelIds);
      }

      if ((originalTour as any).tourGuides && (originalTour as any).tourGuides.length > 0) {
        newTourData.guideIds = (originalTour as any).tourGuides.map((tg: any) => tg.guideId);
        console.log('👨‍🏫 Copying guides:', newTourData.guideIds);
      }

      if ((originalTour as any).tourDrivers && (originalTour as any).tourDrivers.length > 0) {
        newTourData.driverIds = (originalTour as any).tourDrivers.map((td: any) => td.driverId);
        console.log('🚗 Copying drivers:', newTourData.driverIds);
      }

      if ((originalTour as any).tourBlockAssignments && (originalTour as any).tourBlockAssignments.length > 0) {
        newTourData.tourBlockIds = (originalTour as any).tourBlockAssignments
          .sort((a: any, b: any) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
          .map((tba: any) => tba.tourBlockId);
        console.log('📦 Copying tour blocks:', newTourData.tourBlockIds);
      }

      if ((originalTour as any).tourMapPoints && (originalTour as any).tourMapPoints.length > 0) {
        newTourData.mapPoints = (originalTour as any).tourMapPoints.map((tmp: any) => ({
          lat: tmp.latitude,
          lng: tmp.longitude,
          title: tmp.description || '',
          description: tmp.description || '',
          stepNumber: tmp.stepNumber
        }));
      }

      console.log('📦 Creating new tour with data:', newTourData);

      const newTour = await TourModel.create(newTourData);

      if (!newTour) {
        throw new Error('Failed to create duplicated tour');
      }

      console.log('✅ Tour duplicated successfully with ID:', newTour.id);

      const parsedTour = {
        ...newTour,
        title: safeJsonParse(newTour.title),
        description: safeJsonParse(newTour.description)
      };

      const response: ApiResponse = {
        success: true,
        data: parsedTour,
        message: 'Tour duplicated successfully'
      };

      return res.status(201).json(response);
    } catch (error) {
      console.error('❌ Error duplicating tour:', error);
      
      if (error instanceof Error) {
        console.error('❌ Error details:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      
      return res.status(500).json({
        success: false,
        error: 'Error duplicating tour: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    }
  }

  /**
   * Search tours with advanced filtering
   * GET /api/tours/search
   */
  static async searchTours(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        query,
        country, 
        city, 
        format, 
        duration, 
        theme, 
        category,
        date,
        dateFrom, 
        dateTo,
        isPromotion
      } = req.query;

      // Build filter conditions
      const filters: any[] = [];
      
      // 🔥 КРИТИЧЕСКИЙ ФИЛЬТР: Акции (isPromotion)
      if (isPromotion === 'true') {
        filters.push({ isPromotion: true });
        console.log('🔥 Filtering by isPromotion=true (Акции)');
      }

      // Text search across multiple fields
      if (query && typeof query === 'string') {
        const searchQuery = (query as string).toLowerCase().trim();
        const allTours = await TourModel.findAll();
        
        // Filter tours that match the search query
        const matchingTours = allTours.filter((tour: any) => {
          const title = safeJsonParse(tour.title);
          const description = safeJsonParse(tour.description);
          
          // Check in Russian content
          const titleRu = title.ru?.toLowerCase() || '';
          const descRu = description.ru?.toLowerCase() || '';
          const cityRu = tour.city?.toLowerCase() || '';
          const countryRu = tour.country?.toLowerCase() || '';
          
          // Check in English content  
          const titleEn = title.en?.toLowerCase() || '';
          const descEn = description.en?.toLowerCase() || '';
          
          return titleRu.includes(searchQuery) || 
                 descRu.includes(searchQuery) ||
                 titleEn.includes(searchQuery) ||
                 descEn.includes(searchQuery) ||
                 cityRu.includes(searchQuery) ||
                 countryRu.includes(searchQuery);
        });
        
        if (matchingTours.length > 0) {
          filters.push({ id: { in: matchingTours.map((t: any) => t.id) } });
        } else {
          // No matches found, return empty result
          const response: ApiResponse = {
            success: true,
            data: [],
            message: 'No tours found matching the search criteria'
          };
          return res.status(200).json(response);
        }
      }

      if (country) {
        filters.push({ country: country as string });
      }

      if (city) {
        filters.push({ city: city as string });
      }

      if (format) {
        const formats = (format as string).split(',');
        filters.push({ format: { in: formats } });
      }

      if (category) {
        const categories = (category as string).split(',');
        filters.push({ theme: { in: categories } });
      }

      if (duration) {
        const durationValue = duration as string;
        if (durationValue === '1') {
          filters.push({ durationDays: 1 });
        } else if (durationValue === '2-5') {
          filters.push({ 
            durationDays: {
              gte: 2,
              lte: 5
            }
          });
        } else if (durationValue === '6+') {
          filters.push({ 
            durationDays: {
              gte: 6
            }
          });
        }
      }

      if (theme) {
        const themes = (theme as string).split(',');
        filters.push({ theme: { in: themes } });
      }

      if (date) {
        filters.push({ startDate: { gte: date as string } });
      }

      if (dateFrom || dateTo) {
        const dateConditions: any[] = [];
        if (dateFrom) {
          dateConditions.push({ startDate: { gte: dateFrom as string } });
        }
        if (dateTo) {
          dateConditions.push({ endDate: { lte: dateTo as string } });
        }
        if (dateConditions.length > 0) {
          filters.push(...dateConditions);
        }
      }

      // Use TourModel.search with filters (or empty object for all tours)
      // IMPORTANT: Always use search() because it includes all relations needed for filtering
      const whereClause = filters.length > 0 ? { AND: filters } : {};
      console.log('🔍 [SEARCH] Filters count:', filters.length);
      const tours = await TourModel.search(whereClause);
      console.log('🔍 [SEARCH] Found tours:', tours.length);
      
      // Parse JSON fields for response
      const parsedTours = tours.map((tour: any) => ({
        ...tour,
        title: safeJsonParse(tour.title),
        description: safeJsonParse(tour.description),
        category: tour.category ? {
          ...tour.category,
          name: safeJsonParse(tour.category.name)
        } : null,
        // Парсим множественные категории
        tourCategoryAssignments: tour.tourCategoryAssignments ? tour.tourCategoryAssignments.map((tca: any) => ({
          ...tca,
          category: tca.category ? {
            ...tca.category,
            name: safeJsonParse(tca.category.name)
          } : null
        })) : []
      }));

      const response: ApiResponse = {
        success: true,
        data: parsedTours,
        message: 'Tours searched successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get search suggestions for tour search autocomplete
   * GET /api/tours/suggestions
   */
  static async getSearchSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
      }

      const searchQuery = query.toLowerCase().trim();
      
      if (searchQuery.length < 2) {
        return res.status(200).json({
          success: true,
          data: [],
          message: 'Query too short'
        });
      }

      const suggestions: Array<{text: string, textEn?: string, type: string, id?: number}> = [];
      
      // 1. Add tour suggestions
      const tours = await TourModel.findAll();
      console.log('🔍 [SUGGESTIONS] TourModel.findAll() returned:', tours.length, 'tours');
      tours.forEach((tour: any) => {
        try {
          let title: any;
          
          // Безопасная обработка поля title (может быть строкой или JSON)
          if (typeof tour.title === 'string') {
            try {
              title = safeJsonParse(tour.title);
            } catch (e) {
              // Если это обычная строка, используем её как русский заголовок
              title = { ru: tour.title, en: tour.title };
            }
          } else {
            title = tour.title;
          }
          
          // Check Russian title
          if (title.ru && title.ru.toLowerCase().includes(searchQuery)) {
            suggestions.push({
              text: title.ru,
              textEn: title.en,
              type: 'тур',
              id: tour.id
            });
          }
          
          // Check English title
          if (title.en && title.en.toLowerCase().includes(searchQuery) && title.en !== title.ru) {
            suggestions.push({
              text: title.en,
              textEn: title.en,
              type: 'тур',
              id: tour.id
            });
          }
          
        } catch (error) {
          console.error('Error processing tour title:', tour.id, error);
        }
      });

      // 2. Add country suggestions
      const countries = await prisma.country.findMany({
        where: { isActive: true }
      });
      
      countries.forEach((country: any) => {
        const nameRu = country.nameRu || '';
        const nameEn = country.nameEn || '';
        
        if (nameRu.toLowerCase().includes(searchQuery)) {
          suggestions.push({
            text: nameRu,
            textEn: nameEn,
            type: 'страна',
            id: country.id
          });
        }
        
        if (nameEn && nameEn.toLowerCase().includes(searchQuery) && nameEn !== nameRu) {
          suggestions.push({
            text: nameEn,
            textEn: nameEn,
            type: 'страна',
            id: country.id
          });
        }
      });

      // 3. Add city suggestions
      const cities = await prisma.city.findMany({
        where: { isActive: true }
      });
      
      cities.forEach((city: any) => {
        const nameRu = city.nameRu || '';
        const nameEn = city.nameEn || '';
        
        if (nameRu.toLowerCase().includes(searchQuery)) {
          suggestions.push({
            text: nameRu,
            textEn: nameEn,
            type: 'город',
            id: city.id
          });
        }
        
        if (nameEn && nameEn.toLowerCase().includes(searchQuery) && nameEn !== nameRu) {
          suggestions.push({
            text: nameEn,
            textEn: nameEn,
            type: 'город',
            id: city.id
          });
        }
      });

      // 4. Add category suggestions
      const categories = await CategoryModel.findAll();
      categories.forEach((category: any) => {
        try {
          let name: any;
          
          // Безопасная обработка поля name (может быть строкой или JSON)
          if (typeof category.name === 'string') {
            try {
              name = safeJsonParse(category.name);
            } catch (e) {
              name = { ru: category.name, en: category.name };
            }
          } else {
            name = category.name;
          }
          
          // Check Russian name
          if (name.ru && name.ru.toLowerCase().includes(searchQuery)) {
            suggestions.push({
              text: name.ru,
              textEn: name.en,
              type: 'категория',
              id: category.id
            });
          }
          
          // Check English name
          if (name.en && name.en.toLowerCase().includes(searchQuery) && name.en !== name.ru) {
            suggestions.push({
              text: name.en,
              textEn: name.en,
              type: 'категория',
              id: category.id
            });
          }
          
        } catch (error) {
          console.error('Error processing category name:', category.id, error);
        }
      });

      // 5. Add tour type suggestions
      const tourTypes = [
        { ru: 'Персональный', en: 'Individual', value: 'individual' },
        { ru: 'Групповой персональный', en: 'Private Group', value: 'group_private' },
        { ru: 'Групповой общий', en: 'Shared Group', value: 'group_shared' }
      ];
      
      tourTypes.forEach(tourType => {
        if (tourType.ru.toLowerCase().includes(searchQuery)) {
          suggestions.push({
            text: tourType.ru,
            textEn: tourType.en,
            type: 'тип тура',
            id: undefined // No ID for tour types
          });
        }
        
        if (tourType.en.toLowerCase().includes(searchQuery)) {
          suggestions.push({
            text: tourType.en,
            textEn: tourType.en,
            type: 'тип тура',
            id: undefined
          });
        }
      });

      // 6. Add hotel suggestions
      const hotels = await HotelModel.findAll();
      hotels.forEach((hotel: any) => {
        try {
          let name: any;
          
          // Безопасная обработка поля name
          if (typeof hotel.name === 'string') {
            try {
              name = safeJsonParse(hotel.name);
            } catch (e) {
              name = { ru: hotel.name, en: hotel.name };
            }
          } else {
            name = hotel.name;
          }
          
          // Check Russian name
          if (name.ru && name.ru.toLowerCase().includes(searchQuery)) {
            suggestions.push({
              text: name.ru,
              textEn: name.en,
              type: 'отель',
              id: hotel.id
            });
          }
          
          // Check English name
          if (name.en && name.en.toLowerCase().includes(searchQuery) && name.en !== name.ru) {
            suggestions.push({
              text: name.en,
              textEn: name.en,
              type: 'отель',
              id: hotel.id
            });
          }
          
        } catch (error) {
          console.error('Error processing hotel name:', hotel.id, error);
        }
      });

      // Remove duplicates and limit to 8 suggestions
      const uniqueSuggestions = suggestions
        .filter((suggestion, index, self) => 
          index === self.findIndex(s => s.text === suggestion.text && s.type === suggestion.type)
        )
        .slice(0, 8);

      const response: ApiResponse = {
        success: true,
        data: uniqueSuggestions,
        message: 'Search suggestions retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }
}

export class CategoryController {
  /**
   * Get all categories with multilingual support
   * GET /api/categories?lang=en/ru&includeRaw=true
   */
  static async getAllCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const language = getLanguageFromRequest(req);
      const includeRaw = req.query.includeRaw === 'true';
      
      const categories = await CategoryModel.findAll();
      
      // Parse JSON fields and localize content
      const localizedCategories = categories.map((category: any) => {
        if (includeRaw) {
          // ДЛЯ АДМИНКИ: возвращаем raw JSON + локализованные поля
          return {
            ...category,
            name: safeJsonParse(category.name),
            _localized: {
              name: parseMultilingualField(category.name, language)
            }
          };
        } else {
          // ДЛЯ ПУБЛИЧНОГО ИСПОЛЬЗОВАНИЯ: только локализованный контент
          return {
            ...category,
            name: parseMultilingualField(category.name, language)
          };
        }
      });

      const response = createLocalizedResponse(
        localizedCategories,
        [], // Поля уже обработаны выше
        language,
        'Categories retrieved successfully'
      );

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get a single category by ID with multilingual support
   * GET /api/categories/:id?lang=en/ru&includeRaw=true
   */
  static async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const language = getLanguageFromRequest(req);
      const includeRaw = req.query.includeRaw === 'true';
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID'
        });
      }

      const category = await CategoryModel.findById(id);
      
      if (!category) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }

      // Parse JSON fields and localize content
      let localizedCategory;
      if (includeRaw) {
        // ДЛЯ АДМИНКИ: возвращаем raw JSON + локализованные поля
        localizedCategory = {
          ...category,
          name: safeJsonParse(category.name),
          tours: category.tours?.map((tour: any) => ({
            ...tour,
            title: safeJsonParse(tour.title),
            description: safeJsonParse(tour.description)
          })),
          _localized: {
            name: parseMultilingualField(category.name, language),
            tours: category.tours?.map((tour: any) => ({
              ...tour,
              title: parseMultilingualField(tour.title, language),
              description: parseMultilingualField(tour.description, language)
            }))
          }
        };
      } else {
        // ДЛЯ ПУБЛИЧНОГО ИСПОЛЬЗОВАНИЯ: только локализованный контент
        localizedCategory = {
          ...category,
          name: parseMultilingualField(category.name, language),
          tours: category.tours?.map((tour: any) => ({
            ...tour,
            title: parseMultilingualField(tour.title, language),
            description: parseMultilingualField(tour.description, language)
          }))
        };
      }

      const response = createLocalizedResponse(
        localizedCategory,
        [], // Поля уже обработаны выше
        language,
        'Category retrieved successfully'
      );

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create a new category
   * POST /api/categories
   */
  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, title, type }: CreateCategoryData = req.body;
      
      // Support both 'name' and 'title' fields for flexibility
      const categoryName = name || title;

      // Validation
      if (!categoryName || (!categoryName.en && !categoryName.ru)) {
        return res.status(400).json({
          success: false,
          error: 'Name is required in both English and Russian'
        });
      }

      // Validate type field (only if provided)
      const categoryType = type || 'tour'; // Default to 'tour' if not provided
      if (type && type !== 'tour' && type !== 'hotel') {
        return res.status(400).json({
          success: false,
          error: 'Type must be either "tour" or "hotel"'
        });
      }

      // Ensure both languages are present
      const finalName = {
        en: categoryName.en || categoryName.ru || '',
        ru: categoryName.ru || categoryName.en || ''
      };

      const category = await CategoryModel.create({ 
        name: finalName, 
        type: categoryType 
      });

      // Parse JSON fields for response
      const parsedCategory = {
        ...category,
        name: safeJsonParse(category.name)
      };

      const response: ApiResponse = {
        success: true,
        data: parsedCategory,
        message: 'Category created successfully'
      };

      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update a category
   * PUT /api/categories/:id
   */
  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID'
        });
      }

      const { name, type } = req.body;

      // Validation for provided fields
      if (name && (!name.en || !name.ru)) {
        return res.status(400).json({
          success: false,
          error: 'Name must include both English and Russian'
        });
      }

      // Validate type field (only if provided and not empty)
      if (type !== undefined && type !== null && type !== '' && type !== 'tour' && type !== 'hotel') {
        return res.status(400).json({
          success: false,
          error: 'Type must be either "tour" or "hotel"'
        });
      }

      const updateData: Partial<CreateCategoryData> = {};
      if (name) updateData.name = name;
      if (type) updateData.type = type;

      const category = await CategoryModel.update(id, updateData);

      // Parse JSON fields for response
      const parsedCategory = {
        ...category,
        name: safeJsonParse(category.name)
      };

      const response: ApiResponse = {
        success: true,
        data: parsedCategory,
        message: 'Category updated successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete a category
   * DELETE /api/categories/:id
   */
  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID'
        });
      }

      // Check if category exists
      const existingCategory = await CategoryModel.findById(id);
      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          error: 'Category not found'
        });
      }

      await CategoryModel.delete(id);

      const response: ApiResponse = {
        success: true,
        message: 'Category deleted successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }
}

export class BookingRequestController {
  /**
   * Get all booking requests (admin)
   * GET /api/booking-requests
   */
  static async getAllBookingRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const bookingRequests = await BookingRequestModel.findAll();
      
      // Parse JSON fields for response
      const parsedBookingRequests = bookingRequests.map((request: any) => ({
        ...request,
        tour: {
          ...request.tour,
          title: safeJsonParse(request.tour.title),
          description: safeJsonParse(request.tour.description),
          category: {
            ...request.tour.category,
            name: safeJsonParse(request.tour.category.name)
          }
        }
      }));

      const response: ApiResponse = {
        success: true,
        data: parsedBookingRequests,
        message: 'Booking requests retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create a new booking request (public)
   * POST /api/booking-requests
   */
  static async createBookingRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerName, customerEmail, preferredDate, numberOfPeople, tourId }: CreateBookingRequestData = req.body;

      // Validation
      if (!customerName) {
        return res.status(400).json({
          success: false,
          error: 'Customer name is required'
        });
      }

      if (!customerEmail) {
        return res.status(400).json({
          success: false,
          error: 'Customer email is required'
        });
      }

      if (!preferredDate) {
        return res.status(400).json({
          success: false,
          error: 'Preferred date is required'
        });
      }

      if (!numberOfPeople || numberOfPeople < 1) {
        return res.status(400).json({
          success: false,
          error: 'Number of people must be at least 1'
        });
      }

      if (!tourId) {
        return res.status(400).json({
          success: false,
          error: 'Tour ID is required'
        });
      }

      const bookingRequest = await BookingRequestModel.create({
        customerName,
        customerEmail,
        preferredDate,
        numberOfPeople,
        tourId
      });

      // Parse JSON fields for response
      const parsedBookingRequest = {
        ...bookingRequest,
        tour: {
          ...bookingRequest.tour,
          title: safeJsonParse(bookingRequest.tour.title),
          description: safeJsonParse(bookingRequest.tour.description),
          category: {
            ...bookingRequest.tour.category,
            name: safeJsonParse(bookingRequest.tour.category.name)
          }
        }
      };

      // Send email notifications
      try {
        const tourTitle = parsedBookingRequest.tour.title.en || parsedBookingRequest.tour.title.ru || 'Tour';
        
        const emailData = {
          fullName: customerName,
          email: customerEmail,
          preferredDate,
          numberOfPeople,
          tourTitle
        };

        // Send notifications (non-critical - don't fail the booking if emails fail)
        const adminEmailResult = await sendAdminNotification(emailData);
        if (!adminEmailResult.success) {
          console.log('📧 Admin notification skipped:', adminEmailResult.reason);
        }

        const customerEmailResult = await sendCustomerConfirmation(emailData);
        if (!customerEmailResult.success) {
          console.log('📧 Customer confirmation skipped:', customerEmailResult.reason);
        }
        
        console.log('Email notifications initiated for booking request:', bookingRequest.id);
      } catch (emailError) {
        // Log email errors but don't fail the booking creation
        console.error('Error initiating email notifications:', emailError);
      }

      const response: ApiResponse = {
        success: true,
        data: parsedBookingRequest,
        message: 'Booking request created successfully'
      };

      return res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === 'Tour not found') {
        return res.status(400).json({
          success: false,
          error: 'Invalid tour ID'
        });
      }
      return next(error);
    }
  }
}

export class ReviewController {
  /**
   * Get all reviews (admin)
   * GET /api/reviews
   */
  static async getAllReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const reviews = await ReviewModel.findAll();
      
      // Parse JSON fields for response
      const parsedReviews = reviews.map((review: any) => ({
        ...review,
        customer: review.customer,
        tour: review.tour ? {
          ...review.tour,
          title: safeJsonParse(review.tour.title),
          description: safeJsonParse(review.tour.description),
          category: {
            ...review.tour.category,
            name: safeJsonParse(review.tour.category.name)
          }
        } : null
      }));

      const response: ApiResponse = {
        success: true,
        data: parsedReviews,
        message: 'Reviews retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Create a new review (public)
   * POST /api/reviews
   */
  static async createReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerId, rating, text, tourId, reviewerName, photos }: CreateReviewData = req.body;

      // Validation
      if (!reviewerName) {
        return res.status(400).json({
          success: false,
          error: 'Reviewer name is required'
        });
      }

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5'
        });
      }

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Review text is required'
        });
      }

      if (!tourId) {
        return res.status(400).json({
          success: false,
          error: 'Tour ID is required'
        });
      }

      const review = await ReviewModel.create({
        customerId,
        reviewerName,
        rating,
        text,
        tourId,
        photos
      });

      // Простой ответ без связанных объектов
      const parsedReview = {
        ...review,
        customerId,
        tourId,
        rating,
        text
      };

      const response: ApiResponse = {
        success: true,
        data: parsedReview,
        message: 'Review created successfully. It will be visible after moderation.'
      };

      return res.status(201).json(response);
    } catch (error) {
      if (error instanceof Error && error.message === 'Tour not found') {
        return res.status(400).json({
          success: false,
          error: 'Invalid tour ID'
        });
      }
      if (error instanceof Error && error.message === 'Rating must be between 1 and 5') {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      return next(error);
    }
  }

  /**
   * Update review moderation status (admin)
   * PUT /api/reviews/:id
   */
  static async updateReview(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid review ID'
        });
      }

      const { isModerated }: UpdateReviewData = req.body;

      if (typeof isModerated !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'isModerated must be a boolean value'
        });
      }

      const review = await ReviewModel.update(id, { isModerated });

      // Parse JSON fields for response
      const parsedReview = {
        ...review,
        tour: {
          ...review.tour,
          title: safeJsonParse(review.tour.title),
          description: safeJsonParse(review.tour.description),
          category: {
            ...review.tour.category,
            name: safeJsonParse(review.tour.category.name)
          }
        }
      };

      const response: ApiResponse = {
        success: true,
        data: parsedReview,
        message: 'Review updated successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }
}
