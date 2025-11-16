// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Get all custom tour cities for a specific country (Admin)
 * GET /api/admin/custom-tour/countries/:countryId/cities
 */
export const getCitiesByCountry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { countryId } = req.params;
    
    const cities = await prisma.customTourCity.findMany({
      where: { 
        countryId: parseInt(countryId),
      },
      include: {
        city: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          }
        },
        country: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json({
      success: true,
      data: cities,
    });
  } catch (error) {
    console.error('❌ Error fetching custom tour cities:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке городов'
    });
  }
};

/**
 * Get all custom tour cities (public endpoint for frontend form)
 * GET /api/custom-tour/cities
 */
export const getAllCities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { countryId } = req.query;
    
    const where: any = {
      is_active: true,
    };
    
    if (countryId && typeof countryId === 'string') {
      where.countryId = parseInt(countryId);
    }
    
    const cities = await prisma.customTourCity.findMany({
      where,
      include: {
        city: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          }
        }
      },
      orderBy: { 
        city: {
          nameRu: 'asc'
        }
      },
    });
    
    res.json({
      success: true,
      data: cities,
    });
  } catch (error) {
    console.error('❌ Error fetching custom tour cities:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке городов'
    });
  }
};

/**
 * Create a new custom tour city (Admin only)
 * POST /api/admin/custom-tour/countries/:countryId/cities
 */
export const createCity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { countryId } = req.params;
    const { cityId, daysCount } = req.body;
    
    // Validation
    if (!cityId || typeof cityId !== 'number' || !Number.isInteger(cityId)) {
      res.status(400).json({
        success: false,
        message: 'ID города обязателен и должен быть числом'
      });
      return;
    }
    
    if (!daysCount || typeof daysCount !== 'number' || !Number.isInteger(daysCount) || daysCount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Количество дней обязательно и должно быть положительным числом'
      });
      return;
    }
    
    // Check if city exists
    const cityExists = await prisma.city.findUnique({
      where: { id: cityId }
    });
    
    if (!cityExists) {
      res.status(404).json({
        success: false,
        message: 'Город не найден'
      });
      return;
    }
    
    // Check if city belongs to the specified country
    if (cityExists.countryId !== parseInt(countryId)) {
      res.status(400).json({
        success: false,
        message: 'Город не принадлежит указанной стране'
      });
      return;
    }
    
    // Check for duplicate
    const existing = await prisma.customTourCity.findFirst({
      where: {
        countryId: parseInt(countryId),
        cityId: cityId
      }
    });
    
    if (existing) {
      res.status(409).json({
        success: false,
        message: 'Этот город уже добавлен для данной страны'
      });
      return;
    }
    
    const customCity = await prisma.customTourCity.create({
      data: {
        countryId: parseInt(countryId),
        cityId,
        daysCount,
        is_active: true,
      },
      include: {
        city: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          }
        }
      }
    });
    
    console.log('✅ Custom tour city created:', customCity.id);
    
    res.status(201).json({
      success: true,
      data: customCity,
      message: 'Город успешно добавлен'
    });
  } catch (error) {
    console.error('❌ Error creating custom tour city:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании города'
    });
  }
};

/**
 * Update a custom tour city (Admin only)
 * PUT /api/admin/custom-tour/cities/:id
 */
export const updateCity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { daysCount, isActive } = req.body;
    
    const updateData: any = {};
    
    if (daysCount !== undefined) {
      if (typeof daysCount !== 'number' || !Number.isInteger(daysCount) || daysCount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Количество дней должно быть положительным числом'
        });
        return;
      }
      updateData.daysCount = daysCount;
    }
    
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'Неверный формат статуса активности'
        });
        return;
      }
      updateData.is_active = isActive;
    }
    
    const customCity = await prisma.customTourCity.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        city: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            nameEn: true,
          }
        }
      }
    });
    
    console.log('✅ Custom tour city updated:', customCity.id);
    
    res.json({
      success: true,
      data: customCity,
      message: 'Город успешно обновлен'
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Город не найден'
      });
      return;
    }
    
    console.error('❌ Error updating custom tour city:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении города'
    });
  }
};

/**
 * Delete a custom tour city (Admin only)
 * DELETE /api/admin/custom-tour/cities/:id
 */
export const deleteCity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.customTourCity.delete({
      where: { id: parseInt(id) },
    });
    
    console.log('✅ Custom tour city deleted:', id);
    
    res.json({
      success: true,
      message: 'Город успешно удален'
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Город не найден'
      });
      return;
    }
    
    console.error('❌ Error deleting custom tour city:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении города'
    });
  }
};
