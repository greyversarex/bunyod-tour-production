import { Request, Response } from 'express';
import prisma from '../config/database';
import { parseMultilingualField, getLanguageFromRequest } from '../utils/multilingual';

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone } = req.body;

    // Validation
    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Full name and email are required',
      });
    }

    // Check if customer already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
    });

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email already exists',
      });
    }

    const customer = await prisma.customer.create({
      data: {
        fullName,
        email,
        phone,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer,
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getOrCreateCustomer = async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: 'Full name and email are required',
      });
    }

    let customer = await prisma.customer.findUnique({
      where: { email },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          fullName,
          email,
          phone,
        },
      });
    } else {
      // Update customer info if needed
      const updateData: any = {};
      if (customer.fullName !== fullName) updateData.fullName = fullName;
      if (phone && customer.phone !== phone) updateData.phone = phone;

      if (Object.keys(updateData).length > 0) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: updateData,
        });
      }
    }

    return res.json({
      success: true,
      message: customer ? 'Customer retrieved successfully' : 'Customer created successfully',
      data: customer,
    });
  } catch (error) {
    console.error('Error getting or creating customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get or create customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        orders: {
          include: {
            tour: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        reviews: {
          include: {
            tour: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Format the response
    const language = getLanguageFromRequest(req);
    
    const formattedCustomer = {
      ...customer,
      orders: customer.orders.map(order => ({
        ...order,
        tourists: JSON.parse(order.tourists),
        tour: {
          ...order.tour,
          title: parseMultilingualField(order.tour.title, language),
        },
      })),
      reviews: customer.reviews.map(review => ({
        ...review,
        tour: {
          ...review.tour,
          title: parseMultilingualField(review.tour.title, language),
        },
      })),
    };

    return res.json({
      success: true,
      data: formattedCustomer,
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getAllCustomers = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    const totalCustomers = await prisma.customer.count({ where });

    return res.json({
      success: true,
      data: customers,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalCustomers,
        totalPages: Math.ceil(totalCustomers / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone } = req.body;

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    const customer = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer,
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if customer has any orders or reviews
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            orders: true,
            reviews: true,
          },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    if (customer._count.orders > 0 || customer._count.reviews > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with existing orders or reviews',
      });
    }

    await prisma.customer.delete({
      where: { id: parseInt(id) },
    });

    return res.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};