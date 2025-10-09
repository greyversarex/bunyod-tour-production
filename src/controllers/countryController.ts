import { Request, Response, NextFunction } from 'express';
import prisma, { withRetry } from '../config/database';
import { ApiResponse } from '../types';
import { 
  getLanguageFromRequest, 
  createLocalizedResponse, 
  parseMultilingualField 
} from '../utils/multilingual';

export class CountryController {
  /**
   * Получить все страны с поддержкой мультиязычности
   * GET /api/countries?lang=en/ru
   */
  static async getAllCountries(req: Request, res: Response, next: NextFunction) {
    try {
      const language = getLanguageFromRequest(req);
      const includeRaw = req.query.includeRaw === 'true';
      
      const countries = await withRetry(() => prisma.country.findMany({
        where: { isActive: true },
        include: {
          cities: {
            where: { isActive: true },
            orderBy: { nameRu: 'asc' }
          }
        },
        orderBy: { nameRu: 'asc' }
      })) as any[];

      // Локализация данных стран и городов
      const localizedCountries = countries.map((country: any) => {
        const localizedCities = country.cities?.map((city: any) => ({
          ...city,
          name: language === 'en' ? city.nameEn || city.nameRu : city.nameRu || city.nameEn
        }));

        if (includeRaw) {
          // ДЛЯ АДМИНКИ: возвращаем raw данные + локализованные поля
          return {
            ...country,
            cities: localizedCities,
            _localized: {
              name: language === 'en' ? country.nameEn || country.nameRu : country.nameRu || country.nameEn
            }
          };
        } else {
          // ДЛЯ ПУБЛИЧНОГО ИСПОЛЬЗОВАНИЯ: только локализованный контент
          return {
            ...country,
            name: language === 'en' ? country.nameEn || country.nameRu : country.nameRu || country.nameEn,
            cities: localizedCities
          };
        }
      });

      const response = createLocalizedResponse(
        localizedCountries,
        [], // Поля уже обработаны выше
        language,
        'Countries retrieved successfully'
      );

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получить страну по ID
   */
  static async getCountryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const countryId = parseInt(id);

      if (isNaN(countryId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid country ID'
        });
      }

      const country = await withRetry(() => prisma.country.findUnique({
        where: { id: countryId },
        include: {
          cities: {
            where: { isActive: true },
            orderBy: { nameRu: 'asc' }
          }
        }
      }));

      if (!country) {
        return res.status(404).json({
          success: false,
          error: 'Country not found'
        });
      }

      const response: ApiResponse = {
        success: true,
        data: country,
        message: 'Country retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Создать новую страну
   */
  static async createCountry(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, nameRu, nameEn, code, isActive = true } = req.body;

      if (!name || !nameRu || !nameEn || !code) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, nameRu, nameEn, code'
        });
      }

      const country = await withRetry(() => prisma.country.create({
        data: {
          name,
          nameRu,
          nameEn,
          code,
          isActive
        }
      }));

      const response: ApiResponse = {
        success: true,
        data: country,
        message: 'Country created successfully'
      };

      return res.status(201).json(response);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'Country with this name or code already exists'
        });
      }
      return next(error);
    }
  }

  /**
   * Обновить страну
   */
  static async updateCountry(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const countryId = parseInt(id);
      const { name, nameRu, nameEn, code, isActive } = req.body;

      if (isNaN(countryId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid country ID'
        });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (nameRu !== undefined) updateData.nameRu = nameRu;
      if (nameEn !== undefined) updateData.nameEn = nameEn;
      if (code !== undefined) updateData.code = code;
      if (isActive !== undefined) updateData.isActive = isActive;

      const country = await withRetry(() => prisma.country.update({
        where: { id: countryId },
        data: updateData,
        include: {
          cities: {
            where: { isActive: true },
            orderBy: { nameRu: 'asc' }
          }
        }
      }));

      const response: ApiResponse = {
        success: true,
        data: country,
        message: 'Country updated successfully'
      };

      return res.status(200).json(response);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Country not found'
        });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'Country with this name or code already exists'
        });
      }
      return next(error);
    }
  }

  /**
   * Удалить страну
   */
  static async deleteCountry(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const countryId = parseInt(id);

      if (isNaN(countryId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid country ID'
        });
      }

      await withRetry(() => prisma.country.delete({
        where: { id: countryId }
      }));

      const response: ApiResponse = {
        success: true,
        data: null,
        message: 'Country deleted successfully'
      };

      return res.status(200).json(response);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Country not found'
        });
      }
      return next(error);
    }
  }
}