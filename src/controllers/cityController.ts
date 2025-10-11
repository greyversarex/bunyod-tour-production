import { Request, Response, NextFunction } from 'express';
import prisma, { withRetry } from '../config/database';
import { ApiResponse } from '../types';

export class CityController {
  /**
   * Получить все города
   */
  static async getAllCities(req: Request, res: Response, next: NextFunction) {
    try {
      const cities = await withRetry(() => prisma.city.findMany({
        where: { isActive: true },
        include: {
          country: true
        },
        orderBy: [
          { country: { nameRu: 'asc' } },
          { nameRu: 'asc' }
        ]
      }));

      const response: ApiResponse = {
        success: true,
        data: cities,
        message: 'Cities retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получить города по стране
   */
  static async getCitiesByCountry(req: Request, res: Response, next: NextFunction) {
    try {
      const { countryId } = req.params;
      const countryIdNum = parseInt(countryId);

      if (isNaN(countryIdNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid country ID'
        });
      }

      const cities = await withRetry(() => prisma.city.findMany({
        where: {
          countryId: countryIdNum,
          isActive: true
        },
        include: {
          country: true
        },
        orderBy: { nameRu: 'asc' }
      }));

      const response: ApiResponse = {
        success: true,
        data: cities,
        message: 'Cities retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получить город по ID
   */
  static async getCityById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const cityId = parseInt(id);

      if (isNaN(cityId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid city ID'
        });
      }

      const city = await withRetry(() => prisma.city.findUnique({
        where: { id: cityId },
        include: {
          country: true
        }
      }));

      if (!city) {
        return res.status(404).json({
          success: false,
          error: 'City not found'
        });
      }

      const response: ApiResponse = {
        success: true,
        data: city,
        message: 'City retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Создать новый город
   */
  static async createCity(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, nameRu, nameEn, countryId, isActive = true } = req.body;

      if (!name || !nameRu || !nameEn || !countryId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, nameRu, nameEn, countryId'
        });
      }

      const countryIdNum = parseInt(countryId);
      if (isNaN(countryIdNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid country ID'
        });
      }

      // Проверяем существование страны
      const countryExists = await withRetry(() => prisma.country.findUnique({
        where: { id: countryIdNum }
      }));

      if (!countryExists) {
        return res.status(400).json({
          success: false,
          error: 'Country not found'
        });
      }

      const city = await withRetry(() => prisma.city.create({
        data: {
          name,
          nameRu,
          nameEn,
          countryId: countryIdNum,
          isActive
        },
        include: {
          country: true
        }
      }));

      const response: ApiResponse = {
        success: true,
        data: city,
        message: 'City created successfully'
      };

      return res.status(201).json(response);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'City with this name already exists in this country'
        });
      }
      return next(error);
    }
  }

  /**
   * Обновить город
   */
  static async updateCity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const cityId = parseInt(id);
      const { name, nameRu, nameEn, countryId, isActive } = req.body;

      if (isNaN(cityId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid city ID'
        });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (nameRu !== undefined) updateData.nameRu = nameRu;
      if (nameEn !== undefined) updateData.nameEn = nameEn;
      if (isActive !== undefined) updateData.isActive = isActive;

      if (countryId !== undefined) {
        const countryIdNum = parseInt(countryId);
        if (isNaN(countryIdNum)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid country ID'
          });
        }

        // Проверяем существование страны
        const countryExists = await withRetry(() => prisma.country.findUnique({
          where: { id: countryIdNum }
        }));

        if (!countryExists) {
          return res.status(400).json({
            success: false,
            error: 'Country not found'
          });
        }

        updateData.countryId = countryIdNum;
      }

      const city = await withRetry(() => prisma.city.update({
        where: { id: cityId },
        data: updateData,
        include: {
          country: true
        }
      }));

      const response: ApiResponse = {
        success: true,
        data: city,
        message: 'City updated successfully'
      };

      return res.status(200).json(response);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'City not found'
        });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'City with this name already exists in this country'
        });
      }
      return next(error);
    }
  }

  /**
   * Удалить город
   */
  static async deleteCity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const cityId = parseInt(id);

      if (isNaN(cityId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid city ID'
        });
      }

      await withRetry(() => prisma.city.delete({
        where: { id: cityId }
      }));

      const response: ApiResponse = {
        success: true,
        data: null,
        message: 'City deleted successfully'
      };

      return res.status(200).json(response);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'City not found'
        });
      }
      return next(error);
    }
  }
}