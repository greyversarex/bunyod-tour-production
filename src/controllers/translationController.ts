import { Request, Response } from 'express';
import { translationService } from '../services/translationService';
import { TourModel } from '../models/index';
import { safeJsonParse } from '../utils/multilingual';

/**
 * Controller for handling translation requests
 */
export class TranslationController {
  
  /**
   * Translate text from one language to another
   * POST /api/translate/text
   */
  async translateText(req: Request, res: Response): Promise<Response> {
    try {
      const { text, fromLanguage, toLanguage, context } = req.body;

      if (!text || !fromLanguage || !toLanguage) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: text, fromLanguage, toLanguage'
        });
      }

      const result = await translationService.translateText({
        text,
        fromLanguage,
        toLanguage,
        context
      });

      return res.json({
        success: true,
        data: result,
        message: 'Text translated successfully'
      });

    } catch (error) {
      console.error('Translation controller error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed'
      });
    }
  }

  /**
   * Auto-translate tour content to missing languages
   * POST /api/translate/tour/:id
   */
  async translateTour(req: Request, res: Response): Promise<Response> {
    try {
      const tourId = parseInt(req.params.id);
      
      if (isNaN(tourId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tour ID'
        });
      }

      // Get existing tour
      const tour = await TourModel.findById(tourId);
      if (!tour) {
        return res.status(404).json({
          success: false,
          error: 'Tour not found'
        });
      }

      // Parse existing multilingual content safely
      const existingTitle = safeJsonParse(tour.title, { ru: '', en: '' });
      const existingDescription = safeJsonParse(tour.description, { ru: '', en: '' });

      // Translate missing languages
      const [translatedTitle, translatedDescription] = await Promise.all([
        translationService.translateMultilingualContent(existingTitle, 'tour_description'),
        translationService.translateMultilingualContent(existingDescription, 'tour_description')
      ]);

      // Update tour with new translations
      const updatedTour = await TourModel.update(tourId, {
        title: translatedTitle,
        description: translatedDescription
      });

      return res.json({
        success: true,
        data: updatedTour,
        message: 'Tour translations completed successfully'
      });

    } catch (error) {
      console.error('Tour translation error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Tour translation failed'
      });
    }
  }

  /**
   * Detect language of provided text
   * POST /api/translate/detect
   */
  async detectLanguage(req: Request, res: Response): Promise<Response> {
    try {
      const { text } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Text is required'
        });
      }

      const detectedLanguage = await translationService.detectLanguage(text);

      return res.json({
        success: true,
        data: {
          language: detectedLanguage,
          text: text
        },
        message: 'Language detected successfully'
      });

    } catch (error) {
      console.error('Language detection error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Language detection failed'
      });
    }
  }

  /**
   * Get supported languages
   * GET /api/translate/languages
   */
  async getSupportedLanguages(req: Request, res: Response): Promise<Response> {
    try {
      const { SUPPORTED_LANGUAGES } = await import('../services/translationService');
      
      return res.json({
        success: true,
        data: SUPPORTED_LANGUAGES,
        message: 'Supported languages retrieved successfully'
      });

    } catch (error) {
      console.error('Get languages error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve supported languages'
      });
    }
  }

  /**
   * Batch translate multiple tours
   * POST /api/translate/tours/batch
   */
  async batchTranslateTours(req: Request, res: Response): Promise<Response> {
    try {
      const { tourIds } = req.body;

      if (!Array.isArray(tourIds) || tourIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'tourIds array is required'
        });
      }

      const results = [];
      const errors = [];

      for (const tourId of tourIds) {
        try {
          const tour = await TourModel.findById(parseInt(tourId));
          if (!tour) {
            errors.push(`Tour ${tourId} not found`);
            continue;
          }

          const existingTitle = safeJsonParse(tour.title, { ru: '', en: '' });
          const existingDescription = safeJsonParse(tour.description, { ru: '', en: '' });

          const [translatedTitle, translatedDescription] = await Promise.all([
            translationService.translateMultilingualContent(existingTitle, 'tour_description'),
            translationService.translateMultilingualContent(existingDescription, 'tour_description')
          ]);

          const updatedTour = await TourModel.update(parseInt(tourId), {
            title: translatedTitle,
            description: translatedDescription
          });

          results.push({
            tourId: tourId,
            success: true,
            tour: updatedTour
          });

        } catch (error) {
          errors.push(`Tour ${tourId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return res.json({
        success: true,
        data: {
          successful: results,
          errors: errors,
          totalProcessed: tourIds.length,
          successCount: results.length,
          errorCount: errors.length
        },
        message: `Batch translation completed. ${results.length} successful, ${errors.length} errors.`
      });

    } catch (error) {
      console.error('Batch translation error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Batch translation failed'
      });
    }
  }
}

export const translationController = new TranslationController();