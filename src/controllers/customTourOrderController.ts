// @ts-nocheck
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';

/**
 * Get all custom tour orders (Admin only)
 * GET /api/custom-tour-orders
 */
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    
    const where: any = {};
    
    if (status && typeof status === 'string') {
      where.status = status;
    }
    
    const orders = await prisma.customTourOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('❌ Error fetching custom tour orders:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке заказов собственного тура'
    });
  }
};

/**
 * Get single custom tour order by ID (Admin only)
 * GET /api/custom-tour-orders/:id
 */
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const order = await prisma.customTourOrder.findUnique({
      where: { id: parseInt(id) },
    });
    
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Заказ не найден'
      });
      return;
    }
    
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('❌ Error fetching custom tour order:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при загрузке заказа'
    });
  }
};

/**
 * Create a new custom tour order (Public endpoint)
 * POST /api/custom-tour-orders
 */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      email,
      phone,
      selectedCountries,
      selectedCities,
      tourists,
      selectedComponents,
      customerNotes,
      totalPrice,
      totalDays
    } = req.body;
    
    // Strict validation of required fields
    if (!fullName || typeof fullName !== 'string' || !phone || typeof phone !== 'string') {
      res.status(400).json({
        success: false,
        message: 'ФИО и телефон обязательны для заполнения'
      });
      return;
    }
    
    // Validate selectedCountries: must be non-empty array of numbers
    if (!selectedCountries || !Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо выбрать хотя бы одну страну'
      });
      return;
    }
    if (!selectedCountries.every((id: any) => typeof id === 'number' && Number.isInteger(id))) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат данных стран'
      });
      return;
    }
    
    // Validate selectedCities: must be array of numbers (can be empty)
    if (selectedCities && !Array.isArray(selectedCities)) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат данных городов'
      });
      return;
    }
    if (selectedCities && !selectedCities.every((id: any) => typeof id === 'number' && Number.isInteger(id))) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат данных городов'
      });
      return;
    }
    
    // Validate tourists: must be non-empty array of strings
    if (!tourists || !Array.isArray(tourists) || tourists.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо добавить хотя бы одного туриста'
      });
      return;
    }
    if (!tourists.every((name: any) => typeof name === 'string' && name.trim().length > 0)) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат данных туристов'
      });
      return;
    }
    
    // Validate selectedComponents: must be non-empty array of objects with id, quantity, price
    if (!selectedComponents || !Array.isArray(selectedComponents) || selectedComponents.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо выбрать хотя бы один компонент тура'
      });
      return;
    }
    if (!selectedComponents.every((comp: any) => 
      comp && 
      typeof comp === 'object' &&
      typeof comp.id === 'number' && 
      typeof comp.quantity === 'number' && 
      typeof comp.price === 'number' &&
      comp.quantity > 0
    )) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат данных компонентов тура'
      });
      return;
    }
    
    // Validate optional email field
    if (email !== undefined && email !== null && typeof email !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Неверный формат email'
      });
      return;
    }
    
    // Validate optional customerNotes field
    if (customerNotes !== undefined && customerNotes !== null && typeof customerNotes !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Неверный формат заметок клиента'
      });
      return;
    }
    
    // Validate optional totalPrice field
    if (totalPrice !== undefined && totalPrice !== null && (typeof totalPrice !== 'number' || !Number.isFinite(totalPrice) || totalPrice < 0)) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат общей цены'
      });
      return;
    }
    
    // Validate optional totalDays field
    if (totalDays !== undefined && totalDays !== null && (typeof totalDays !== 'number' || !Number.isInteger(totalDays) || totalDays < 0)) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат общего количества дней'
      });
      return;
    }
    
    // Create order
    const order = await prisma.customTourOrder.create({
      data: {
        fullName: fullName.trim(),
        email: email ? email.trim() : null,
        phone: phone.trim(),
        selectedCountries,
        selectedCities: selectedCities ?? [],
        tourists,
        selectedComponents,
        customerNotes: customerNotes ? customerNotes.trim() : null,
        totalPrice: totalPrice ?? null,
        totalDays: totalDays ?? null,
        status: 'pending',
      },
    });
    
    console.log('✅ Custom tour order created:', order.id);
    
    res.status(201).json({
      success: true,
      data: order,
      message: 'Заказ успешно создан'
    });
  } catch (error) {
    console.error('❌ Error creating custom tour order:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании заказа'
    });
  }
};

/**
 * Update custom tour order (Admin only)
 * PUT /api/custom-tour-orders/:id
 */
export const updateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      status,
      adminNotes,
      totalPrice
    } = req.body;
    
    // Validate optional fields before update
    if (status !== undefined && typeof status !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Неверный формат статуса'
      });
      return;
    }
    
    if (adminNotes !== undefined && adminNotes !== null && typeof adminNotes !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Неверный формат заметок администратора'
      });
      return;
    }
    
    if (totalPrice !== undefined && totalPrice !== null && (typeof totalPrice !== 'number' || !Number.isFinite(totalPrice) || totalPrice < 0)) {
      res.status(400).json({
        success: false,
        message: 'Неверный формат общей цены'
      });
      return;
    }
    
    const updateData: any = {};
    
    if (status !== undefined) updateData.status = status;
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;
    if (totalPrice !== undefined) updateData.totalPrice = totalPrice;
    
    const order = await prisma.customTourOrder.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    
    console.log('✅ Custom tour order updated:', order.id);
    
    res.json({
      success: true,
      data: order,
      message: 'Заказ успешно обновлен'
    });
  } catch (error) {
    console.error('❌ Error updating custom tour order:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при обновлении заказа'
    });
  }
};

/**
 * Delete custom tour order (Admin only)
 * DELETE /api/custom-tour-orders/:id
 */
export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await prisma.customTourOrder.delete({
      where: { id: parseInt(id) },
    });
    
    console.log('✅ Custom tour order deleted:', id);
    
    res.json({
      success: true,
      message: 'Заказ успешно удален'
    });
  } catch (error) {
    console.error('❌ Error deleting custom tour order:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при удалении заказа'
    });
  }
};
