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
    
    // Parse JSON fields
    const parsedOrders = orders.map(order => ({
      ...order,
      selectedCountries: safeJsonParse(order.selectedCountries),
      selectedCities: safeJsonParse(order.selectedCities),
      tourists: safeJsonParse(order.tourists),
      selectedComponents: safeJsonParse(order.selectedComponents),
    }));
    
    res.json({
      success: true,
      data: parsedOrders,
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
    
    // Parse JSON fields
    const parsedOrder = {
      ...order,
      selectedCountries: safeJsonParse(order.selectedCountries),
      selectedCities: safeJsonParse(order.selectedCities),
      tourists: safeJsonParse(order.tourists),
      selectedComponents: safeJsonParse(order.selectedComponents),
    };
    
    res.json({
      success: true,
      data: parsedOrder,
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
      totalPrice
    } = req.body;
    
    // Validation
    if (!fullName || !phone) {
      res.status(400).json({
        success: false,
        message: 'ФИО и телефон обязательны для заполнения'
      });
      return;
    }
    
    if (!selectedCountries || !Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо выбрать хотя бы одну страну'
      });
      return;
    }
    
    if (!tourists || !Array.isArray(tourists) || tourists.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо добавить хотя бы одного туриста'
      });
      return;
    }
    
    if (!selectedComponents || !Array.isArray(selectedComponents) || selectedComponents.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо выбрать хотя бы один компонент тура'
      });
      return;
    }
    
    // Create order
    const order = await prisma.customTourOrder.create({
      data: {
        fullName: fullName.trim(),
        email: email?.trim() || null,
        phone: phone.trim(),
        selectedCountries: JSON.stringify(selectedCountries),
        selectedCities: JSON.stringify(selectedCities || []),
        tourists: JSON.stringify(tourists),
        selectedComponents: JSON.stringify(selectedComponents),
        customerNotes: customerNotes?.trim() || null,
        totalPrice: totalPrice || null,
        status: 'pending',
      },
    });
    
    console.log('✅ Custom tour order created:', order.id);
    
    res.status(201).json({
      success: true,
      data: {
        ...order,
        selectedCountries: safeJsonParse(order.selectedCountries),
        selectedCities: safeJsonParse(order.selectedCities),
        tourists: safeJsonParse(order.tourists),
        selectedComponents: safeJsonParse(order.selectedComponents),
      },
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
    
    const updateData: any = {};
    
    if (status !== undefined) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (totalPrice !== undefined) updateData.totalPrice = totalPrice;
    
    const order = await prisma.customTourOrder.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    
    console.log('✅ Custom tour order updated:', order.id);
    
    res.json({
      success: true,
      data: {
        ...order,
        selectedCountries: safeJsonParse(order.selectedCountries),
        selectedCities: safeJsonParse(order.selectedCities),
        tourists: safeJsonParse(order.tourists),
        selectedComponents: safeJsonParse(order.selectedComponents),
      },
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
