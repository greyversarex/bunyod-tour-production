import { Request, Response } from 'express';
import prisma from '../config/database';
import { ReviewData } from '../types/booking';
import { parseMultilingualField, getLanguageFromRequest } from '../utils/multilingual';

export const createReview = async (req: Request, res: Response) => {
  try {
    const { customerId, tourId, rating, guideRating, text, reviewerName, photos } = req.body;

    // Validation
    if (!tourId || !rating || !text || !reviewerName) {
      return res.status(400).json({
        success: false,
        message: 'Tour ID, reviewer name, rating, and text are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    if (guideRating && (guideRating < 1 || guideRating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Guide rating must be between 1 and 5',
      });
    }

    // Check if tour exists
    const tour = await prisma.tour.findUnique({ where: { id: tourId } });

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found',
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

      // Check if customer already reviewed this tour
      const existingReview = await prisma.review.findFirst({
        where: {
          customerId,
          tourId,
        },
      });

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'You have already reviewed this tour',
        });
      }
    }

    const review = await prisma.review.create({
      data: {
        customerId: customerId || null,
        tourId,
        reviewerName,
        rating,
        guideRating: guideRating || null,
        text,
        photos: photos ? JSON.stringify(photos) : null,
      },
      include: {
        customer: true,
        tour: {
          select: {
            id: true,
            title: true,
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
        tour: {
          ...review.tour,
          title: parseMultilingualField(review.tour.title, language),
        },
      },
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getReviewsByTour = async (req: Request, res: Response) => {
  try {
    const { tourId } = req.params;

    const reviews = await prisma.review.findMany({
      where: {
        tourId: parseInt(tourId),
        isModerated: true,
        isApproved: true,
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Форматируем отзывы с обработкой фото
    const formattedReviews = reviews.map(review => ({
      ...review,
      photos: review.photos ? JSON.parse(review.photos) : [],
    }));

    return res.json({
      success: true,
      data: formattedReviews,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getAllReviews = async (req: Request, res: Response) => {
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

    const reviews = await prisma.review.findMany({
      where,
      include: {
        customer: true,
        tour: {
          select: {
            id: true,
            title: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
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

    const formattedReviews = reviews.map(review => ({
      ...review,
      photos: review.photos ? JSON.parse(review.photos) : [],
      tour: {
        ...review.tour,
        title: parseMultilingualField(review.tour.title, language),
        category: {
          ...review.tour.category,
          name: review.tour.category.name, // Category.name is String, not JSON
        },
      },
    }));

    const totalReviews = await prisma.review.count({ where });

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
    console.error('Error fetching reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const moderateReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isApproved must be a boolean value',
      });
    }

    const review = await prisma.review.update({
      where: { id: parseInt(id) },
      data: {
        isModerated: true,
        isApproved,
      },
      include: {
        customer: true,
        tour: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const language = getLanguageFromRequest(req);

    return res.json({
      success: true,
      message: `Review ${isApproved ? 'approved' : 'rejected'} successfully`,
      data: {
        ...review,
        tour: {
          ...review.tour,
          title: parseMultilingualField(review.tour.title, language),
        },
      },
    });
  } catch (error) {
    console.error('Error moderating review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to moderate review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.review.delete({
      where: { id: parseInt(id) },
    });

    return res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getReviewStats = async (req: Request, res: Response) => {
  try {
    const { tourId } = req.params;

    const stats = await prisma.review.aggregate({
      where: {
        tourId: parseInt(tourId),
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

    const ratingDistribution = await prisma.review.groupBy({
      by: ['rating'],
      where: {
        tourId: parseInt(tourId),
        isModerated: true,
        isApproved: true,
      },
      _count: {
        rating: true,
      },
      orderBy: {
        rating: 'asc',
      },
    });

    return res.json({
      success: true,
      data: {
        averageRating: stats._avg.rating ? Number(stats._avg.rating.toFixed(1)) : 0,
        totalReviews: stats._count.rating,
        ratingDistribution: ratingDistribution.map(item => ({
          rating: item.rating,
          count: item._count.rating,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching review stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch review statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Approve a review (admin only)
export const approveReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }

    // Check if review exists
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        tour: true,
      },
    });

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Update review as approved and moderated
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        isApproved: true,
        isModerated: true,
      },
      include: {
        customer: true,
        tour: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const language = getLanguageFromRequest(req);

    return res.status(200).json({
      success: true,
      message: 'Review approved successfully',
      data: {
        ...review,
        tour: {
          ...review.tour,
          title: parseMultilingualField(review.tour.title, language),
        },
      },
    });
  } catch (error) {
    console.error('Error approving review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Reject a review (admin only)
export const rejectReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviewId = parseInt(id);

    if (isNaN(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }

    // Check if review exists
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        tour: true,
      },
    });

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Update review as rejected but moderated
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        isApproved: false,
        isModerated: true,
      },
      include: {
        customer: true,
        tour: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const language = getLanguageFromRequest(req);

    return res.status(200).json({
      success: true,
      message: 'Review rejected successfully',
      data: {
        ...review,
        tour: {
          ...review.tour,
          title: parseMultilingualField(review.tour.title, language),
        },
      },
    });
  } catch (error) {
    console.error('Error rejecting review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject review',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};