import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { 
  MultilingualContent, 
  CreateTourData, 
  CreateCategoryData, 
  CreateBookingRequestData, 
  CreateReviewData,
  UpdateReviewData 
} from '../types';

export class TourModel {
  /**
   * Get all tours with their categories
   */
  static async findAll() {
    return await prisma.tour.findMany({
      include: {
        category: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get a tour by ID
   */
  static async findById(id: number) {
    return await prisma.tour.findUnique({
      where: { id },
      include: {
        category: true,
        // Старые одиночные связи для совместимости
        tourCountry: true,
        tourCity: true,
        // Новые множественные связи
        tourCountries: {
          include: {
            country: true
          },
          orderBy: {
            isPrimary: 'desc' // Показываем основную страну первой
          }
        },
        tourCities: {
          include: {
            city: {
              include: {
                country: true // Включаем информацию о стране для города
              }
            }
          },
          orderBy: {
            isPrimary: 'desc' // Показываем основной город первым
          }
        },
        tourHotels: {
          include: {
            hotel: true
          }
        },
        tourGuides: {
          include: {
            guide: true
          }
        },
        tourDrivers: {
          include: {
            driver: true
          }
        },
        // 🔧 ДОБАВЛЕНО: Включаем назначенные блоки туров для админ панели
        tourBlockAssignments: {
          include: {
            tourBlock: true
          },
          orderBy: {
            isPrimary: 'desc' // Показываем основной блок первым
          }
        }
      }
    });
  }

  /**
   * Create a new tour
   */
  static async create(data: CreateTourData) {
    // Validate that the category exists
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Валидация городов относительно стран (мягкая валидация)
    if (data.citiesIds && data.countriesIds && data.citiesIds.length > 0 && data.countriesIds.length > 0) {
      const cities = await prisma.city.findMany({
        where: { 
          id: { in: data.citiesIds },
          countryId: { in: data.countriesIds }
        }
      });

      // Мягкая валидация: просто предупреждаем в консоли, но не останавливаем сохранение
      if (cities.length !== data.citiesIds.length) {
        console.warn('⚠️  Warning: Some cities may not belong to the selected countries, but allowing save to continue');
        // Не выбрасываем ошибку, позволяем сохранению продолжиться
      }
    }

    // Создаём тур и связи в транзакции
    return await prisma.$transaction(async (prisma: Prisma.TransactionClient) => {
      // Создаём основной тур
      const tour = await prisma.tour.create({
        data: {
          title: typeof data.title === 'object' ? data.title : { ru: String(data.title || ''), en: String(data.title || '') },
          description: typeof data.description === 'object' ? data.description : { ru: String(data.description || ''), en: String(data.description || '') },
          shortDesc: data.shortDescription ? (typeof data.shortDescription === 'object' ? data.shortDescription : { ru: String(data.shortDescription), en: String(data.shortDescription) }) : undefined,
          duration: String(data.duration), // Ensure duration is a string
          price: data.price,
          priceType: data.priceType || 'за человека',
          originalPrice: data.originalPrice || null,
          categoryId: data.categoryId,
          // Старые поля для совместимости (из новых массивов берём первые элементы)
          countryId: data.countriesIds && data.countriesIds.length > 0 ? data.countriesIds[0] : data.countryId || null,
          cityId: data.citiesIds && data.citiesIds.length > 0 ? data.citiesIds[0] : data.cityId || null,
          country: data.country,
          city: data.city,
          format: data.format,
          tourType: data.tourType || null,
          durationDays: data.durationDays || null,
          difficulty: data.difficulty || null,
          maxPeople: data.maxPeople || null,
          minPeople: data.minPeople || null,
          mainImage: data.mainImage || null,
          images: data.images || null,
          highlights: data.highlights || null,
          itinerary: data.itinerary || null,
          itineraryEn: data.itineraryEn || null,
          includes: data.includes || data.included || null,
          excluded: data.excluded || null,
          pickupInfo: data.pickupInfo || null,
          pickupInfoEn: data.pickupInfoEn || null,
          startTimeOptions: data.startTimeOptions || null,
          languages: data.languages || null,
          availableMonths: data.availableMonths || null,
          availableDays: data.availableDays || null,
          rating: data.rating || null,
          reviewsCount: data.reviewsCount || null,
          theme: data.theme || null,
          assignedGuideId: data.assignedGuideId || null,
          requirements: data.requirements || null,
          tags: data.tags || null,
          location: data.location || null,
          services: data.services || null,
          isFeatured: data.isFeatured || false,
          startDate: data.startDate,
          endDate: data.endDate,
          pricingData: data.pricingComponents || null
        }
      });

      // Создаём связи со странами
      if (data.countriesIds && data.countriesIds.length > 0) {
        await Promise.all(
          data.countriesIds.map((countryId, index) =>
            prisma.tourCountry.create({
              data: {
                tourId: tour.id,
                countryId: countryId,
                isPrimary: index === 0 // Первая страна считается основной
              }
            })
          )
        );
      } else if (data.countryId) {
        // Если передан только старый одиночный countryId, создаём primary связь
        await prisma.tourCountry.create({
          data: {
            tourId: tour.id,
            countryId: data.countryId,
            isPrimary: true
          }
        });
      }

      // Создаём связи с городами
      if (data.citiesIds && data.citiesIds.length > 0) {
        await Promise.all(
          data.citiesIds.map((cityId, index) =>
            prisma.tourCity.create({
              data: {
                tourId: tour.id,
                cityId: cityId,
                isPrimary: index === 0 // Первый город считается основным
              }
            })
          )
        );
      } else if (data.cityId) {
        // Если передан только старый одиночный cityId, создаём primary связь
        await prisma.tourCity.create({
          data: {
            tourId: tour.id,
            cityId: data.cityId,
            isPrimary: true
          }
        });
      }

      // Возвращаем тур с включёнными связями
      return await prisma.tour.findUnique({
        where: { id: tour.id },
        include: {
          category: true,
          tourCountries: {
            include: {
              country: true
            }
          },
          tourCities: {
            include: {
              city: {
                include: {
                  country: true
                }
              }
            }
          }
        }
      });
    });
  }

  /**
   * Update a tour
   */
  static async update(id: number, data: Partial<CreateTourData>) {
    const updateData: any = {};

    // ИСПРАВЛЕНО: Для Json columns не нужен JSON.stringify, принимаем объекты напрямую
    if (data.title) updateData.title = typeof data.title === 'object' ? data.title : { ru: String(data.title || ''), en: String(data.title || '') };
    if (data.description) updateData.description = typeof data.description === 'object' ? data.description : { ru: String(data.description || ''), en: String(data.description || '') };
    if (data.shortDescription) updateData.shortDesc = typeof data.shortDescription === 'object' ? data.shortDescription : { ru: String(data.shortDescription || ''), en: String(data.shortDescription || '') };
    else if (data.shortDescription === null) updateData.shortDesc = undefined; // Prisma Json field compatibility
    if (data.duration) updateData.duration = String(data.duration);
    if (data.price) updateData.price = data.price;
    if (data.priceType !== undefined) updateData.priceType = data.priceType;
    if (data.originalPrice !== undefined) updateData.originalPrice = data.originalPrice;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.format !== undefined) updateData.format = data.format;
    if (data.tourType !== undefined) updateData.tourType = data.tourType;
    if (data.durationDays !== undefined) updateData.durationDays = data.durationDays;
    if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
    if (data.maxPeople !== undefined) updateData.maxPeople = data.maxPeople;
    if (data.minPeople !== undefined) updateData.minPeople = data.minPeople;
    if (data.mainImage !== undefined) updateData.mainImage = data.mainImage;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.highlights !== undefined) updateData.highlights = data.highlights;
    if (data.itinerary !== undefined) updateData.itinerary = data.itinerary;
    if (data.itineraryEn !== undefined) updateData.itineraryEn = data.itineraryEn;
    if (data.includes !== undefined) updateData.includes = data.includes;
    if (data.included !== undefined) updateData.includes = data.included;
    if (data.excluded !== undefined) updateData.excluded = data.excluded;
    if (data.pickupInfo !== undefined) updateData.pickupInfo = data.pickupInfo;
    if (data.pickupInfoEn !== undefined) updateData.pickupInfoEn = data.pickupInfoEn;
    if (data.startTimeOptions !== undefined) updateData.startTimeOptions = data.startTimeOptions;
    if (data.languages !== undefined) updateData.languages = data.languages;
    if (data.availableMonths !== undefined) updateData.availableMonths = data.availableMonths;
    if (data.availableDays !== undefined) updateData.availableDays = data.availableDays;
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.reviewsCount !== undefined) updateData.reviewsCount = data.reviewsCount;
    if (data.theme !== undefined) updateData.theme = data.theme;
    if (data.requirements !== undefined) updateData.requirements = data.requirements;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.services !== undefined) updateData.services = data.services;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isDraft !== undefined) updateData.isDraft = data.isDraft;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.pricingComponents !== undefined) updateData.pricingData = data.pricingComponents;
    if (data.assignedGuideId !== undefined) updateData.assignedGuideId = data.assignedGuideId;

    // Валидация городов относительно стран (мягкая валидация)
    if (data.citiesIds && data.countriesIds && data.citiesIds.length > 0 && data.countriesIds.length > 0) {
      const cities = await prisma.city.findMany({
        where: { 
          id: { in: data.citiesIds },
          countryId: { in: data.countriesIds }
        }
      });

      // Мягкая валидация: просто предупреждаем в консоли, но не останавливаем сохранение
      if (cities.length !== data.citiesIds.length) {
        console.warn('⚠️  Warning: Some cities may not belong to the selected countries, but allowing save to continue');
        // Не выбрасываем ошибку, позволяем сохранению продолжиться
      }
    }

    if (data.categoryId) {
      // Validate that the category exists
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId }
      });
      if (!category) {
        throw new Error('Category not found');
      }
      updateData.categoryId = data.categoryId;
    }

    // Обновляем старые поля для совместимости
    if (data.countriesIds && data.countriesIds.length > 0) {
      updateData.countryId = data.countriesIds[0];
    } else if (data.countryId !== undefined) {
      updateData.countryId = data.countryId;
    }

    if (data.citiesIds && data.citiesIds.length > 0) {
      updateData.cityId = data.citiesIds[0];
    } else if (data.cityId !== undefined) {
      updateData.cityId = data.cityId;
    }

    return await prisma.$transaction(async (prisma: Prisma.TransactionClient) => {
      // Обновляем основные поля тура
      const updatedTour = await prisma.tour.update({
        where: { id },
        data: updateData
      });

      // Обновляем связи со странами, если переданы новые массивы
      if (data.countriesIds !== undefined) {
        // Удаляем старые связи
        await prisma.tourCountry.deleteMany({
          where: { tourId: id }
        });

        // Создаём новые связи
        if (data.countriesIds.length > 0) {
          await Promise.all(
            data.countriesIds.map((countryId, index) =>
              prisma.tourCountry.create({
                data: {
                  tourId: id,
                  countryId: countryId,
                  isPrimary: index === 0 // Первая страна считается основной
                }
              })
            )
          );
        }
      } else if (data.countryId !== undefined && data.countryId !== null) {
        // Если передан только старый одиночный countryId, обновляем/создаём primary связь
        const existingCountryLink = await prisma.tourCountry.findFirst({
          where: { tourId: id, isPrimary: true }
        });

        if (existingCountryLink && existingCountryLink.countryId !== data.countryId) {
          // Обновляем существующую primary связь
          await prisma.tourCountry.update({
            where: { id: existingCountryLink.id },
            data: { countryId: data.countryId }
          });
        } else if (!existingCountryLink) {
          // Создаём новую primary связь
          await prisma.tourCountry.create({
            data: {
              tourId: id,
              countryId: data.countryId,
              isPrimary: true
            }
          });
        }
      }

      // Обновляем связи с городами, если переданы новые массивы
      if (data.citiesIds !== undefined) {
        // Удаляем старые связи
        await prisma.tourCity.deleteMany({
          where: { tourId: id }
        });

        // Создаём новые связи
        if (data.citiesIds.length > 0) {
          await Promise.all(
            data.citiesIds.map((cityId, index) =>
              prisma.tourCity.create({
                data: {
                  tourId: id,
                  cityId: cityId,
                  isPrimary: index === 0 // Первый город считается основным
                }
              })
            )
          );
        }
      } else if (data.cityId !== undefined && data.cityId !== null) {
        // Если передан только старый одиночный cityId, обновляем/создаём primary связь
        const existingCityLink = await prisma.tourCity.findFirst({
          where: { tourId: id, isPrimary: true }
        });

        if (existingCityLink && existingCityLink.cityId !== data.cityId) {
          // Обновляем существующую primary связь
          await prisma.tourCity.update({
            where: { id: existingCityLink.id },
            data: { cityId: data.cityId }
          });
        } else if (!existingCityLink) {
          // Создаём новую primary связь
          await prisma.tourCity.create({
            data: {
              tourId: id,
              cityId: data.cityId,
              isPrimary: true
            }
          });
        }
      }

      // Возвращаем обновлённый тур с включёнными связями
      return await prisma.tour.findUnique({
        where: { id },
        include: {
          category: true,
          tourCountries: {
            include: {
              country: true
            },
            orderBy: {
              isPrimary: 'desc'
            }
          },
          tourCities: {
            include: {
              city: {
                include: {
                  country: true
                }
              }
            },
            orderBy: {
              isPrimary: 'desc'
            }
          }
        }
      });
    });
  }

  /**
   * Delete a tour
   */
  static async delete(id: number) {
    return await prisma.tour.delete({
      where: { id }
    });
  }

  /**
   * Search tours with filters
   */
  static async search(filters: any = {}) {
    return await prisma.tour.findMany({
      where: filters,
      include: {
        category: true,
        tourCountry: true,
        tourCity: true,
        tourCategoryAssignments: {
          include: {
            category: true
          },
          orderBy: {
            isPrimary: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}

export class CategoryModel {
  /**
   * Get all categories
   */
  static async findAll() {
    return await prisma.category.findMany({
      include: {
        _count: {
          select: { tours: true }
        }
      },
      orderBy: {
        id: 'asc'
      }
    });
  }

  /**
   * Get a category by ID
   */
  static async findById(id: number) {
    return await prisma.category.findUnique({
      where: { id },
      include: {
        tours: true,
        _count: {
          select: { tours: true }
        }
      }
    });
  }

  /**
   * Create a new category
   */
  static async create(data: CreateCategoryData) {
    return await prisma.category.create({
      data: {
        name: JSON.stringify(data.name)
      }
    });
  }

  /**
   * Update a category
   */
  static async update(id: number, data: Partial<CreateCategoryData>) {
    const updateData: any = {};
    if (data.name) updateData.name = JSON.stringify(data.name);

    return await prisma.category.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * Delete a category
   */
  static async delete(id: number) {
    return await prisma.category.delete({
      where: { id }
    });
  }
}

export class BookingRequestModel {
  /**
   * Get all booking requests with tour information
   */
  static async findAll() {
    return await prisma.bookingRequest.findMany({
      include: {
        tour: {
          include: {
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get a booking request by ID
   */
  static async findById(id: number) {
    return await prisma.bookingRequest.findUnique({
      where: { id },
      include: {
        tour: {
          include: {
            category: true
          }
        }
      }
    });
  }

  /**
   * Create a new booking request
   */
  static async create(data: CreateBookingRequestData) {
    // Validate that the tour exists
    const tour = await prisma.tour.findUnique({
      where: { id: data.tourId }
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    return await prisma.bookingRequest.create({
      data: {
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        preferredDate: data.preferredDate,
        numberOfPeople: data.numberOfPeople,
        tourId: data.tourId
      },
      include: {
        tour: {
          include: {
            category: true
          }
        }
      }
    });
  }

  /**
   * Delete a booking request
   */
  static async delete(id: number) {
    return await prisma.bookingRequest.delete({
      where: { id }
    });
  }
}

export class TourBlockModel {
  /**
   * Get all tour blocks
   */
  static async findAll() {
    return await prisma.tourBlock.findMany({
      include: {
        tourBlocks: {
          include: {
            tour: {
              include: {
                category: true
              }
            }
          }
        }
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });
  }

  /**
   * Get a tour block by ID
   */
  static async findById(id: number) {
    return await prisma.tourBlock.findUnique({
      where: { id },
      include: {
        tourBlocks: {
          include: {
            tour: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Create a new tour block
   */
  static async create(data: any) {
    return await prisma.tourBlock.create({
      data: {
        title: JSON.stringify(data.title),
        description: JSON.stringify(data.description),
        slug: data.slug,
        sortOrder: data.sortOrder
      }
    });
  }

  /**
   * Update a tour block
   */
  static async update(id: number, data: any) {
    const updateData: any = {};
    if (data.title) updateData.title = JSON.stringify(data.title);
    if (data.description) updateData.description = JSON.stringify(data.description);
    if (data.slug) updateData.slug = data.slug;
    if (data.sortOrder) updateData.sortOrder = data.sortOrder;

    return await prisma.tourBlock.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * Delete a tour block
   */
  static async delete(id: number) {
    return await prisma.tourBlock.delete({
      where: { id }
    });
  }
}

export class HotelModel {
  /**
   * Get all hotels
   */
  static async findAll() {
    const hotels = await prisma.hotel.findMany({
      // 📝 Убран фильтр isActive для админ панели - возвращаем все отели (включая черновики)
      include: {
        hotelCountry: true,
        hotelCity: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return hotels.map((hotel: any) => ({
      ...hotel,
      name: typeof hotel.name === 'string' ? (() => { try { return JSON.parse(hotel.name); } catch { return { ru: hotel.name, en: hotel.name }; } })() : hotel.name,
      description: hotel.description && typeof hotel.description === 'string' ? (() => { try { return JSON.parse(hotel.description); } catch { return { ru: hotel.description, en: hotel.description }; } })() : hotel.description,
      images: hotel.images && typeof hotel.images === 'string' ? (() => { try { return JSON.parse(hotel.images); } catch { return []; } })() : (hotel.images || []),
      amenities: hotel.amenities && typeof hotel.amenities === 'string' ? (() => { try { return JSON.parse(hotel.amenities); } catch { return []; } })() : (hotel.amenities || [])
    }));
  }

  /**
   * Get hotels for a specific tour
   */
  static async findByTourId(tourId: number) {
    const tourHotels = await prisma.tourHotel.findMany({
      where: { tourId },
      include: {
        hotel: true
      },
      orderBy: [
        { isDefault: 'desc' },
        { hotel: { name: 'asc' } }
      ]
    });

    return tourHotels.map((th: any) => ({
      ...th.hotel,
      name: typeof th.hotel.name === 'string' ? (() => { try { return JSON.parse(th.hotel.name); } catch { return { ru: th.hotel.name, en: th.hotel.name }; } })() : th.hotel.name,
      description: th.hotel.description && typeof th.hotel.description === 'string' ? (() => { try { return JSON.parse(th.hotel.description); } catch { return { ru: th.hotel.description, en: th.hotel.description }; } })() : th.hotel.description,
      images: th.hotel.images && typeof th.hotel.images === 'string' ? (() => { try { return JSON.parse(th.hotel.images); } catch { return []; } })() : (th.hotel.images || []),
      amenities: th.hotel.amenities && typeof th.hotel.amenities === 'string' ? (() => { try { return JSON.parse(th.hotel.amenities); } catch { return []; } })() : (th.hotel.amenities || []),
      pricePerNight: th.pricePerNight,
      isDefault: th.isDefault
    }));
  }

  /**
   * Get a hotel by ID
   */
  static async findById(id: number) {
    const hotel = await prisma.hotel.findUnique({
      where: { id },
      include: {
        hotelCountry: true,
        hotelCity: true,
        tourHotels: {
          include: {
            tour: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    });

    if (!hotel) return null;

    return {
      ...hotel,
      name: typeof hotel.name === 'string' ? (() => { try { return JSON.parse(hotel.name); } catch { return { ru: hotel.name, en: hotel.name }; } })() : hotel.name,
      description: hotel.description && typeof hotel.description === 'string' ? (() => { try { return JSON.parse(hotel.description); } catch { return { ru: hotel.description, en: hotel.description }; } })() : hotel.description,
      images: hotel.images && typeof hotel.images === 'string' ? (() => { try { return JSON.parse(hotel.images); } catch { return []; } })() : (hotel.images || []),
      amenities: hotel.amenities && typeof hotel.amenities === 'string' ? (() => { try { return JSON.parse(hotel.amenities); } catch { return []; } })() : (hotel.amenities || []),
      tourHotels: hotel.tourHotels.map((th: any) => ({
        ...th,
        tour: {
          ...th.tour,
          title: typeof th.tour.title === 'string' ? JSON.parse(th.tour.title) : th.tour.title
        }
      }))
    };
  }

  /**
   * Create a new hotel
   */
  static async create(data: any) {
    // Parse multilingual fields properly using the same safeJsonParse utility
    const parsedName = data.name ? (() => {
      try {
        return typeof data.name === 'string' ? JSON.parse(data.name) : data.name;
      } catch {
        return typeof data.name === 'object' ? data.name : { ru: data.name, en: data.name };
      }
    })() : { ru: '', en: '' };
    
    const parsedDescription = data.description ? (() => {
      try {
        return typeof data.description === 'string' ? JSON.parse(data.description) : data.description;
      } catch {
        return typeof data.description === 'object' ? data.description : { ru: data.description, en: data.description };
      }
    })() : null;
    
    return await prisma.hotel.create({
      data: {
        name: parsedName,
        description: parsedDescription,
        images: data.images ? (typeof data.images === 'string' ? data.images : JSON.stringify(data.images)) : null,
        address: data.address,
        rating: data.rating ? parseFloat(data.rating) : null,
        stars: data.stars ? parseInt(data.stars) : null,
        brand: data.brand || null,
        category: data.category || null,
        countryId: data.countryId ? parseInt(data.countryId) : null,
        cityId: data.cityId ? parseInt(data.cityId) : null,
        country: data.country || null,
        city: data.city || null,
        pension: data.pension || 'none',
        amenities: data.amenities ? (typeof data.amenities === 'string' ? data.amenities : JSON.stringify(data.amenities)) : null,
        roomTypes: data.roomTypes ? (typeof data.roomTypes === 'string' ? data.roomTypes : JSON.stringify(data.roomTypes)) : null, // Категории номеров с ценами
        mealTypes: data.mealTypes ? (typeof data.mealTypes === 'string' ? data.mealTypes : JSON.stringify(data.mealTypes)) : null, // НОВОЕ: Типы питания с ценами
        isActive: data.isActive !== undefined ? data.isActive : true,
        isDraft: data.isDraft !== undefined ? data.isDraft : false // 📝 Поддержка черновиков
      }
    });
  }

  /**
   * Update a hotel
   */
  static async update(id: number, data: any) {
    const updateData: any = {};
    
    if (data.name) {
      updateData.name = (() => {
        try {
          return typeof data.name === 'string' ? JSON.parse(data.name) : data.name;
        } catch {
          return typeof data.name === 'object' ? data.name : { ru: data.name, en: data.name };
        }
      })();
    }
    if (data.description) {
      updateData.description = (() => {
        try {
          return typeof data.description === 'string' ? JSON.parse(data.description) : data.description;
        } catch {
          return typeof data.description === 'object' ? data.description : { ru: data.description, en: data.description };
        }
      })();
    }
    if (data.images) updateData.images = typeof data.images === 'string' ? data.images : JSON.stringify(data.images);
    if (data.address) updateData.address = data.address;
    if (data.rating !== undefined) updateData.rating = parseFloat(data.rating);
    if (data.stars !== undefined) updateData.stars = data.stars ? parseInt(data.stars) : null;
    if (data.brand !== undefined) updateData.brand = data.brand;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.countryId !== undefined) updateData.countryId = data.countryId ? parseInt(data.countryId) : null;
    if (data.cityId !== undefined) updateData.cityId = data.cityId ? parseInt(data.cityId) : null;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.pension !== undefined) updateData.pension = data.pension;
    if (data.amenities) updateData.amenities = typeof data.amenities === 'string' ? data.amenities : JSON.stringify(data.amenities);
    if (data.roomTypes) updateData.roomTypes = typeof data.roomTypes === 'string' ? data.roomTypes : JSON.stringify(data.roomTypes); // Категории номеров с ценами
    if (data.mealTypes) updateData.mealTypes = typeof data.mealTypes === 'string' ? data.mealTypes : JSON.stringify(data.mealTypes); // НОВОЕ: Типы питания с ценами
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.isDraft !== undefined) updateData.isDraft = data.isDraft; // 📝 Поддержка черновиков

    const hotel = await prisma.hotel.findUnique({ where: { id } });
    if (!hotel) return null;

    return await prisma.hotel.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * Delete a hotel
   */
  static async delete(id: number) {
    const hotel = await prisma.hotel.findUnique({ where: { id } });
    if (!hotel) return false;

    await prisma.hotel.delete({ where: { id } });
    return true;
  }

  /**
   * Add hotel to tour
   */
  static async addToTour(tourId: number, hotelId: number, pricePerNight?: number, isDefault: boolean = false) {
    return await prisma.tourHotel.create({
      data: {
        tourId,
        hotelId,
        pricePerNight,
        isDefault
      }
    });
  }

  /**
   * Remove hotel from tour
   */
  static async removeFromTour(tourId: number, hotelId: number) {
    const tourHotel = await prisma.tourHotel.findUnique({
      where: {
        tourId_hotelId: {
          tourId,
          hotelId
        }
      }
    });

    if (!tourHotel) return false;

    await prisma.tourHotel.delete({
      where: {
        tourId_hotelId: {
          tourId,
          hotelId
        }
      }
    });

    return true;
  }
}

export class TransferRequestModel {
  /**
   * Get all transfer requests with assigned driver information
   */
  static async findAll() {
    return await (prisma as any).transferRequest.findMany({
      include: {
        assignedDriver: {
          select: {
            id: true,
            name: true,
            vehicleTypes: true,
            contact: true,
            description: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get a transfer request by ID
   */
  static async findById(id: number) {
    return await prisma.transferRequest.findUnique({
      where: { id },
      include: {
        assignedDriver: {
          select: {
            id: true,
            name: true,
            vehicleTypes: true,
            contact: true,
            description: true
          }
        }
      }
    });
  }

  /**
   * Create a new transfer request
   */
  static async create(data: any) {
    return await prisma.transferRequest.create({
      data: {
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        pickupTime: data.pickupTime,
        pickupDate: data.pickupDate,
        numberOfPeople: data.numberOfPeople || 1,
        vehicleType: data.vehicleType || null,
        specialRequests: data.specialRequests || null
      },
      include: {
        assignedDriver: {
          select: {
            id: true,
            name: true,
            vehicleTypes: true,
            contact: true,
            description: true
          }
        }
      }
    });
  }

  /**
   * Update a transfer request
   */
  static async update(id: number, data: any) {
    const updateData: any = {};
    
    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.pickupLocation !== undefined) updateData.pickupLocation = data.pickupLocation;
    if (data.dropoffLocation !== undefined) updateData.dropoffLocation = data.dropoffLocation;
    if (data.pickupTime !== undefined) updateData.pickupTime = data.pickupTime;
    if (data.pickupDate !== undefined) updateData.pickupDate = data.pickupDate;
    if (data.numberOfPeople !== undefined) updateData.numberOfPeople = data.numberOfPeople;
    if (data.vehicleType !== undefined) updateData.vehicleType = data.vehicleType;
    if (data.specialRequests !== undefined) updateData.specialRequests = data.specialRequests;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.adminNotes !== undefined) updateData.adminNotes = data.adminNotes;
    if (data.estimatedPrice !== undefined) updateData.estimatedPrice = data.estimatedPrice;
    if (data.finalPrice !== undefined) updateData.finalPrice = data.finalPrice;
    if (data.assignedDriverId !== undefined) updateData.assignedDriverId = data.assignedDriverId;

    return await prisma.transferRequest.update({
      where: { id },
      data: updateData,
      include: {
        assignedDriver: {
          select: {
            id: true,
            name: true,
            vehicleTypes: true,
            contact: true,
            description: true
          }
        }
      }
    });
  }

  /**
   * Delete a transfer request
   */
  static async delete(id: number) {
    return await prisma.transferRequest.delete({
      where: { id }
    });
  }

  /**
   * Get transfer requests by status
   */
  static async findByStatus(status: string) {
    return await (prisma as any).transferRequest.findMany({
      where: { status },
      include: {
        assignedDriver: {
          select: {
            id: true,
            name: true,
            vehicleTypes: true,
            contact: true,
            description: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Approve transfer request
   */
  static async approve(id: number, adminNotes?: string, finalPrice?: number, assignedDriverId?: number) {
    const updateData: any = {
      status: 'approved',
      adminNotes: adminNotes || null,
      finalPrice: finalPrice || null,
      assignedDriverId: assignedDriverId || null
    };

    return await prisma.transferRequest.update({
      where: { id },
      data: updateData,
      include: {
        assignedDriver: {
          select: {
            id: true,
            name: true,
            vehicleTypes: true,
            contact: true,
            description: true
          }
        }
      }
    });
  }

  /**
   * Reject transfer request
   */
  static async reject(id: number, adminNotes?: string) {
    return await prisma.transferRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        adminNotes: adminNotes || null
      },
      include: {
        assignedDriver: {
          select: {
            id: true,
            name: true,
            vehicleTypes: true,
            contact: true,
            description: true
          }
        }
      }
    });
  }
}

export class PriceCalculatorModel {
  /**
   * Get all pricing components
   */
  static async findAll() {
    return await prisma.priceCalculatorComponent.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  /**
   * Get pricing component by key
   */
  static async findByKey(key: string) {
    return await prisma.priceCalculatorComponent.findUnique({
      where: { key }
    });
  }

  /**
   * Create a new pricing component
   */
  static async create(data: any) {
    return await prisma.priceCalculatorComponent.create({
      data: {
        key: data.key,
        category: data.category,
        name: data.name,
        nameEn: data.nameEn || null,
        price: data.price,
        unit: data.unit,
        description: data.description || null,
        sortOrder: data.sortOrder || 0
      }
    });
  }

  /**
   * Update a pricing component
   */
  static async update(id: number, data: any) {
    return await prisma.priceCalculatorComponent.update({
      where: { id },
      data: {
        name: data.name,
        nameEn: data.nameEn,
        price: data.price,
        unit: data.unit,
        description: data.description,
        sortOrder: data.sortOrder,
        isActive: data.isActive
      }
    });
  }

  /**
   * Delete a pricing component
   */
  static async delete(id: number) {
    return await prisma.priceCalculatorComponent.delete({
      where: { id }
    });
  }

  /**
   * Initialize default pricing components
   */
  static async initializeDefaults() {
    const defaultComponents = [
      // Тур-гид
      { key: 'guide_daily', category: 'guides', name: 'Тур-гид, день', nameEn: 'Tour Guide, Daily', price: 500.0, unit: 'единица', sortOrder: 1 },
      { key: 'guide_vip', category: 'guides', name: 'Тур-гид, VIP', nameEn: 'VIP Tour Guide', price: 1000.0, unit: 'единица', sortOrder: 2 },
      { key: 'guide_regional', category: 'guides', name: 'Тур-гид, региональный', nameEn: 'Regional Tour Guide', price: 600.0, unit: 'единица', sortOrder: 3 },
      
      // Питание  
      { key: 'meals_lunch_hb', category: 'meals', name: 'Питание, обед, НВ', nameEn: 'Meals, Lunch, HB', price: 70.0, unit: 'человек/день', sortOrder: 1 },
      { key: 'meals_lunch_dinner_fb', category: 'meals', name: 'Питание, обед и ужин, FB', nameEn: 'Meals, Lunch & Dinner, FB', price: 130.0, unit: 'человек/день', sortOrder: 2 },
      
      // Разрешения
      { key: 'permit_gbao', category: 'permits', name: 'Разрешение на въезд в ГБАО', nameEn: 'GBAO Entry Permit', price: 250.0, unit: 'человек', sortOrder: 1 },
      { key: 'permit_nurek_gas', category: 'permits', name: 'Разрешение на въезд на платину Нурекской ГЭС', nameEn: 'Nurek HPP Dam Entry Permit', price: 450.0, unit: 'человек', sortOrder: 2 },
      
      // Автомобили на местные рейсы
      { key: 'local_car_general', category: 'local_transport', name: 'Автомобиль на местные рейсы', nameEn: 'Car for Local Trips', price: 130.0, unit: 'человек/час', sortOrder: 1 },
      { key: 'tickets_uzbekistan', category: 'local_transport', name: 'Билеты в АД по Узбекистану', nameEn: 'Bus Tickets in Uzbekistan', price: 380.0, unit: 'человек/час', sortOrder: 2 },
      { key: 'tickets_kamenny_rudnik', category: 'local_transport', name: 'Внутренние билеты в Каменное Рудник, Пенджакент', nameEn: 'Domestic Tickets to Kamennoe Rudnik, Penjikent', price: 40.0, unit: 'человек/час', sortOrder: 3 },
      { key: 'tickets_kumi_dushanbe', category: 'local_transport', name: 'Внутренние билеты в куми Душанбе', nameEn: 'Domestic Tickets to Kumi Dushanbe', price: 160.0, unit: 'человек/час', sortOrder: 4 },
      { key: 'tickets_boytov', category: 'local_transport', name: 'Внутренние билеты в области / Бойтов', nameEn: 'Domestic Tickets to Region / Boytov', price: 40.0, unit: 'человек/час', sortOrder: 5 },
      { key: 'tickets_lesgo', category: 'local_transport', name: 'Внутренние билеты в области / Лесго', nameEn: 'Domestic Tickets to Region / Lesgo', price: 90.0, unit: 'человек/час', sortOrder: 6 },
      { key: 'tickets_arzanak', category: 'local_transport', name: 'Внутренние билеты в области / Арзанак, РР не для объектов 3-5 звд пол', nameEn: 'Domestic Tickets to Region / Arzanak', price: 250.0, unit: 'человек/час', sortOrder: 7 },
      { key: 'tickets_istegovshan', category: 'local_transport', name: 'Внутренние билеты в области / Истеговшан', nameEn: 'Domestic Tickets to Region / Istegovshan', price: 50.0, unit: 'человек/час', sortOrder: 8 },
      { key: 'tickets_khuron', category: 'local_transport', name: 'Внутренние билеты в области / Хурон', nameEn: 'Domestic Tickets to Region / Khuron', price: 450.0, unit: 'человек/час', sortOrder: 9 },
      { key: 'tickets_pendjikent', category: 'local_transport', name: 'Внутренние билеты в области / Пенджакент', nameEn: 'Domestic Tickets to Region / Penjikent', price: 600.0, unit: 'человек/час', sortOrder: 10 },
      { key: 'tickets_dushanbe_4h', category: 'local_transport', name: 'Внутренние билеты в области / Душанбе, РР не для объектов до 4 часа', nameEn: 'Domestic Tickets to Region / Dushanbe', price: 120.0, unit: 'человек/час', sortOrder: 11 },
      { key: 'tickets_iskandarun', category: 'local_transport', name: 'Внутренние билеты в области озеро Исканадарлун', nameEn: 'Domestic Tickets to Iskanderkul Lake', price: 30.0, unit: 'человек/час', sortOrder: 12 },
      { key: 'tickets_aktim', category: 'local_transport', name: 'Внутренние билеты в области рог Актим', nameEn: 'Domestic Tickets to Aktim Pass', price: 40.0, unit: 'человек/час', sortOrder: 13 },
      { key: 'tickets_tsar', category: 'local_transport', name: 'Внутренние билеты в области ЦАР', nameEn: 'Domestic Tickets to CAR', price: 200.0, unit: 'человек/час', sortOrder: 14 },
      
      // Трансфер
      { key: 'transfer_minivan_bus', category: 'transfer', name: 'Трансфер минивэн/автобус сроки отдыха здоровогопорога', nameEn: 'Transfer Minivan/Bus', price: 2000.0, unit: 'единица/день', sortOrder: 1 },
      { key: 'transfer_light_rest', category: 'transfer', name: 'Трансфер легкие отдых здоровогопорога', nameEn: 'Light Transfer', price: 1500.0, unit: 'единица/день', sortOrder: 2 },
      
      // Транспорт по время туза  
      { key: 'transport_tour_4wd', category: 'tour_transport', name: 'Транспорт по время туза, 4WD', nameEn: 'Transport During Tour, 4WD', price: 1500.0, unit: 'единица/день', sortOrder: 1 },
      { key: 'transport_tour_car', category: 'tour_transport', name: 'Транспорт по время туза, легковые', nameEn: 'Transport During Tour, Car', price: 400.0, unit: 'единица/день', sortOrder: 2 },
      { key: 'transport_tour_minibus', category: 'tour_transport', name: 'Транспорт по время туза, минивэнбус', nameEn: 'Transport During Tour, Minibus', price: 2000.0, unit: 'единица/день', sortOrder: 3 },
      
      // Проживание (специальный компонент с динамической логикой)
      { key: 'accommodation_std', category: 'accommodation', name: 'Проживание, STD', nameEn: 'Accommodation, STD', price: 800.0, unit: 'человек/день', sortOrder: 1 }
    ];

    const results = [];
    for (const component of defaultComponents) {
      try {
        const existing = await this.findByKey(component.key);
        if (!existing) {
          const created = await this.create(component);
          results.push(created);
        } else {
          // Обновляем существующие компоненты с английскими названиями
          const updated = await prisma.priceCalculatorComponent.update({
            where: { key: component.key },
            data: {
              nameEn: component.nameEn
            }
          });
          results.push(updated);
        }
      } catch (error) {
        console.error(`Error creating/updating component ${component.key}:`, error);
      }
    }
    return results;
  }
}

export class ReviewModel {
  /**
   * Get all reviews with tour information
   */
  static async findAll() {
    return await prisma.review.findMany({
      include: {
        customer: true,
        tour: {
          include: {
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get moderated reviews for public display
   */
  static async findModerated() {
    return await prisma.review.findMany({
      where: {
        isModerated: true,
        isApproved: true
      },
      include: {
        customer: true,
        tour: {
          include: {
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get reviews for a specific tour
   */
  static async findByTourId(tourId: number) {
    return await prisma.review.findMany({
      where: {
        tourId,
        isModerated: true,
        isApproved: true
      },
      include: {
        customer: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get a review by ID
   */
  static async findById(id: number) {
    return await prisma.review.findUnique({
      where: { id },
      include: {
        customer: true,
        tour: {
          include: {
            category: true
          }
        }
      }
    });
  }

  /**
   * Create a new review
   */
  static async create(data: CreateReviewData) {
    // Validate that the tour exists
    const tour = await prisma.tour.findUnique({
      where: { id: data.tourId }
    });

    if (!tour) {
      throw new Error('Tour not found');
    }

    // Validate rating is between 1 and 5
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    return await prisma.review.create({
      data: {
        customerId: data.customerId || null,
        reviewerName: data.reviewerName,
        rating: data.rating,
        text: data.text,
        tourId: data.tourId,
        photos: data.photos ? JSON.stringify(data.photos) : null
      },
      include: {
        customer: true,
        tour: {
          include: {
            category: true
          }
        }
      }
    });
  }

  /**
   * Update a review (mainly for moderation)
   */
  static async update(id: number, data: UpdateReviewData) {
    return await prisma.review.update({
      where: { id },
      data,
      include: {
        customer: true,
        tour: {
          include: {
            category: true
          }
        }
      }
    });
  }

  /**
   * Delete a review
   */
  static async delete(id: number) {
    return await prisma.review.delete({
      where: { id }
    });
  }
}
