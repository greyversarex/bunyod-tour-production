// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import prisma, { withRetry } from '../config/database';
import { ApiResponse } from '../types';

export class CityCardPhotoController {
  /**
   * Получить все фото карточек городов
   */
  static async getAllCityCardPhotos(req: Request, res: Response, next: NextFunction) {
    try {
      const photos = await withRetry(() => prisma.city_card_photos.findMany({
        where: { is_active: true },
        include: {
          city: {
            select: {
              id: true,
              name: true,
              nameRu: true,
              nameEn: true
            }
          }
        },
        orderBy: { sort_order: 'asc' }
      }));

      // Add imageUrl field with absolute path
      const photosWithUrl = photos.map(photo => ({
        ...photo,
        imageUrl: photo.image.startsWith('/') ? photo.image : `/${photo.image}`
      }));

      const response: ApiResponse = {
        success: true,
        data: photosWithUrl,
        message: 'City card photos retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получить фото карточки города по ID
   */
  static async getCityCardPhotoById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const photoId = parseInt(id);

      if (isNaN(photoId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid photo ID'
        });
      }

      const photo = await withRetry(() => prisma.city_card_photos.findUnique({
        where: { id: photoId },
        include: {
          city: true
        }
      }));

      if (!photo) {
        return res.status(404).json({
          success: false,
          error: 'City card photo not found'
        });
      }

      const response: ApiResponse = {
        success: true,
        data: photo,
        message: 'City card photo retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Создать новое фото карточки города
   */
  static async createCityCardPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { cityId, sortOrder = 0, isActive = true } = req.body;

      if (!cityId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: cityId'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Image file is required'
        });
      }

      const cityIdNum = parseInt(cityId);
      if (isNaN(cityIdNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid city ID'
        });
      }

      // Проверяем существование города
      const cityExists = await withRetry(() => prisma.city.findUnique({
        where: { id: cityIdNum }
      }));

      if (!cityExists) {
        return res.status(400).json({
          success: false,
          error: 'City not found'
        });
      }

      const imagePath = (req.file as any)?.path;

      const photo = await withRetry(() => prisma.city_card_photos.create({
        data: {
          cityId: cityIdNum,
          image: imagePath,
          sort_order: parseInt(sortOrder) || 0,
          isActive
        },
        include: {
          city: true
        }
      }));

      const response: ApiResponse = {
        success: true,
        data: photo,
        message: 'City card photo created successfully'
      };

      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Обновить фото карточки города
   */
  static async updateCityCardPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const photoId = parseInt(id);
      const { cityId, sortOrder, isActive } = req.body;

      if (isNaN(photoId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid photo ID'
        });
      }

      const updateData: any = {};
      
      if (req.file) {
        updateData.image = (req.file as any)?.path;
      }
      
      if (cityId !== undefined) {
        const cityIdNum = parseInt(cityId);
        if (isNaN(cityIdNum)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid city ID'
          });
        }

        // Проверяем существование города
        const cityExists = await withRetry(() => prisma.city.findUnique({
          where: { id: cityIdNum }
        }));

        if (!cityExists) {
          return res.status(400).json({
            success: false,
            error: 'City not found'
          });
        }

        updateData.cityId = cityIdNum;
      }

      if (sortOrder !== undefined) updateData.sort_order = parseInt(sortOrder);
      if (isActive !== undefined) updateData.is_active = isActive;

      const photo = await withRetry(() => prisma.city_card_photos.update({
        where: { id: photoId },
        data: updateData,
        include: {
          city: true
        }
      }));

      const response: ApiResponse = {
        success: true,
        data: photo,
        message: 'City card photo updated successfully'
      };

      return res.status(200).json(response);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'City card photo not found'
        });
      }
      return next(error);
    }
  }

  /**
   * Удалить фото карточки города
   */
  static async deleteCityCardPhoto(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const photoId = parseInt(id);

      if (isNaN(photoId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid photo ID'
        });
      }

      await withRetry(() => prisma.city_card_photos.delete({
        where: { id: photoId }
      }));

      const response: ApiResponse = {
        success: true,
        message: 'City card photo deleted successfully'
      };

      return res.status(200).json(response);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'City card photo not found'
        });
      }
      return next(error);
    }
  }
}
