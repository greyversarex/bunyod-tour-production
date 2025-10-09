import { Request, Response } from 'express';
import { parseMultilingualField, getLanguageFromRequest } from '../utils/multilingual';
import prisma from '../config/database';

// Get all tour blocks
export const getTourBlocks = async (req: Request, res: Response): Promise<Response> => {
  try {
    console.log('Fetching tour blocks...');
    const language = getLanguageFromRequest(req);
    
    const tourBlocks = await prisma.tourBlock.findMany({
      orderBy: { sortOrder: 'asc' }
    });

    console.log('Found tour blocks:', tourBlocks.length);
    
    // Parse multilingual fields safely
    const parsedBlocks = tourBlocks.map((block: any) => {
      return {
        ...block,
        title: parseMultilingualField(block.title, language),
        description: block.description ? parseMultilingualField(block.description, language) : null
      };
    });

    return res.json({
      success: true,
      data: parsedBlocks
    });
  } catch (error) {
    console.error('Error fetching tour blocks:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching tour blocks',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get single tour block
export const getTourBlock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    const tourBlock = await prisma.tourBlock.findUnique({
      where: { id: parseInt(id) },
      include: {
        tourBlocks: {
          include: {
            tour: {
              include: {
                category: true,
                reviews: true,
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
                _count: {
                  select: { reviews: true }
                }
              }
            }
          },
          orderBy: [
            { isPrimary: 'desc' }, // Primary assignments first
            { createdAt: 'asc' }   // Then by creation time
          ]
        }
      }
    });

    if (!tourBlock) {
      return res.status(404).json({
        success: false,
        message: 'Tour block not found'
      });
    }

    // Transform data to maintain API compatibility
    const transformedTourBlock = {
      ...tourBlock,
      // Extract tours from assignments and flatten them
      tours: tourBlock.tourBlocks?.map(assignment => assignment.tour) || [],
      // Remove the tourBlocks field from response to avoid confusion
      tourBlocks: undefined
    };

    return res.json({
      success: true,
      data: transformedTourBlock
    });
  } catch (error) {
    console.error('Error fetching tour block:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching tour block'
    });
  }
};

// Create tour block
export const createTourBlock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { title, description, slug, isActive = true, sortOrder = 0 } = req.body;

    const tourBlock = await prisma.tourBlock.create({
      data: {
        title: typeof title === 'string' ? title : JSON.stringify(title),
        description: description ? (typeof description === 'string' ? description : JSON.stringify(description)) : null,
        slug,
        isActive,
        sortOrder
      }
    });

    return res.status(201).json({
      success: true,
      data: tourBlock,
      message: 'Tour block created successfully'
    });
  } catch (error) {
    console.error('Error creating tour block:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating tour block'
    });
  }
};

// Update tour block
export const updateTourBlock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { title, description, slug, isActive, sortOrder } = req.body;

    const existingBlock = await prisma.tourBlock.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingBlock) {
      return res.status(404).json({
        success: false,
        message: 'Tour block not found'
      });
    }

    const tourBlock = await prisma.tourBlock.update({
      where: { id: parseInt(id) },
      data: {
        ...(title && { title: typeof title === 'string' ? title : JSON.stringify(title) }),
        ...(description !== undefined && { description: description ? (typeof description === 'string' ? description : JSON.stringify(description)) : null }),
        ...(slug && { slug }),
        ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
        ...(sortOrder !== undefined && { sortOrder })
      }
    });

    return res.json({
      success: true,
      data: tourBlock,
      message: 'Tour block updated successfully'
    });
  } catch (error) {
    console.error('Error updating tour block:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating tour block'
    });
  }
};

// Delete tour block
export const deleteTourBlock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const existingBlock = await prisma.tourBlock.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingBlock) {
      return res.status(404).json({
        success: false,
        message: 'Tour block not found'
      });
    }

    // Check if tours are assigned to this block via the new assignment system
    const assignmentCount = await prisma.tourBlockAssignment.count({
      where: { tourBlockId: parseInt(id) }
    });

    if (assignmentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete tour block with assigned tours. Please remove ${assignmentCount} tour assignment(s) first.`
      });
    }

    await prisma.tourBlock.delete({
      where: { id: parseInt(id) }
    });

    return res.json({
      success: true,
      message: 'Tour block deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tour block:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting tour block'
    });
  }
};

// Add tour to block
export const addTourToBlock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { blockId, tourId } = req.params;

    // Check if tour exists
    const tour = await prisma.tour.findUnique({
      where: { id: parseInt(tourId) }
    });

    if (!tour) {
      return res.status(404).json({
        success: false,
        message: 'Tour not found'
      });
    }

    // Check if block exists
    const block = await prisma.tourBlock.findUnique({
      where: { id: parseInt(blockId) }
    });

    if (!block) {
      return res.status(404).json({
        success: false,
        message: 'Tour block not found'
      });
    }

    // Create or update assignment (upsert to handle duplicates)
    const assignment = await prisma.tourBlockAssignment.upsert({
      where: {
        tourId_tourBlockId: {
          tourId: parseInt(tourId),
          tourBlockId: parseInt(blockId)
        }
      },
      update: {
        isPrimary: false // Keep existing isPrimary value, just ensure it exists
      },
      create: {
        tourId: parseInt(tourId),
        tourBlockId: parseInt(blockId),
        isPrimary: false
      }
    });

    return res.json({
      success: true,
      data: assignment,
      message: 'Tour added to block successfully'
    });
  } catch (error) {
    console.error('Error adding tour to block:', error);
    return res.status(500).json({
      success: false,
      message: 'Error adding tour to block'
    });
  }
};

// Remove tour from block
export const removeTourFromBlock = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { blockId, tourId } = req.params;

    // Check if assignment exists
    const assignment = await prisma.tourBlockAssignment.findUnique({
      where: {
        tourId_tourBlockId: {
          tourId: parseInt(tourId),
          tourBlockId: parseInt(blockId)
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Tour assignment not found in this block'
      });
    }

    // Delete the assignment
    await prisma.tourBlockAssignment.delete({
      where: {
        tourId_tourBlockId: {
          tourId: parseInt(tourId),
          tourBlockId: parseInt(blockId)
        }
      }
    });

    return res.json({
      success: true,
      message: 'Tour removed from block successfully'
    });
  } catch (error) {
    console.error('Error removing tour from block:', error);
    return res.status(500).json({
      success: false,
      message: 'Error removing tour from block'
    });
  }
};