import { Router, Request, Response } from 'express';
import { TransferRequestModel } from '../models';
import { CreateTransferRequestData, UpdateTransferRequestData } from '../types';
import { adminAuthMiddleware } from '../controllers/adminController';

const router = Router();

/**
 * Get all transfer requests (Admin only)
 * GET /api/transfer-requests
 */
router.get('/transfer-requests', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const transferRequests = await TransferRequestModel.findAll();
    res.json({
      success: true,
      data: transferRequests
    });
  } catch (error) {
    console.error('Error fetching transfer requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transfer requests'
    });
  }
});

/**
 * Get transfer requests by status (Admin only)
 * GET /api/transfer-requests/status/:status
 */
router.get('/transfer-requests/status/:status', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { status } = req.params;
    const transferRequests = await TransferRequestModel.findByStatus(status);
    res.json({
      success: true,
      data: transferRequests
    });
  } catch (error) {
    console.error('Error fetching transfer requests by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transfer requests'
    });
  }
});

/**
 * Get a single transfer request (Admin only)
 * GET /api/transfer-requests/:id
 */
router.get('/transfer-requests/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid transfer request ID'
      });
      return;
    }

    const transferRequest = await TransferRequestModel.findById(id);
    if (!transferRequest) {
      res.status(404).json({
        success: false,
        error: 'Transfer request not found'
      });
      return;
    }

    res.json({
      success: true,
      data: transferRequest
    });
  } catch (error) {
    console.error('Error fetching transfer request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transfer request'
    });
  }
});

/**
 * Create a new transfer request (Public endpoint for tourists)
 * POST /api/transfer-requests
 */
router.post('/transfer-requests', async (req: Request, res: Response) => {
  try {
    const data: CreateTransferRequestData = req.body;

    // Validate required fields
    if (!data.fullName || !data.pickupLocation || !data.dropoffLocation || 
        !data.pickupTime || !data.pickupDate) {
      res.status(400).json({
        success: false,
        error: 'Required fields: fullName, pickupLocation, dropoffLocation, pickupTime, pickupDate'
      });
      return;
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(data.pickupTime)) {
      res.status(400).json({
        success: false,
        error: 'Invalid time format. Use HH:MM format'
      });
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.pickupDate)) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format'
      });
      return;
    }

    const transferRequest = await TransferRequestModel.create(data);
    
    res.status(201).json({
      success: true,
      data: transferRequest,
      message: 'Transfer request created successfully'
    });
  } catch (error) {
    console.error('Error creating transfer request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create transfer request'
    });
  }
});

/**
 * Update a transfer request (Admin only)
 * PUT /api/transfer-requests/:id
 */
router.put('/transfer-requests/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid transfer request ID'
      });
      return;
    }

    const data: UpdateTransferRequestData = req.body;

    // Validate time format if provided
    if (data.pickupTime) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(data.pickupTime)) {
        res.status(400).json({
          success: false,
          error: 'Invalid time format. Use HH:MM format'
        });
        return;
      }
    }

    // Validate date format if provided
    if (data.pickupDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(data.pickupDate)) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format'
        });
        return;
      }
    }

    const transferRequest = await TransferRequestModel.update(id, data);
    
    res.json({
      success: true,
      data: transferRequest,
      message: 'Transfer request updated successfully'
    });
  } catch (error) {
    console.error('Error updating transfer request:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Transfer request not found'
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update transfer request'
    });
  }
});

/**
 * Approve a transfer request (Admin only)
 * POST /api/transfer-requests/:id/approve
 */
router.post('/transfer-requests/:id/approve', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid transfer request ID'
      });
      return;
    }

    const { adminNotes = 'Заявка одобрена администратором', finalPrice, assignedDriverId } = req.body || {};

    const transferRequest = await TransferRequestModel.approve(id, adminNotes, finalPrice, assignedDriverId);
    
    res.json({
      success: true,
      data: transferRequest,
      message: 'Transfer request approved successfully'
    });
  } catch (error) {
    console.error('Error approving transfer request:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Transfer request not found'
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Failed to approve transfer request'
    });
  }
});

/**
 * Reject a transfer request (Admin only)
 * POST /api/transfer-requests/:id/reject
 */
router.post('/transfer-requests/:id/reject', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid transfer request ID'
      });
      return;
    }

    const { adminNotes } = req.body;

    const transferRequest = await TransferRequestModel.reject(id, adminNotes);
    
    res.json({
      success: true,
      data: transferRequest,
      message: 'Transfer request rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting transfer request:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Transfer request not found'
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Failed to reject transfer request'
    });
  }
});

/**
 * Delete a transfer request (Admin only)
 * DELETE /api/transfer-requests/:id
 */
router.delete('/transfer-requests/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid transfer request ID'
      });
      return;
    }

    await TransferRequestModel.delete(id);
    
    res.json({
      success: true,
      message: 'Transfer request deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting transfer request:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Transfer request not found'
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Failed to delete transfer request'
    });
  }
});

export default router;