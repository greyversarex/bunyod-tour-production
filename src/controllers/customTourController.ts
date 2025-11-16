// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Безопасный парсинг JSON
 */
const safeJsonParse = (value: any): any => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

/**
 * Get all custom tour components (with optional country filtering)
 */
export const getAllComponents = async (req: Request, res: Response) => {
  try {
    const { countryId, category } = req.query;
    
    const where: any = {
      isActive: true,
    };
    
    if (countryId && typeof countryId === 'string') {
      where.countryId = parseInt(countryId);
    }
    
    if (category && typeof category === 'string') {
      where.category = category;
    }
    
    const components = await prisma.customTourComponent.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        country: {
          select: {
            id: true,
            nameRu: true,
            nameEn: true,
          }
        }
      }
    });
    
    res.json({
      success: true,
      data: components,
    });
  } catch (error) {
    console.error('❌ Error fetching custom tour components:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке компонентов собственного тура'
    });
  }
};

/**
 * Get custom tour components by country
 */
export const getComponentsByCountry = async (req: Request, res: Response) => {
  try {
    const { countryId } = req.params;
    
    const components = await prisma.customTourComponent.findMany({
      where: {
        countryId: parseInt(countryId),
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
    
    res.json({
      success: true,
      data: components,
    });
  } catch (error) {
    console.error('❌ Error fetching components by country:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке компонентов для страны'
    });
  }
};

/**
 * Get single component by ID
 */
export const getComponentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const component = await prisma.customTourComponent.findUnique({
      where: { id: parseInt(id) },
      include: {
        country: {
          select: {
            id: true,
            nameRu: true,
            nameEn: true,
          }
        }
      }
    });
    
    if (!component) {
      res.status(404).json({
        success: false,
        message: 'Компонент не найден'
      });
      return;
    }
    
    res.json({
      success: true,
      data: component,
    });
  } catch (error) {
    console.error('❌ Error fetching component by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке компонента'
    });
  }
};

/**
 * Create a new custom tour component
 */
export const createComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { countryId, category, nameRu, nameEn, price, unit, descriptionRu, descriptionEn, sortOrder } = req.body;
    
    // Валидация обязательных полей
    if (!countryId || !category || !nameRu || price === undefined || !unit) {
      res.status(400).json({
        success: false,
        message: 'Все обязательные поля должны быть заполнены'
      });
      return;
    }
    
    // Формируем JSON для name
    const name = {
      ru: nameRu,
      en: nameEn || nameRu,
    };
    
    // Формируем JSON для description (опционально)
    let description: any = undefined;
    if (descriptionRu || descriptionEn) {
      description = {
        ru: descriptionRu || '',
        en: descriptionEn || descriptionRu || '',
      };
    }
    
    const component = await prisma.customTourComponent.create({
      data: {
        countryId: parseInt(countryId),
        category,
        name,
        price: parseFloat(price),
        unit,
        description,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0,
        isActive: true,
      },
      include: {
        country: {
          select: {
            id: true,
            nameRu: true,
            nameEn: true,
          }
        }
      }
    });
    
    console.log('✅ Custom tour component created:', component.id);
    
    res.status(201).json({
      success: true,
      data: component,
      message: 'Компонент успешно создан'
    });
  } catch (error) {
    console.error('❌ Error creating custom tour component:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании компонента'
    });
  }
};

/**
 * Update a custom tour component
 */
export const updateComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { countryId, category, nameRu, nameEn, price, unit, descriptionRu, descriptionEn, sortOrder, isActive } = req.body;
    
    // Проверяем существование компонента
    const existing = await prisma.customTourComponent.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existing) {
      res.status(404).json({
        success: false,
        message: 'Компонент не найден'
      });
      return;
    }
    
    // Подготавливаем данные для обновления
    const updateData: any = {};
    
    if (countryId !== undefined) {
      updateData.countryId = parseInt(countryId);
    }
    
    if (category !== undefined) {
      updateData.category = category;
    }
    
    if (nameRu !== undefined || nameEn !== undefined) {
      const existingName = safeJsonParse(existing.name);
      updateData.name = {
        ru: nameRu !== undefined ? nameRu : existingName.ru,
        en: nameEn !== undefined ? nameEn : existingName.en,
      };
    }
    
    if (price !== undefined) {
      updateData.price = parseFloat(price);
    }
    
    if (unit !== undefined) {
      updateData.unit = unit;
    }
    
    if (descriptionRu !== undefined || descriptionEn !== undefined) {
      const existingDesc = existing.description ? safeJsonParse(existing.description) : { ru: '', en: '' };
      updateData.description = {
        ru: descriptionRu !== undefined ? descriptionRu : existingDesc.ru,
        en: descriptionEn !== undefined ? descriptionEn : existingDesc.en,
      };
    }
    
    if (sortOrder !== undefined) {
      updateData.sort_order = parseInt(sortOrder);
    }
    
    if (isActive !== undefined) {
      updateData.is_active = Boolean(isActive);
    }
    
    const component = await prisma.customTourComponent.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        country: {
          select: {
            id: true,
            nameRu: true,
            nameEn: true,
          }
        }
      }
    });
    
    console.log('✅ Custom tour component updated:', component.id);
    
    res.json({
      success: true,
      data: component,
      message: 'Компонент успешно обновлен'
    });
  } catch (error) {
    console.error('❌ Error updating custom tour component:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении компонента'
    });
  }
};

/**
 * Delete a custom tour component (soft delete by setting isActive to false)
 */
export const deleteComponent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const component = await prisma.customTourComponent.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    });
    
    console.log('✅ Custom tour component deleted:', component.id);
    
    res.json({
      success: true,
      message: 'Компонент успешно удален'
    });
  } catch (error) {
    console.error('❌ Error deleting custom tour component:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении компонента'
    });
  }
};

/**
 * Get all categories used in custom tour components
 */
export const getCategories = async (req: Request, res: Response) => {
  try {
    const components = await prisma.customTourComponent.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });
    
    const categories = components.map(c => c.category);
    
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке категорий'
    });
  }
};
