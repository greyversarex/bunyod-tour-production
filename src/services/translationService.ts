import OpenAI from "openai";

// Translation service is optional - if no OPENAI_API_KEY, translation features will be disabled
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Supported languages for the tourism platform
export const SUPPORTED_LANGUAGES = {
  'ru': 'Russian',
  'en': 'English', 
  'tj': 'Tajik',
  'fa': 'Persian/Farsi',
  'de': 'German',
  'zh': 'Chinese'
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

interface TranslationRequest {
  text: string;
  fromLanguage: SupportedLanguage;
  toLanguage: SupportedLanguage;
  context?: 'tour_description' | 'tour_itinerary' | 'hotel_description' | 'guide_description';
}

interface TranslationResponse {
  translatedText: string;
  fromLanguage: SupportedLanguage;
  toLanguage: SupportedLanguage;
  confidence?: number;
}

/**
 * Translation service using OpenAI GPT-4o for high-quality multilingual translations
 * specialized for tourism content in Central Asia
 */
export class TranslationService {
  
  /**
   * Translate text from one language to another
   */
  async translateText({
    text,
    fromLanguage,
    toLanguage,
    context = 'tour_description'
  }: TranslationRequest): Promise<TranslationResponse> {
    
    if (!openai) {
      throw new Error('Translation service is not available. Please configure OPENAI_API_KEY environment variable.');
    }
    
    if (fromLanguage === toLanguage) {
      return {
        translatedText: text,
        fromLanguage,
        toLanguage,
        confidence: 1.0
      };
    }

    const contextPrompts = {
      tour_description: 'tourism marketing content describing travel experiences, attractions, and activities',
      tour_itinerary: 'detailed day-by-day travel schedule with activities, locations, and timing',
      hotel_description: 'hospitality content describing accommodations, amenities, and services',
      guide_description: 'professional descriptions of tour guides, their expertise and experience'
    };

    const systemPrompt = `You are a professional translator specializing in tourism content for Central Asia. 
You must translate ${SUPPORTED_LANGUAGES[fromLanguage]} text to ${SUPPORTED_LANGUAGES[toLanguage]} with high accuracy.

Context: This is ${contextPrompts[context]}.

Important guidelines:
- Maintain the original tone and style
- Preserve tourism-specific terminology and proper names
- Keep cultural context appropriate for Central Asian tourism
- Maintain formatting and structure
- For place names, use the most commonly accepted spelling in the target language
- For currencies, convert to local context when appropriate

Respond with only the translated text, no additional commentary.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: text
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent translations
        max_tokens: 2000
      });

      const translatedText = response.choices[0]?.message?.content?.trim();
      
      if (!translatedText) {
        throw new Error('No translation received from OpenAI');
      }

      return {
        translatedText,
        fromLanguage,
        toLanguage,
        confidence: 0.9 // High confidence for GPT-4o translations
      };
      
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Translate multilingual object to add missing languages
   */
  async translateMultilingualContent(
    content: Partial<Record<SupportedLanguage, string>>,
    context: TranslationRequest['context'] = 'tour_description'
  ): Promise<Record<SupportedLanguage, string>> {
    
    // Find the source language (first available language)
    const sourceLanguage = Object.keys(content).find(lang => 
      content[lang as SupportedLanguage]?.trim()
    ) as SupportedLanguage;

    if (!sourceLanguage || !content[sourceLanguage]) {
      throw new Error('No source content found for translation');
    }

    const sourceText = content[sourceLanguage]!;
    const result: Record<SupportedLanguage, string> = { ...content } as Record<SupportedLanguage, string>;

    // Translate to all missing languages
    const missingLanguages = (Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[])
      .filter(lang => !content[lang]?.trim());

    for (const targetLanguage of missingLanguages) {
      try {
        const translation = await this.translateText({
          text: sourceText,
          fromLanguage: sourceLanguage,
          toLanguage: targetLanguage,
          context
        });
        
        result[targetLanguage] = translation.translatedText;
      } catch (error) {
        console.error(`Failed to translate to ${targetLanguage}:`, error);
        // Continue with other languages even if one fails
      }
    }

    return result;
  }

  /**
   * Detect language of given text
   */
  async detectLanguage(text: string): Promise<SupportedLanguage> {
    if (!openai) {
      console.warn('Translation service not available - defaulting to English');
      return 'en';
    }
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Detect the language of the given text. Respond with only one of these language codes: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}. If uncertain, respond with 'en'.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      const detectedLang = response.choices[0]?.message?.content?.trim()?.toLowerCase() as SupportedLanguage;
      
      // Validate the detected language is supported
      if (detectedLang && detectedLang in SUPPORTED_LANGUAGES) {
        return detectedLang;
      }
      
      return 'en'; // Default fallback
      
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en'; // Default fallback
    }
  }
}

export const translationService = new TranslationService();