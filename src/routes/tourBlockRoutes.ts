import { Router } from 'express';
import {
  getTourBlocks,
  getTourBlock,
  createTourBlock,
  updateTourBlock,
  deleteTourBlock,
  addTourToBlock,
  removeTourFromBlock
} from '../controllers/tourBlockController';
import { authenticateJWT } from '../middleware/auth';
import { mapTour, getLanguageFromRequest } from '../utils/multilingual';
import prisma from '../config/database';
import { tourCache, CACHE_KEYS, CACHE_TTL } from '../utils/cache';

const router = Router();

// Public routes
router.get('/', getTourBlocks);

// 🚀 OPTIMIZED: Get all tour blocks with tours in ONE request (for homepage)
router.get('/homepage/all', async (req, res) => {
  try {
    const language = getLanguageFromRequest(req);
    
    // 🚀 Check cache first (5 minutes TTL for homepage data) - LANGUAGE-AWARE
    const cacheKey = `homepage_tour_blocks_with_tours_${language}`;
    const HOMEPAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    const cachedData = tourCache.get<any[]>(cacheKey);
    
    if (cachedData) {
      console.log('✅ Homepage tour blocks served from cache');
      res.json({
        success: true,
        data: cachedData,
        cached: true
      });
      return;
    }

    // Get all active tour blocks sorted by sortOrder
    const tourBlocks = await prisma.tourBlock.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    // Get all tour assignments with tours in ONE query
    const allAssignments = await prisma.tourBlockAssignment.findMany({
      where: {
        tourBlockId: { in: tourBlocks.map(b => b.id) },
        tour: {
          isActive: true,
          isDraft: false
        }
      },
      include: {
        tour: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            originalPrice: true,
            duration: true,
            durationDays: true,
            durationType: true,
            mainImage: true,
            images: true,
            format: true,
            tourType: true,
            maxPeople: true,
            isPromotion: true,
            discountPercent: true,
            country: true,
            city: true,
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true
              }
            },
            tourCountries: {
              include: {
                country: true
              },
              orderBy: { isPrimary: 'desc' },
              take: 1 // Only primary country for performance
            },
            tourCities: {
              include: {
                city: true
              },
              orderBy: { isPrimary: 'desc' },
              take: 1 // Only primary city for performance
            }
          }
        }
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    // Group tours by block ID
    const toursByBlockId = new Map<number, any[]>();
    allAssignments.forEach(assignment => {
      const blockId = assignment.tourBlockId;
      if (!toursByBlockId.has(blockId)) {
        toursByBlockId.set(blockId, []);
      }
      toursByBlockId.get(blockId)!.push(
        mapTour(assignment.tour, language, {
          includeRaw: false,
          removeImages: false
        })
      );
    });

    // Build response with blocks and their tours
    const blocksWithTours = tourBlocks.map(block => {
      // Parse title
      let titleObj;
      try {
        titleObj = typeof block.title === 'string' ? JSON.parse(block.title) : block.title;
      } catch {
        titleObj = { ru: block.title, en: block.title };
      }

      return {
        id: block.id,
        title: titleObj,
        slug: block.slug,
        sortOrder: block.sortOrder,
        tours: toursByBlockId.get(block.id) || []
      };
    }).filter(block => block.tours.length > 0); // Only blocks with tours

    // Cache the result
    tourCache.set(cacheKey, blocksWithTours, HOMEPAGE_CACHE_TTL);
    console.log(`📦 Homepage data cached (${blocksWithTours.length} blocks, ${allAssignments.length} tours)`);

    res.json({
      success: true,
      data: blocksWithTours,
      cached: false
    });

  } catch (error) {
    console.error('❌ Error loading homepage tour blocks:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading homepage data'
    });
  }
});

// Get tours for a specific tour block (теперь поддерживает множественные блоки)
router.get('/:id/tours', async (req, res) => {
  try {
    const blockId = parseInt(req.params.id);
    
    if (!blockId) {
      res.status(400).json({
        success: false,
        message: 'ID блока тура обязателен'
      });
      return;
    }

    // 🚀 Check cache first
    const cacheKey = CACHE_KEYS.TOUR_BLOCK_TOURS(blockId);
    const cachedTours = tourCache.get<any[]>(cacheKey);
    
    if (cachedTours) {
      console.log(`✅ Tours for block ${blockId} served from cache`);
      res.json({
        success: true,
        data: cachedTours
      });
      return;
    }

    // Ищем туры через новую таблицу связей TourBlockAssignment
    const tourAssignments = await prisma.tourBlockAssignment.findMany({
      where: {
        tourBlockId: blockId
      },
      include: {
        tour: {
          include: {
            category: true,
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
            tourBlockAssignments: {
              include: {
                tourBlock: true
              }
            }
          }
        }
      },
      orderBy: [
        { isPrimary: 'desc' }, // Сначала основные туры
        { tour: { createdAt: 'desc' } }
      ]
    });

    // Извлекаем туры из связей и фильтруем активные
    const activeTours = tourAssignments
      .map(assignment => assignment.tour)
      .filter(tour => tour.isActive);
    
    // 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Применяем mapTour для денормализации enum значений
    const language = getLanguageFromRequest(req);
    const mappedTours = activeTours.map(tour => 
      mapTour(tour, language, {
        includeRaw: false,
        removeImages: false
      })
    );

    // 🚀 Cache the result
    tourCache.set(cacheKey, mappedTours, CACHE_TTL.TOURS);
    console.log(`📦 Tours for block ${blockId} cached (${mappedTours.length} tours)`);

    res.json({
      success: true,
      data: mappedTours
    });

  } catch (error) {
    console.error('❌ Error getting tours for block:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера'
    });
  }
});

router.get('/:id', getTourBlock);

// Protected admin routes
router.post('/', authenticateJWT, createTourBlock);
router.put('/:id', authenticateJWT, updateTourBlock);
router.delete('/:id', authenticateJWT, deleteTourBlock);
router.post('/:blockId/tours/:tourId', authenticateJWT, addTourToBlock);
router.delete('/tours/:tourId', authenticateJWT, removeTourFromBlock);

export default router;