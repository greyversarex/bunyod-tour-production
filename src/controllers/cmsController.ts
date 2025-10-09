import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { parseMultilingualField, getLanguageFromRequest, safeJsonParse } from '../utils/multilingual';
import prisma from '../config/database';

export class CMSController {
  /**
   * Получить все блоки контента
   */
  static async getContentBlocks(req: Request, res: Response, next: NextFunction) {
    try {
      const { section } = req.query;
      const language = getLanguageFromRequest(req);
      const where = section ? { section: section as string } : {};

      const blocks = await prisma.contentBlock.findMany({
        where: {
          ...where,
          isActive: true
        },
        orderBy: { sortOrder: 'asc' }
      });

      const parsedBlocks = blocks.map((block: any) => ({
        ...block,
        title: parseMultilingualField(block.title, language),
        content: parseMultilingualField(block.content, language),
        metadata: block.metadata ? safeJsonParse(block.metadata) : null
      }));

      const response: ApiResponse = {
        success: true,
        data: parsedBlocks,
        message: 'Content blocks retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Создать новый блок контента
   */
  static async createContentBlock(req: Request, res: Response, next: NextFunction) {
    try {
      const { key, title, content, type, section, sortOrder, metadata } = req.body;

      if (!key || !title || !content || !type || !section) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: key, title, content, type, section'
        });
      }

      const block = await prisma.contentBlock.create({
        data: {
          key,
          title: JSON.stringify(title),
          content: JSON.stringify(content),
          type,
          section,
          sortOrder: sortOrder || 0,
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      });

      const parsedBlock = {
        ...block,
        title: safeJsonParse(block.title),
        content: safeJsonParse(block.content),
        metadata: block.metadata ? safeJsonParse(block.metadata) : null
      };

      const response: ApiResponse = {
        success: true,
        data: parsedBlock,
        message: 'Content block created successfully'
      };

      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Обновить блок контента
   */
  static async updateContentBlock(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const { title, content, type, section, sortOrder, metadata, isActive } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid content block ID'
        });
      }

      const updateData: any = {};
      if (title) updateData.title = JSON.stringify(title);
      if (content) updateData.content = JSON.stringify(content);
      if (type) updateData.type = type;
      if (section) updateData.section = section;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (metadata) updateData.metadata = JSON.stringify(metadata);
      if (isActive !== undefined) updateData.isActive = isActive;

      const block = await prisma.contentBlock.update({
        where: { id },
        data: updateData
      });

      const parsedBlock = {
        ...block,
        title: safeJsonParse(block.title),
        content: safeJsonParse(block.content),
        metadata: block.metadata ? safeJsonParse(block.metadata) : null
      };

      const response: ApiResponse = {
        success: true,
        data: parsedBlock,
        message: 'Content block updated successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Удалить блок контента
   */
  static async deleteContentBlock(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid content block ID'
        });
      }

      await prisma.contentBlock.delete({
        where: { id }
      });

      const response: ApiResponse = {
        success: true,
        data: null,
        message: 'Content block deleted successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получить настройки сайта
   */
  static async getSiteSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { group } = req.query;
      const where = group ? { group: group as string } : {};

      const settings = await prisma.siteSetting.findMany({
        where: {
          ...where,
          isActive: true
        },
        orderBy: { key: 'asc' }
      });

      const parsedSettings = settings.map((setting: any) => ({
        ...setting,
        value: setting.type === 'json' ? safeJsonParse(setting.value) : setting.value,
        label: safeJsonParse(setting.label)
      }));

      const response: ApiResponse = {
        success: true,
        data: parsedSettings,
        message: 'Site settings retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Создать/обновить настройку сайта
   */
  static async upsertSiteSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key, value, type, group, label } = req.body;

      if (!key || !value || !type || !group || !label) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: key, value, type, group, label'
        });
      }

      const settingValue = type === 'json' ? JSON.stringify(value) : value;

      const setting = await prisma.siteSetting.upsert({
        where: { key },
        update: {
          value: settingValue,
          type,
          group,
          label: JSON.stringify(label)
        },
        create: {
          key,
          value: settingValue,
          type,
          group,
          label: JSON.stringify(label)
        }
      });

      const parsedSetting = {
        ...setting,
        value: setting.type === 'json' ? safeJsonParse(setting.value) : setting.value,
        label: safeJsonParse(setting.label)
      };

      const response: ApiResponse = {
        success: true,
        data: parsedSetting,
        message: 'Site setting saved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получить все страницы
   */
  static async getPages(req: Request, res: Response, next: NextFunction) {
    try {
      const pages = await prisma.page.findMany({
        where: { isPublished: true },
        orderBy: { sortOrder: 'asc' }
      });

      const parsedPages = pages.map((page: any) => ({
        ...page,
        title: safeJsonParse(page.title),
        content: safeJsonParse(page.content),
        metaTitle: page.metaTitle ? safeJsonParse(page.metaTitle) : null,
        metaDesc: page.metaDesc ? safeJsonParse(page.metaDesc) : null
      }));

      const response: ApiResponse = {
        success: true,
        data: parsedPages,
        message: 'Pages retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Создать новую страницу
   */
  static async createPage(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug, title, content, metaTitle, metaDesc, template, sortOrder } = req.body;

      if (!slug || !title || !content) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: slug, title, content'
        });
      }

      const page = await prisma.page.create({
        data: {
          slug,
          title: JSON.stringify(title),
          content: JSON.stringify(content),
          metaTitle: metaTitle ? JSON.stringify(metaTitle) : null,
          metaDesc: metaDesc ? JSON.stringify(metaDesc) : null,
          template: template || 'default',
          sortOrder: sortOrder || 0
        }
      });

      const parsedPage = {
        ...page,
        title: safeJsonParse(page.title),
        content: safeJsonParse(page.content),
        metaTitle: page.metaTitle ? safeJsonParse(page.metaTitle) : null,
        metaDesc: page.metaDesc ? safeJsonParse(page.metaDesc) : null
      };

      const response: ApiResponse = {
        success: true,
        data: parsedPage,
        message: 'Page created successfully'
      };

      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Обновить страницу
   */
  static async updatePage(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const { title, content, metaTitle, metaDesc, template, sortOrder, isPublished } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid page ID'
        });
      }

      const updateData: any = {};
      if (title) updateData.title = JSON.stringify(title);
      if (content) updateData.content = JSON.stringify(content);
      if (metaTitle) updateData.metaTitle = JSON.stringify(metaTitle);
      if (metaDesc) updateData.metaDesc = JSON.stringify(metaDesc);
      if (template) updateData.template = template;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (isPublished !== undefined) updateData.isPublished = isPublished;

      const page = await prisma.page.update({
        where: { id },
        data: updateData
      });

      const parsedPage = {
        ...page,
        title: safeJsonParse(page.title),
        content: safeJsonParse(page.content),
        metaTitle: page.metaTitle ? safeJsonParse(page.metaTitle) : null,
        metaDesc: page.metaDesc ? safeJsonParse(page.metaDesc) : null
      };

      const response: ApiResponse = {
        success: true,
        data: parsedPage,
        message: 'Page updated successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получить элементы меню
   */
  static async getMenuItems(req: Request, res: Response, next: NextFunction) {
    try {
      const menuItems = await prisma.menuItem.findMany({
        where: { isActive: true, parentId: null },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { sortOrder: 'asc' }
      });

      const parsedMenuItems = menuItems.map((item: any) => ({
        ...item,
        title: safeJsonParse(item.title),
        children: item.children.map((child: any) => ({
          ...child,
          title: safeJsonParse(child.title)
        }))
      }));

      const response: ApiResponse = {
        success: true,
        data: parsedMenuItems,
        message: 'Menu items retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Создать новый элемент меню
   */
  static async createMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { title, url, type, parentId, sortOrder } = req.body;

      if (!title || !url || !type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: title, url, type'
        });
      }

      const menuItem = await prisma.menuItem.create({
        data: {
          title: JSON.stringify(title),
          url,
          type,
          parentId: parentId || null,
          sortOrder: sortOrder || 0
        }
      });

      const parsedMenuItem = {
        ...menuItem,
        title: safeJsonParse(menuItem.title)
      };

      const response: ApiResponse = {
        success: true,
        data: parsedMenuItem,
        message: 'Menu item created successfully'
      };

      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Обновить элемент меню
   */
  static async updateMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { title, url, type, parentId, sortOrder, isActive } = req.body;

      const menuItem = await prisma.menuItem.update({
        where: { id: parseInt(id) },
        data: {
          title: title ? JSON.stringify(title) : undefined,
          url,
          type,
          parentId: parentId !== undefined ? parentId : undefined,
          sortOrder,
          isActive: isActive ?? undefined
        }
      });

      const parsedMenuItem = {
        ...menuItem,
        title: safeJsonParse(menuItem.title)
      };

      const response: ApiResponse = {
        success: true,
        data: parsedMenuItem,
        message: 'Menu item updated successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Удалить элемент меню
   */
  static async deleteMenuItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Check if menu item has children
      const childrenCount = await prisma.menuItem.count({
        where: { parentId: parseInt(id) }
      });

      if (childrenCount > 0) {
        return res.status(409).json({
          success: false,
          error: 'Cannot delete menu item that has child items. Please delete or reassign children first.',
          childrenCount
        });
      }

      await prisma.menuItem.delete({
        where: { id: parseInt(id) }
      });

      const response: ApiResponse = {
        success: true,
        message: 'Menu item deleted successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Получить новости
   */
  static async getNews(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 10, published = 'true' } = req.query;

      const where = published === 'true' ? { isPublished: true } : {};

      const news = await prisma.newsPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string)
      });

      const parsedNews = news.map((post: any) => ({
        ...post,
        title: safeJsonParse(post.title),
        excerpt: post.excerpt ? safeJsonParse(post.excerpt) : null,
        content: safeJsonParse(post.content),
        metaTitle: post.metaTitle ? safeJsonParse(post.metaTitle) : null,
        metaDesc: post.metaDesc ? safeJsonParse(post.metaDesc) : null,
        tags: post.tags ? safeJsonParse(post.tags) : null
      }));

      const response: ApiResponse = {
        success: true,
        data: parsedNews,
        message: 'News retrieved successfully'
      };

      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  }
}