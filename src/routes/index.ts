import { Router } from 'express';
import tourRoutes from './tourRoutes';
import categoryRoutes from './categoryRoutes';
import hotelRoutes from './hotelRoutes';
import guideRoutes from './guideRoutes';
import orderRoutes from './orderRoutes';
import reviewRoutes from './reviewRoutes';
import customerRoutes from './customerRoutes';
import paymentRoutes from './paymentRoutes';
import cmsRoutes from './cmsRoutes';
import adminRoutes from './adminRoutes';
import publicRoutes from './publicRoutes';
import tourBlockRoutes from './tourBlockRoutes';
import translationRoutes from './translationRoutes';
import exchangeRateRoutes from './exchangeRateRoutes';
import newsRoutes from './newsRoutes';
import slideRoutes from './slideRoutes';
import objectStorageRoutes from './objectStorageRoutes';
import bookingRoutes from './bookingRoutes';
import uploadRoutes from './uploadRoutes';
import objectsRoutes from './objectsRoutes';
import priceCalculatorRoutes from './priceCalculatorRoutes';
// Tour guide cabinet system
import tourGuideRoutes from './tourGuideRoutes';
import adminTourHistoryRoutes from './adminTourHistoryRoutes';
// Driver system
import driverRoutes from './driverRoutes';
// Location system
import countryRoutes from './countryRoutes';
import cityRoutes from './cityRoutes';
// Trip system
import tripRoutes from './tripRoutes';
import tourAgentRoutes from './tourAgentRoutes';
// Transfer system
import transferRoutes from './transferRoutes';
// Guide hire system
import guideHireRoutes from './guideHireRoutes';

// Remove old SQLite database routes (now using Prisma)

const router = Router();

// Mount routes - proper API structure
router.use('/tours', tourRoutes); 
router.use('/categories', categoryRoutes);
router.use('/hotels', hotelRoutes);
router.use('/guides', guideRoutes);
router.use('/orders', orderRoutes);
router.use('/reviews', reviewRoutes);
router.use('/customers', customerRoutes);
router.use('/payments', paymentRoutes);
router.use('/cms', cmsRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);
router.use('/tour-blocks', tourBlockRoutes);
router.use('/translate', translationRoutes);
router.use('/exchange-rates', exchangeRateRoutes);
router.use('/news', newsRoutes);
router.use('/slides', slideRoutes);
router.use('/booking', bookingRoutes);
router.use('/images', uploadRoutes); // Add images endpoint for frontend compatibility
router.use('/objects', objectsRoutes); // Add objects endpoint for ObjectUploader
router.use('/price-calculator', priceCalculatorRoutes); // Add price calculator endpoints
router.use('/guide', tourGuideRoutes); // Tour guide authentication and management
router.use('/admin', adminTourHistoryRoutes); // Admin tour history and guide management
router.use('/drivers', driverRoutes); // Driver management and authentication
router.use('/countries', countryRoutes); // Countries management
router.use('/cities', cityRoutes); // Cities management
router.use('/trips', tripRoutes); // Trip management
router.use('/tour-agents', tourAgentRoutes); // Tour agents management
router.use('/transfers', transferRoutes); // Transfer requests management
router.use('/guide-hire', guideHireRoutes); // Guide hiring system
router.use('/', objectStorageRoutes);

// All data access now through Prisma models

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Tajik Trails API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0'
  });
});

export default router;
