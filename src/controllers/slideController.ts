import { Request, Response } from 'express';
import { safeJsonParse } from '../utils/multilingual';
import prisma from '../config/database';

// Get all slides
export const getSlides = async (req: Request, res: Response) => {
  try {
    const slides = await prisma.slide.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });

    res.json({
      success: true,
      data: slides
    });
  } catch (error) {
    console.error('Error fetching slides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch slides'
    });
  }
};

// Get all slides for admin (including inactive)
export const getAllSlides = async (req: Request, res: Response) => {
  try {
    const slides = await prisma.slide.findMany({
      orderBy: { order: 'asc' }
    });

    res.json({
      success: true,
      data: slides
    });
  } catch (error) {
    console.error('Error fetching all slides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch slides'
    });
  }
};

// Get slide by ID
export const getSlideById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { includeRaw } = req.query;
    
    const slide = await prisma.slide.findUnique({
      where: { id: parseInt(id) }
    });

    if (!slide) {
      res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
      return;
    }

    // Если запрошены raw данные (для админки), добавляем распарсенные JSON объекты
    const responseData = includeRaw === 'true' ? {
      ...slide,
      _raw: {
        title: safeJsonParse(slide.title),
        description: safeJsonParse(slide.description),
        buttonText: safeJsonParse(slide.buttonText)
      }
    } : slide;

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch slide'
    });
  }
};

// Create new slide - ALIGNED with updateSlide parsing
export const createSlide = async (req: any, res: Response): Promise<void> => {
  try {
    // Handle file upload
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
      return;
    }

    const imagePath = `/uploads/slides/${req.file.filename}`;
    
    // 🔧 ROBUST PARSING: Use safeJsonParse like updateSlide
    const title = req.body.title ? safeJsonParse(req.body.title) : {};
    const description = req.body.description ? safeJsonParse(req.body.description) : {};
    const buttonText = req.body.buttonText ? safeJsonParse(req.body.buttonText) : null;
    const link = req.body.link || '';
    const order = parseInt(req.body.order) || 0;
    const isActive = req.body.isActive === 'true';

    const slide = await prisma.slide.create({
      data: {
        title: JSON.stringify(title),
        description: JSON.stringify(description),
        image: imagePath,
        link,
        buttonText: buttonText ? JSON.stringify(buttonText) : null,
        order,
        isActive
      }
    });

    res.status(201).json({
      success: true,
      data: slide,
      message: 'Slide created successfully'
    });
  } catch (error) {
    console.error('Error creating slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create slide'
    });
  }
};

// Update slide - FIXED to handle both multipart (with file) and JSON (without file) correctly
export const updateSlide = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingSlide = await prisma.slide.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSlide) {
      res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
      return;
    }

    // 🔧 MULTIPART vs JSON HANDLING: determine if this is multipart (FormData) or JSON
    const isMultipart = req.file || req.headers['content-type']?.includes('multipart/form-data');
    
    let parsedData: any = {};
    
    if (isMultipart) {
      // 📁 MULTIPART: Parse JSON strings from FormData fields
      parsedData.title = req.body.title ? safeJsonParse(req.body.title) : undefined;
      parsedData.description = req.body.description ? safeJsonParse(req.body.description) : undefined;
      parsedData.buttonText = req.body.buttonText ? safeJsonParse(req.body.buttonText) : undefined;
      if (Object.prototype.hasOwnProperty.call(req.body, 'link')) {
        parsedData.link = req.body.link;
      }
      
      // 🔧 CRITICAL FIX: Only set fields that are explicitly provided with proper validation
      if (Object.prototype.hasOwnProperty.call(req.body, 'order')) {
        const raw = req.body.order;
        if (raw !== '' && raw != null && `${raw}`.trim() !== '') {
          const orderNum = Number(raw);
          if (Number.isFinite(orderNum)) parsedData.order = orderNum;
        }
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
        parsedData.isActive = req.body.isActive === 'true';
      }
      
      // Handle uploaded image
      if (req.file) {
        parsedData.image = `/uploads/slides/${req.file.filename}`;
      }
    } else {
      // 📊 JSON: Direct object assignment with robust type normalization
      const { title, description, image, link, buttonText, order, isActive } = req.body;
      parsedData.title = title;
      parsedData.description = description;
      parsedData.link = link;
      parsedData.buttonText = buttonText;
      
      // 🔒 CRITICAL FIX: Robust type normalization with presence checks
      if (Object.prototype.hasOwnProperty.call(req.body, 'order')) {
        const raw = req.body.order;
        if (raw !== '' && raw != null && `${raw}`.trim() !== '') {
          const orderNum = Number(raw);
          if (Number.isFinite(orderNum)) parsedData.order = orderNum;
        }
      }
      
      if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
        const v = req.body.isActive;
        parsedData.isActive = typeof v === 'string' ? v === 'true' : Boolean(v);
      }
      
      // 🖼️ IMAGE SAFETY: Only set image if non-empty valid path provided
      if (image && image !== '' && image != null) {
        parsedData.image = image;
      }
    }

    // 📝 BUILD UPDATE DATA: Only include defined fields
    const updateData: any = {};
    if (parsedData.title !== undefined) updateData.title = JSON.stringify(parsedData.title);
    if (parsedData.description !== undefined) updateData.description = JSON.stringify(parsedData.description);
    if (parsedData.link !== undefined) updateData.link = parsedData.link;
    if (parsedData.buttonText !== undefined) updateData.buttonText = parsedData.buttonText ? JSON.stringify(parsedData.buttonText) : null;
    if (parsedData.order !== undefined) updateData.order = parsedData.order;
    if (parsedData.isActive !== undefined) updateData.isActive = parsedData.isActive;
    updateData.updatedAt = new Date();

    // 🔒 SECURITY: Protect existing image from being overwritten (like newsController)
    const finalUpdateData: any = { ...updateData };
    if (parsedData.image !== undefined) {
      finalUpdateData.image = parsedData.image;
    } else {
      // Remove image field to avoid overwriting existing image
      delete finalUpdateData.image;
    }

    const slide = await prisma.slide.update({
      where: { id: parseInt(id) },
      data: finalUpdateData
    });

    res.json({
      success: true,
      data: slide,
      message: 'Slide updated successfully'
    });
  } catch (error) {
    console.error('Error updating slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update slide'
    });
  }
};

// Delete slide
export const deleteSlide = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingSlide = await prisma.slide.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSlide) {
      res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
      return;
    }

    await prisma.slide.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Slide deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete slide'
    });
  }
};

// Update slide order
export const updateSlideOrder = async (req: Request, res: Response) => {
  try {
    const { slides } = req.body; // Array of {id, order}

    const updatePromises = slides.map((slide: { id: number; order: number }) =>
      prisma.slide.update({
        where: { id: slide.id },
        data: { order: slide.order, updatedAt: new Date() }
      })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Slide order updated successfully'
    });
  } catch (error) {
    console.error('Error updating slide order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update slide order'
    });
  }
};