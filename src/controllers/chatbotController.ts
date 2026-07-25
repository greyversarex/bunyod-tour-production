import { Request, Response } from 'express';
import prisma from '../config/database';

let openai: any = null;
let gemini: any = null;
let aiProvider: 'openai' | 'gemini' | null = null;
let initializationAttempted = false;

function initializeAI() {
  if (initializationAttempted) return;
  initializationAttempted = true;

  // Логируем доступные ключи для диагностики
  const gatewayAiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const gatewayAiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiBaseUrl = process.env.OPENAI_BASE_URL; // Поддержка прокси
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  console.log('🔍 AI Chatbot: Checking available providers...');
  console.log(`   - AI gateway: ${gatewayAiKey && gatewayAiBase ? 'available' : 'not configured'}`);
  console.log(`   - OpenAI: ${openaiKey ? 'available' : 'not configured'}${openaiBaseUrl ? ` (proxy: ${openaiBaseUrl})` : ''}`);
  console.log(`   - Gemini: ${geminiKey ? 'available' : 'not configured'}`);

  // Приоритет настраивается через AI_PROVIDER env (gemini, openai, auto)
  const preferredProvider = process.env.AI_PROVIDER?.toLowerCase() || 'auto';
  console.log(`   - Preferred provider: ${preferredProvider}`);

  // Если явно указан Gemini как приоритет
  if (preferredProvider === 'gemini' && geminiKey) {
    if (tryInitGemini(geminiKey)) return;
  }

  // Если явно указан OpenAI как приоритет
  if (preferredProvider === 'openai') {
    if (gatewayAiKey && gatewayAiBase && tryInitGatewayAI(gatewayAiKey, gatewayAiBase)) return;
    if (openaiKey && tryInitOpenAI(openaiKey, openaiBaseUrl)) return;
  }

  // Auto: пробуем все по порядку
  // 1. Корпоративный AI-шлюз, если настроен
  if (gatewayAiKey && gatewayAiBase && tryInitGatewayAI(gatewayAiKey, gatewayAiBase)) return;

  // 2. Внешний OpenAI (с поддержкой прокси)
  if (openaiKey && tryInitOpenAI(openaiKey, openaiBaseUrl)) return;

  // 3. Google Gemini (лучший вариант для регионов где OpenAI заблокирован)
  if (geminiKey && tryInitGemini(geminiKey)) return;

  console.log('⚠️ AI Chatbot disabled - no API keys configured');
  console.log('   Set one of: OPENAI_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY');
  aiProvider = null;
}

function tryInitGatewayAI(apiKey: string, baseUrl: string): boolean {
  try {
    const OpenAI = require('openai').default;
    openai = new OpenAI({ apiKey, baseURL: baseUrl });
    aiProvider = 'openai';
    console.log('✅ AI Chatbot: AI gateway initialized');
    return true;
  } catch (e) {
    console.log('⚠️ AI gateway init failed:', (e as Error).message);
    return false;
  }
}

function tryInitOpenAI(apiKey: string, baseUrl?: string): boolean {
  try {
    const OpenAI = require('openai').default;
    const config: any = { apiKey };
    if (baseUrl) {
      config.baseURL = baseUrl;
      console.log(`   Using OpenAI proxy: ${baseUrl}`);
    }
    openai = new OpenAI(config);
    aiProvider = 'openai';
    console.log('✅ AI Chatbot: OpenAI initialized');
    return true;
  } catch (e) {
    console.log('⚠️ OpenAI init failed:', (e as Error).message);
    return false;
  }
}

function tryInitGemini(apiKey: string): boolean {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    gemini = new GoogleGenerativeAI(apiKey);
    aiProvider = 'gemini';
    console.log('✅ AI Chatbot: Gemini initialized');
    return true;
  } catch (e) {
    console.log('⚠️ Gemini init failed:', (e as Error).message);
    return false;
  }
}

// Функция для переключения на Gemini при ошибках OpenAI
function switchToGemini(): boolean {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    console.log('⚠️ Cannot switch to Gemini - no API key');
    return false;
  }
  
  if (gemini && aiProvider === 'gemini') {
    return true; // Уже на Gemini
  }
  
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    gemini = new GoogleGenerativeAI(geminiKey);
    aiProvider = 'gemini';
    console.log('🔄 AI Chatbot: Switched to Gemini as fallback');
    return true;
  } catch (e) {
    console.log('⚠️ Gemini fallback init failed:', (e as Error).message);
    return false;
  }
}

const systemPromptRu = `Ты - дружелюбный AI-помощник туристической компании Bunyod-Tour, специализирующейся на турах по Центральной Азии (Таджикистан, Узбекистан, Казахстан, Туркменистан, Кыргызстан).

Ты можешь помочь с:
- Информацией о турах (цены, маршруты, длительность)
- Бронированием туров и отелей
- Услугами гидов и водителей
- Визовыми вопросами
- Достопримечательностями региона
- Транспортными услугами

Будь вежлив, информативен и полезен. Если не знаешь точного ответа, предложи связаться с менеджерами через WhatsApp или Telegram.

Контакты:
- WhatsApp: +992 91 512 33 44 (Hikmatullo), +992 88 235 34 34 (Oyatullo), +992 55 067 06 60 (Sitoramo)
- Telegram: @bunyodtour2021

Отвечай кратко и по существу.`;

const systemPromptEn = `You are a friendly AI assistant for Bunyod-Tour travel company, specializing in tours across Central Asia (Tajikistan, Uzbekistan, Kazakhstan, Turkmenistan, Kyrgyzstan).

You can help with:
- Tour information (prices, routes, duration)
- Tour and hotel bookings
- Guide and driver services
- Visa questions
- Regional attractions
- Transportation services

Be polite, informative, and helpful. If you don't know the exact answer, suggest contacting managers via WhatsApp or Telegram.

Contacts:
- WhatsApp: +992 91 512 33 44 (Hikmatullo), +992 88 235 34 34 (Oyatullo), +992 55 067 06 60 (Sitoramo)
- Telegram: @bunyodtour2021

Keep responses brief and to the point.`;

async function getToursContext(language: string): Promise<string> {
  try {
    const tours = await prisma.tour.findMany({
      where: { isActive: true },
      take: 10,
      select: {
        id: true,
        title: true,
        price: true,
        duration: true,
      }
    });

    if (tours.length > 0) {
      return '\n\nДоступные туры:\n' + tours.map((t) => {
        const title = typeof t.title === 'object' ? (t.title as Record<string, string>)[language] || (t.title as Record<string, string>).ru : t.title;
        return `- ${title}: ${t.price} TJS, ${t.duration}`;
      }).join('\n');
    }
  } catch (e) {
  }
  return '';
}

async function chatWithOpenAI(message: string, systemPrompt: string): Promise<string> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ],
    max_completion_tokens: 500,
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content || '';
}

async function chatWithGemini(message: string, systemPrompt: string): Promise<string> {
  // Модель можно настроить через env
  const preferredModel = process.env.GEMINI_MODEL;
  
  const modelNames = preferredModel 
    ? [preferredModel]
    : [
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro',
        'gemini-1.5-pro-latest',
        'gemini-1.0-pro',
        'gemini-pro',
        'gemini-2.0-flash-exp',
      ];
  
  let lastError: any = null;
  
  for (const modelName of modelNames) {
    try {
      const model = gemini.getGenerativeModel({ model: modelName });
      const chat = model.startChat({
        history: [],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.7,
        },
      });
      
      const fullPrompt = `${systemPrompt}\n\nПользователь: ${message}`;
      const result = await chat.sendMessage(fullPrompt);
      const response = await result.response;
      console.log(`✅ AI Chatbot: Successfully used model ${modelName}`);
      return response.text() || '';
    } catch (modelError: any) {
      lastError = modelError;
      const errorMsg = modelError?.message || modelError?.toString() || 'Unknown error';
      console.log(`⚠️ Model ${modelName} failed: ${errorMsg.substring(0, 100)}`);
      continue;
    }
  }
  
  console.error('❌ All Gemini models failed. Last error:', lastError?.message || lastError);
  throw new Error('No Gemini models available');
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { message, language = 'ru' } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    initializeAI();

    if (!aiProvider) {
      const unavailableMsg = language === 'en' 
        ? 'AI assistant is temporarily unavailable. Please contact us via WhatsApp or Telegram.'
        : 'AI-помощник временно недоступен. Свяжитесь с нами через WhatsApp или Telegram.';
      res.json({ reply: unavailableMsg });
      return;
    }

    const systemPrompt = language === 'en' ? systemPromptEn : systemPromptRu;
    const toursContext = await getToursContext(language);
    const fullSystemPrompt = systemPrompt + toursContext;

    let reply: string;
    
    if (aiProvider === 'openai') {
      try {
        reply = await chatWithOpenAI(message, fullSystemPrompt);
      } catch (openaiError: any) {
        // Логируем ошибку OpenAI для диагностики
        const errorCode = openaiError?.code || openaiError?.status || 'unknown';
        const errorMsg = openaiError?.message || openaiError?.toString() || 'Unknown error';
        console.error(`❌ OpenAI error [${errorCode}]: ${errorMsg}`);
        
        // Пробуем переключиться на Gemini при ЛЮБОЙ ошибке OpenAI
        console.log('🔄 Attempting Gemini fallback...');
        if (switchToGemini()) {
          try {
            reply = await chatWithGemini(message, fullSystemPrompt);
          } catch (geminiError: any) {
            console.error('❌ Gemini fallback also failed:', geminiError?.message);
            throw openaiError; // Возвращаем оригинальную ошибку
          }
        } else {
          throw openaiError;
        }
      }
    } else {
      reply = await chatWithGemini(message, fullSystemPrompt);
    }

    if (!reply) {
      reply = language === 'en' 
        ? 'Sorry, I could not process your request. Please try again.' 
        : 'Извините, не удалось обработать запрос. Попробуйте еще раз.';
    }

    res.json({ reply });
  } catch (error: any) {
    console.error('Chatbot error:', error?.message || error);
    
    const language = req.body?.language || 'ru';
    const errorMessage = language === 'en' 
      ? 'Sorry, an error occurred. Please contact us via WhatsApp or Telegram.'
      : 'Извините, произошла ошибка. Свяжитесь с нами через WhatsApp или Telegram.';
    
    res.status(500).json({ reply: errorMessage });
  }
}

// Эндпоинт для проверки статуса AI
export async function getAIStatus(req: Request, res: Response): Promise<void> {
  initializeAI();
  
  res.json({
    status: aiProvider ? 'active' : 'disabled',
    provider: aiProvider,
    availableProviders: {
      aiGateway: !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL),
      openai: !!process.env.OPENAI_API_KEY,
      openaiProxy: process.env.OPENAI_BASE_URL || null,
      gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    },
    preferredProvider: process.env.AI_PROVIDER || 'auto',
  });
}
