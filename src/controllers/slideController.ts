// @ts-nocheck
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { safeJsonParse } from '../utils/multilingual';
import prisma from '../config/database';

// 🔧 NORMALIZE MULTILINGUAL: Ensures {ru, en} structure with both fields present
// Handles: strings, objects {ru}, objects {ru, en}, null/undefined
// This prevents any 500 errors and ensures consistency across the API
function normalizeML(input: any): { ru: string; en: string } {
  try {
    // Handle null/undefined
    if (!input) return { ru: "", en: "" };

    // Handle plain string - treat as Russian text
    if (typeof input === "string") {
      return { ru: input, en: "" };
    }

    // Handle object
    if (typeof input === "object") {
      return {
        ru: typeof input.ru === "string" ? input.ru : "",
        en: typeof input.en === "string" ? input.en : "",
      };
    }

    // Fallback for any other type
    return { ru: "", en: "" };
  } catch {
    return { ru: "", en: "" };
  }
}

// 🛡️ SAFE JSON PARSER for reading from DB: Never throws, always returns valid multilingual object
const parseML = (v: any) => {
  try {
    if (v == null) return { ru: "", en: "" };
    const obj = typeof v === "string" ? JSON.parse(v) : v;
    if (obj && typeof obj === "object") {
      // Ensure both keys exist
      return normalizeML(obj);
    }
    return { ru: String(v ?? ""), en: "" };
  } catch {
    return { ru: "", en: "" };
  }
};

// Get all slides - BULLETPROOF: Never throws on malformed data
export const getSlides = async (req: Request, res: Response) => {
  try {
    const rows = await prisma.slide.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { city: true }
    });

    // 🛡️ SAFE MAPPING: Parse all JSON fields safely, no exceptions
    const data = rows.map(s => ({
      id: s.id,
      title: parseML(s.title),
      description: parseML(s.description),
      image: s.image,
      link: s.link ?? null,
      buttonText: s.buttonText ? parseML(s.buttonText) : null,
      order: s.order,
      isActive: s.isActive,
      city: s.city ? { id: s.city.id, name: s.city.name } : null
    }));

    res.json({
      success: true,
      data
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
    const rows = await prisma.slide.findMany({
      orderBy: { order: 'asc' },
      include: { city: true }
    });

    // 🛡️ SAFE MAPPING: Parse all JSON fields for admin panel
    const data = rows.map(s => ({
      id: s.id,
      title: parseML(s.title),
      description: parseML(s.description),
      image: s.image,
      link: s.link ?? null,
      buttonText: s.buttonText ? parseML(s.buttonText) : null,
      order: s.order,
      isActive: s.isActive,
      cityId: s.cityId,
      city: s.city ? { id: s.city.id, name: s.city.name } : null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));

    res.json({
      success: true,
      data
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
      where: { id: parseInt(id) },
      include: { city: true }
    });

    if (!slide) {
      res.status(404).json({
        success: false,
        message: 'Slide not found'
      });
      return;
    }

    // 🛡️ ALWAYS parse JSON fields correctly for admin panel
    const responseData = {
      id: slide.id,
      title: parseML(slide.title),
      description: parseML(slide.description),
      image: slide.image,
      link: slide.link ?? null,
      buttonText: slide.buttonText ? parseML(slide.buttonText) : null,
      order: slide.order,
      isActive: slide.isActive,
      cityId: slide.cityId,
      city: slide.city ? { id: slide.city.id, name: slide.city.name } : null,
      createdAt: slide.createdAt,
      updatedAt: slide.updatedAt
    };

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
    
    // 🔧 ROBUST PARSING: Parse and normalize to ensure {ru, en} structure
    const titleRaw = req.body.title ? safeJsonParse(req.body.title) : {};
    const descriptionRaw = req.body.description ? safeJsonParse(req.body.description) : {};
    const buttonTextRaw = req.body.buttonText ? safeJsonParse(req.body.buttonText) : null;
    
    // ✅ GUARANTEE: Always {ru, en} even if en is missing
    const title = normalizeML(titleRaw);
    const description = normalizeML(descriptionRaw);
    const buttonText = buttonTextRaw ? normalizeML(buttonTextRaw) : null;
    
    const link = req.body.link || '';
    const order = parseInt(req.body.order) || 0;
    const isActive = req.body.isActive === 'true';

    const cityId = req.body.cityId ? parseInt(req.body.cityId) : null;

    // 🚀 PRISMA JSON: Save as object directly, NOT stringified
    const slide = await prisma.slide.create({
      data: {
        title: title as Prisma.InputJsonValue,
        description: description as Prisma.InputJsonValue,
        image: imagePath,
        link,
        buttonText: buttonText ? (buttonText as Prisma.InputJsonValue) : Prisma.DbNull,
        order,
        isActive,
        ...(cityId ? { city: { connect: { id: cityId } } } : {})
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
      if (Object.prototype.hasOwnProperty.call(req.body, 'cityId')) {
        const cityIdRaw = req.body.cityId;
        parsedData.cityId = cityIdRaw ? parseInt(cityIdRaw) : null;
      }
      
      // Handle uploaded image
      if (req.file) {
        parsedData.image = `/uploads/slides/${req.file.filename}`;
      }
    } else {
      // 📊 JSON: Direct object assignment with robust type normalization
      const { title, description, image, link, buttonText, order, isActive, cityId } = req.body;
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
      
      if (Object.prototype.hasOwnProperty.call(req.body, 'cityId')) {
        parsedData.cityId = cityId ? parseInt(cityId) : null;
      }
      
      // 🖼️ IMAGE SAFETY: Only set image if non-empty valid path provided
      if (image && image !== '' && image != null) {
        parsedData.image = image;
      }
    }

    // 📝 BUILD UPDATE DATA: Normalize multilingual fields and save as objects
    const updateData: any = {};
    
    // ✅ GUARANTEE: Always {ru, en} structure when saving
    if (parsedData.title !== undefined) {
      updateData.title = normalizeML(parsedData.title) as Prisma.InputJsonValue;
    }
    if (parsedData.description !== undefined) {
      updateData.description = normalizeML(parsedData.description) as Prisma.InputJsonValue;
    }
    if (parsedData.link !== undefined) updateData.link = parsedData.link;
    if (parsedData.buttonText !== undefined) {
      updateData.buttonText = parsedData.buttonText 
        ? (normalizeML(parsedData.buttonText) as Prisma.InputJsonValue)
        : Prisma.DbNull;
    }
    if (parsedData.order !== undefined) updateData.order = parsedData.order;
    if (parsedData.isActive !== undefined) updateData.isActive = parsedData.isActive;
    
    // 🔧 CITY RELATION: Use Prisma relation syntax
    if (parsedData.cityId !== undefined) {
      if (parsedData.cityId === null) {
        updateData.city = { disconnect: true };
      } else {
        updateData.city = { connect: { id: parsedData.cityId } };
      }
    }
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