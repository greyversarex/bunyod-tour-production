import { Request, Response } from 'express';
import prisma from '../config/database';
import { parseMultilingualField, getLanguageFromRequest } from '../utils/multilingual';

// Создание отзыва о гиде
export const createGuideReview = async (req: Request, res: Response) => {
  try {
    const { customerId, guideId, rating, text, reviewerName, photos } = req.body;

    // Validation
    if (!guideId || !rating || !text || !reviewerName) {
      return res.status(400).json({
        success: false,
        message: 'Guide ID, reviewer name, rating, and text are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    // Check if guide exists
    const guide = await prisma.guide.findUnique({ where: { id: guideId } });

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Guide not found',
      });
    }

    // Опционально проверяем customer если указан
    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
      }

      // Check if customer already reviewed this guide
      const existingReview = await prisma.guideReview.findFirst({
        where: {
          customerId,
          guideId,
        },
      });

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'You have already reviewed this guide',
        });
      }
    }

    const review = await prisma.guideReview.create({
      data: {
        customerId: customerId || null,
        guideId,
        reviewerName,
        rating,
        text,
        photos: photos ? JSON.stringify(photos) : null,
      },
      include: {
        customer: true,
        guide: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const language = getLanguageFromRequest(req);

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully. It will be visible after moderation.',
      data: {
        ...review,
        guide: {
          ...review.guide,
          name: parseMultilingualField(review.guide.name, language),
        },
      },
    });
  } catch (error) {
    console.error('Error creating guide review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create guide review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Получение отзывов о гиде
export const getGuideReviews = async (req: Request, res: Response) => {
  try {
    const { guideId } = req.params;

    const reviews = await prisma.guideReview.findMany({
      where: {
        guideId: parseInt(guideId),
        isModerated: true,
        isApproved: true,
      },
      include: {
        customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedReviews = reviews.map((review: any) => ({
      ...review,
      photos: review.photos ? JSON.parse(review.photos) : [],
    }));

    return res.json({
      success: true,
      data: formattedReviews,
    });
  } catch (error) {
    console.error('Error fetching guide reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch guide reviews',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Получение всех отзывов (для админ-панели)
export const getAllGuideReviews = async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where: any = {};
    
    if (status === 'pending') {
      where.isModerated = false;
    } else if (status === 'approved') {
      where.isModerated = true;
      where.isApproved = true;
    } else if (status === 'rejected') {
      where.isModerated = true;
      where.isApproved = false;
    }

    const reviews = await prisma.guideReview.findMany({
      where,
      include: {
        customer: true,
        guide: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    const language = getLanguageFromRequest(req);

    const formattedReviews = reviews.map((review: any) => ({
      ...review,
      photos: review.photos ? JSON.parse(review.photos) : [],
      guide: {
        ...review.guide,
        name: parseMultilingualField(review.guide.name, language),
      },
    }));

    const totalReviews = await prisma.guideReview.count({ where });

    return res.json({
      success: true,
      data: formattedReviews,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalReviews,
        totalPages: Math.ceil(totalReviews / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Error fetching all guide reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch guide reviews',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Модерация отзыва о гиде
export const moderateGuideReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isApproved must be a boolean value',
      });
    }

    const review = await prisma.guideReview.update({
      where: { id: parseInt(id) },
      data: {
        isModerated: true,
        isApproved,
      },
      include: {
        customer: true,
        guide: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Обновляем средний рейтинг гида
    if (isApproved) {
      const stats = await prisma.guideReview.aggregate({
        where: {
          guideId: review.guideId,
          isModerated: true,
          isApproved: true,
        },
        _avg: {
          rating: true,
        },
      });

      await prisma.guide.update({
        where: { id: review.guideId },
        data: {
          rating: stats._avg.rating || 0,
        },
      });
    }

    const language = getLanguageFromRequest(req);

    return res.json({
      success: true,
      message: `Guide review ${isApproved ? 'approved' : 'rejected'} successfully`,
      data: {
        ...review,
        guide: {
          ...review.guide,
          name: parseMultilingualField(review.guide.name, language),
        },
      },
    });
  } catch (error) {
    console.error('Error moderating guide review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to moderate guide review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Удаление отзыва о гиде
export const deleteGuideReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.guideReview.delete({
      where: { id: parseInt(id) },
    });

    return res.json({
      success: true,
      message: 'Guide review deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting guide review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete guide review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Получение статистики отзывов гида
export const getGuideReviewStats = async (req: Request, res: Response) => {
  try {
    const { guideId } = req.params;

    const stats = await prisma.guideReview.aggregate({
      where: {
        guideId: parseInt(guideId),
        isModerated: true,
        isApproved: true,
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    const ratingDistribution = await prisma.guideReview.groupBy({
      by: ['rating'],
      where: {
        guideId: parseInt(guideId),
        isModerated: true,
        isApproved: true,
      },
      _count: {
        rating: true,
      },
    });

    const distribution: { [key: number]: number } = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    ratingDistribution.forEach((item: any) => {
      distribution[item.rating] = item._count.rating;
    });

    return res.json({
      success: true,
      data: {
        averageRating: stats._avg.rating || 0,
        totalReviews: stats._count.rating,
        distribution,
      },
    });
  } catch (error) {
    console.error('Error fetching guide review stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch guide review statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
