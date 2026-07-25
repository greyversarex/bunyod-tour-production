import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { sendEmail } from '../services/emailService';

// Утилита для парсинга JSON
const parseJsonField = (value: any): any => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
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
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
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

/**
 * Create a direct custom tour order with immediate payment (NO admin approval needed)
 * POST /api/custom-tour/create-payable-order
 * PUBLIC endpoint - tourist creates order and proceeds directly to payment
 */
export const createDirectCustomTourOrder = async (req: Request, res: Response): Promise<void> => {
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
      totalDays,
      language
    } = req.body;
    
    const customerLanguage = language || 'ru';

    // Strict validation
    if (!fullName || typeof fullName !== 'string' || !phone || typeof phone !== 'string') {
      res.status(400).json({
        success: false,
        message: 'ФИО и телефон обязательны'
      });
      return;
    }

    // Validate selectedCountries
    if (!selectedCountries || !Array.isArray(selectedCountries) || selectedCountries.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо выбрать хотя бы одну страну'
      });
      return;
    }

    // Validate tourists
    if (!tourists || !Array.isArray(tourists) || tourists.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо добавить хотя бы одного туриста'
      });
      return;
    }

    // Validate selectedComponents
    if (!selectedComponents || !Array.isArray(selectedComponents) || selectedComponents.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Необходимо выбрать хотя бы один компонент тура'
      });
      return;
    }

    // Validate totalDays
    if (!totalDays || typeof totalDays !== 'number' || totalDays < 1) {
      res.status(400).json({
        success: false,
        message: 'Укажите продолжительность тура — минимум 1 день'
      });
      return;
    }

    // SERVER-SIDE PRICE VALIDATION (Security)
    // Fetch components from database to verify prices
    const componentIds = selectedComponents.map((c: any) => c.id);
    const dbComponents = await prisma.customTourComponent.findMany({
      where: {
        id: { in: componentIds },
        isActive: true
      },
      include: {
        country: {
          select: {
            id: true,
            nameRu: true,
            nameEn: true
          }
        }
      }
    });

    if (dbComponents.length !== selectedComponents.length) {
      res.status(400).json({
        success: false,
        message: 'Некоторые компоненты недоступны'
      });
      return;
    }

    // Calculate totalPrice from server-side data (prevents price tampering)
    let calculatedTotalPrice = 0;
    for (const component of selectedComponents) {
      const dbComponent = dbComponents.find(c => c.id === component.id);
      if (!dbComponent) {
        res.status(400).json({
          success: false,
          message: `Компонент ${component.id} не найден`
        });
        return;
      }
      
      // Verify price matches (tolerance for floating point)
      if (Math.abs(dbComponent.price - component.price) > 0.01) {
        res.status(400).json({
          success: false,
          message: `Цена компонента ${component.id} изменилась. Обновите страницу.`
        });
        return;
      }

      calculatedTotalPrice += dbComponent.price * (component.quantity || 1);
    }

    // Round to 2 decimal places
    calculatedTotalPrice = Math.round(calculatedTotalPrice * 100) / 100;

    // Create or find customer
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          { phone }
        ]
      }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          fullName: fullName.trim(),
          email: email ? email.trim() : '',
          phone: phone.trim()
        }
      });
    }

    // Create Order with custom tour data stored in wishes field
    const orderNumber = `CT-${Date.now()}-${customer.id}`;
    
    // Store custom tour metadata in wishes field as JSON
    const customTourData = {
      type: 'custom_tour',
      selectedCountries,
      selectedCities: selectedCities || [],
      selectedComponents,
      totalDays,
      customerNotes: customerNotes || ''
    };

    // Create Order and CustomTourOrder atomically in a transaction (железобетонно)
    const order = await prisma.$transaction(async (tx) => {
      // Step 1: Create Order
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          tourDate: new Date().toISOString().split('T')[0], // Today as placeholder
          tourists: JSON.stringify(tourists.map((name: string) => ({
            name: name.trim(),
            phone: phone,
            email: email || ''
          }))),
          wishes: JSON.stringify(customTourData), // Store as JSON
          totalAmount: calculatedTotalPrice,
          status: 'pending',
          paymentStatus: 'unpaid',
          language: customerLanguage
        }
      });

      // Step 2: Create CustomTourOrder with orderId and orderNumber for robust idempotency
      await tx.customTourOrder.create({
        data: {
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          fullName: fullName.trim(),
          email: email ? email.trim() : '',
          phone: phone.trim(),
          selectedCountries: JSON.stringify(selectedCountries),
          selectedCities: JSON.stringify(selectedCities || []),
          tourists: JSON.stringify(tourists.map((name: string) => ({
            name: name.trim(),
            phone: phone,
            email: email || ''
          }))),
          selectedComponents: JSON.stringify(selectedComponents),
          customerNotes: customerNotes || null,
          totalPrice: calculatedTotalPrice,
          totalDays: totalDays,
          status: 'pending' // Will be updated to 'paid' by webhook
        }
      });

      return createdOrder;
    });

    console.log(`✅ Direct custom tour order created: ${order.orderNumber}, Amount: ${order.totalAmount} TJS, Tourist: ${fullName}`);

    // Send response FIRST (non-blocking)
    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        currency: 'TJS',
        orderId: order.id,
        paymentUrl: `/payment-selection.html?orderNumber=${order.orderNumber}&type=custom-tour`
      },
      message: 'Заказ создан успешно. Переходите к оплате.'
    });

    // Send admin notification email AFTER response (background)
    setImmediate(async () => {
      try {
        const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
        const countriesNames = dbComponents
          .map(c => parseJsonField(c.country?.nameRu) || c.country?.nameRu)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(', ');

        await sendEmail({
          to: adminEmail,
          subject: `Новый платный собственный тур - ${fullName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3E3E3E;">Новый платный собственный тур</h2>
              
              <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Информация о заказе</h3>
                <p><strong>Номер заказа:</strong> ${order.orderNumber}</p>
                <p><strong>Клиент:</strong> ${fullName}</p>
                <p><strong>Email:</strong> ${email || 'Не указан'}</p>
                <p><strong>Телефон:</strong> ${phone}</p>
                <p><strong>Страны:</strong> ${countriesNames || 'Не указано'}</p>
                <p><strong>Продолжительность:</strong> ${totalDays} дней</p>
                <p><strong>Количество туристов:</strong> ${tourists.length}</p>
                <p><strong>Сумма:</strong> ${calculatedTotalPrice} TJS</p>
                <p><strong>Компонентов выбрано:</strong> ${selectedComponents.length}</p>
              </div>

              <p><strong>Статус:</strong> Ожидает оплаты</p>
              
              <p style="margin-top: 30px;">
                <strong>Команда Bunyod Tour</strong>
              </p>
            </div>
          `
        });

        console.log(`📧 Admin notification sent for custom tour order ${order.orderNumber}`);
      } catch (emailError) {
        console.error('❌ Failed to send admin notification:', emailError);
        // Don't throw - email failure shouldn't block the order
      }
    });

  } catch (error) {
    console.error('❌ Error creating direct custom tour order:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при создании заказа'
    });
  }
};
