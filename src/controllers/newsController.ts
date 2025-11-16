import { Request, Response } from 'express';
import prisma from '../config/database';
import { safeJsonParse } from '../utils/multilingual';

// Get all news with pagination and filtering
export const getAllNews = async (req: Request, res: Response) => {
    try {
        const { 
            page = 1, 
            limit = 9, 
            category, 
            sort = 'newest',
            featured,
            search 
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        // Build where clause
        const where: any = {
            isPublished: true
        };

        if (category && category !== 'all') {
            where.category = category;
        }

        if (featured === 'true') {
            where.isFeatured = true;
        }

        if (search) {
            where.OR = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { excerpt: { contains: search as string, mode: 'insensitive' } },
                { content: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        // Build orderBy clause
        let orderBy: any;
        switch (sort) {
            case 'oldest':
                orderBy = { publishedAt: 'asc' };
                break;
            case 'popular':
                orderBy = { views: 'desc' };
                break;
            case 'newest':
            default:
                orderBy = { publishedAt: 'desc' };
                break;
        }

        // Get total count
        const totalCount = await prisma.news.count({ where });

        // Get news
        const news = await prisma.news.findMany({
            where,
            orderBy,
            take: limitNum,
            skip: offset
        });

        // Get featured news if on first page
        let featured_news = null;
        if (pageNum === 1 && !category && !search) {
            featured_news = await prisma.news.findFirst({
                where: {
                    isPublished: true,
                    isFeatured: true
                },
                orderBy: { publishedAt: 'desc' }
            });
        }

        const totalPages = Math.ceil(totalCount / limitNum);

        res.json({
            success: true,
            data: {
                news,
                featured: featured_news,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalItems: totalCount,
                    itemsPerPage: limitNum,
                    hasNext: pageNum < totalPages,
                    hasPrev: pageNum > 1
                }
            }
        });
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news'
        });
    }
};

// Get single news article by slug
export const getNewsBySlug = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;

        const news = await prisma.news.findUnique({
            where: { slug }
        });

        if (!news || !news.isPublished) {
            res.status(404).json({
                success: false,
                error: 'News article not found'
            });
            return;
        }

        // Increment view count
        await prisma.news.update({
            where: { id: news.id },
            data: { views: { increment: 1 } }
        });

        res.json({
            success: true,
            data: news
        });
    } catch (error) {
        console.error('Error fetching news by slug:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news article'
        });
    }
};

// Get single news article by ID
export const getNewsById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const news = await prisma.news.findUnique({
            where: { id: parseInt(id) }
        });

        if (!news || !news.isPublished) {
            res.status(404).json({
                success: false,
                error: 'News article not found'
            });
            return;
        }

        // Increment view count
        await prisma.news.update({
            where: { id: news.id },
            data: { views: { increment: 1 } }
        });

        res.json({
            success: true,
            data: news
        });
    } catch (error) {
        console.error('Error fetching news by ID:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news article'
        });
    }
};

// Admin: Get all news (including unpublished)
export const getAllNewsAdmin = async (req: Request, res: Response) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            category, 
            status = 'all',
            search 
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        // Build where clause
        const where: any = {};

        if (category && category !== 'all') {
            where.category = category;
        }

        if (status === 'published') {
            where.isPublished = true;
        } else if (status === 'draft') {
            where.isPublished = false;
        }

        if (search) {
            where.OR = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { excerpt: { contains: search as string, mode: 'insensitive' } },
                { content: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        const totalCount = await prisma.news.count({ where });

        const news = await prisma.news.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limitNum,
            skip: offset
        });

        const totalPages = Math.ceil(totalCount / limitNum);

        res.json({
            success: true,
            data: {
                news,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalItems: totalCount,
                    itemsPerPage: limitNum,
                    hasNext: pageNum < totalPages,
                    hasPrev: pageNum > 1
                }
            }
        });
    } catch (error) {
        console.error('Error fetching admin news:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news'
        });
    }
};

// Admin: Create news
export const createNews = async (req: Request, res: Response) => {
    try {
        const {
            title,
            content,
            excerpt,
            image,
            images,
            tags,
            isPublished,
            isFeatured,
            slug,
            readTime
        } = req.body;

        // Ensure slug is unique
        let finalSlug = slug;
        if (!finalSlug) {
            // Generate slug from title if not provided
            const titleText = typeof title === 'string' ? title : safeJsonParse(title, {ru: '', en: ''}).ru || safeJsonParse(title, {ru: '', en: ''}).en;
            finalSlug = titleText.toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-')
                .trim();
        }

        // Check if slug exists
        const existingNews = await prisma.news.findUnique({
            where: { slug: finalSlug }
        });

        if (existingNews) {
            finalSlug = `${finalSlug}-${Date.now()}`;
        }

        const news = await prisma.news.create({
            data: {
                title,
                content,
                excerpt,
                image,
                images: images ? JSON.stringify(images) : null,
                tags: tags ? JSON.stringify(tags) : null,
                isPublished: isPublished === 'true' || isPublished === true,
                isFeatured: isFeatured === 'true' || isFeatured === true,
                slug: finalSlug,
                readTime: readTime || null
            }
        });

        res.status(201).json({
            success: true,
            data: news
        });
    } catch (error) {
        console.error('Error creating news:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create news article'
        });
    }
};

// Admin: Update news
export const updateNews = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isPublished, isFeatured, ...otherData } = req.body;
        const updateData: any = { ...otherData };
        
        // Правильно обрабатываем boolean поля
        if (isPublished !== undefined) {
            updateData.isPublished = isPublished === 'true' || isPublished === true;
        }
        if (isFeatured !== undefined) {
            updateData.isFeatured = isFeatured === 'true' || isFeatured === true;
        }

        // Handle slug uniqueness if being updated
        if (updateData.slug) {
            const existingNews = await prisma.news.findFirst({
                where: {
                    slug: updateData.slug,
                    NOT: { id: parseInt(id) }
                }
            });

            if (existingNews) {
                updateData.slug = `${updateData.slug}-${Date.now()}`;
            }
        }

        // Convert arrays to JSON strings if needed
        if (updateData.images && Array.isArray(updateData.images)) {
            updateData.images = JSON.stringify(updateData.images);
        }
        if (updateData.tags && Array.isArray(updateData.tags)) {
            updateData.tags = JSON.stringify(updateData.tags);
        }

        // 🔧 ИСПРАВЛЕНИЕ: Защищаем существующее изображение от стирания
        const finalUpdateData: any = { ...updateData };
        if (updateData.image !== undefined) {
            finalUpdateData.image = updateData.image;
        } else {
            // Удаляем поле image чтобы не затереть существующее
            delete finalUpdateData.image;
        }

        const news = await prisma.news.update({
            where: { id: parseInt(id) },
            data: finalUpdateData
        });

        res.json({
            success: true,
            data: news
        });
    } catch (error) {
        console.error('Error updating news:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update news article'
        });
    }
};

// Admin: Delete news
export const deleteNews = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.news.delete({
            where: { id: parseInt(id) }
        });

        res.json({
            success: true,
            message: 'News article deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting news:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete news article'
        });
    }
};

// Newsletter subscription (placeholder)
export const subscribeNewsletter = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        // Here you would typically save to a newsletter subscribers table
        // For now, we'll just return success
        
        res.json({
            success: true,
            message: 'Successfully subscribed to newsletter'
        });
    } catch (error) {
        console.error('Error subscribing to newsletter:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to subscribe to newsletter'
        });
    }
};

// Get newsletter subscribers (admin)
export const getNewsletterSubscribers = async (req: Request, res: Response) => {
    try {
        // Placeholder - would fetch from newsletter subscribers table
        res.json({
            success: true,
            data: []
        });
    } catch (error) {
        console.error('Error fetching newsletter subscribers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch newsletter subscribers'
        });
    }
};

// Get news statistics (admin)
export const getNewsStats = async (req: Request, res: Response) => {
    try {
        const totalNews = await prisma.news.count();
        const publishedNews = await prisma.news.count({
            where: { isPublished: true }
        });
        const draftNews = await prisma.news.count({
            where: { isPublished: false }
        });
        const featuredNews = await prisma.news.count({
            where: { isFeatured: true }
        });

        // Get total views
        const newsWithViews = await prisma.news.aggregate({
            _sum: {
                views: true
            }
        });

        // Get most viewed article
        const mostViewed = await prisma.news.findFirst({
            orderBy: { views: 'desc' },
            select: {
                id: true,
                title: true,
                views: true
            }
        });

        res.json({
            success: true,
            data: {
                totalNews,
                publishedNews,
                draftNews,
                featuredNews,
                totalViews: newsWithViews._sum.views || 0,
                mostViewed
            }
        });
    } catch (error) {
        console.error('Error fetching news stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news statistics'
        });
    }
};