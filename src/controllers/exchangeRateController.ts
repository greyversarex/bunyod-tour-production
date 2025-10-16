import { Request, Response } from 'express';
import prisma from '../config/database';

// Получить все курсы валют
export const getExchangeRates = async (req: Request, res: Response) => {
    try {
        const rates = await prisma.exchangeRate.findMany({
            where: { isActive: true },
            orderBy: { currency: 'asc' }
        });

        // Сортируем так, чтобы TJS была первой (базовая валюта)
        const sortedRates = rates.sort((a: any, b: any) => {
            if (a.currency === 'TJS') return -1;
            if (b.currency === 'TJS') return 1;
            return a.currency.localeCompare(b.currency);
        });
        
        res.json({
            success: true,
            data: sortedRates
        });
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении курсов валют'
        });
    }
};

// Получить курсы валют в виде объекта для конвертации
export const getExchangeRatesMap = async (req: Request, res: Response) => {
    try {
        const rates = await prisma.exchangeRate.findMany({
            where: { isActive: true }
        });
        
        const ratesMap: { [key: string]: { rate: number, symbol: string, name: string } } = {};
        rates.forEach((rate: any) => {
            ratesMap[rate.currency] = {
                rate: rate.rate,
                symbol: rate.symbol,
                name: rate.name
            };
        });
        
        res.json({
            success: true,
            data: ratesMap
        });
    } catch (error) {
        console.error('Error fetching exchange rates map:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при получении курсов валют'
        });
    }
};

// Обновить курс валюты
export const updateExchangeRate = async (req: Request, res: Response) => {
    try {
        const { currency } = req.params;
        const { rate, symbol, name } = req.body;

        const updatedRate = await prisma.exchangeRate.upsert({
            where: { currency },
            update: {
                rate,
                symbol,
                name,
                updatedAt: new Date()
            },
            create: {
                currency,
                rate,
                symbol,
                name,
                isActive: true
            }
        });

        res.json({
            success: true,
            message: 'Курс валюты обновлен',
            data: updatedRate
        });
    } catch (error) {
        console.error('Error updating exchange rate:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при обновлении курса валюты'
        });
    }
};

// Инициализировать базовые курсы валют
export const initializeExchangeRates = async (req: Request, res: Response) => {
    try {
        const defaultRates = [
            {
                currency: 'TJS',
                rate: 1,
                symbol: 'tjs',
                name: 'Сомони',
                isActive: true
            },
            {
                currency: 'USD',
                rate: 11.0,
                symbol: '$',
                name: 'Доллар США',
                isActive: true
            },
            {
                currency: 'EUR',
                rate: 12.0,
                symbol: '€',
                name: 'Евро',
                isActive: true
            },
            {
                currency: 'RUB',
                rate: 0.12,
                symbol: '₽',
                name: 'Российский рубль',
                isActive: true
            },
            {
                currency: 'CNY',
                rate: 1.5,
                symbol: '¥',
                name: 'Китайский юань',
                isActive: true
            }
        ];

        // Проверим, есть ли уже курсы в базе
        const existingRates = await prisma.exchangeRate.count();
        if (existingRates > 0) {
            res.json({
                success: true,
                message: 'Курсы валют уже инициализированы'
            });
            return;
        }

        // Создаем курсы валют
        const createdRates = await prisma.exchangeRate.createMany({
            data: defaultRates
        });

        res.json({
            success: true,
            message: `Инициализировано ${createdRates.count} курсов валют`,
            data: defaultRates
        });
    } catch (error) {
        console.error('Error initializing exchange rates:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при инициализации курсов валют'
        });
    }
};

// Удалить курс валюты
export const deleteExchangeRate = async (req: Request, res: Response) => {
    try {
        const { currency } = req.params;

        // Проверяем, что это не базовая валюта TJS
        if (currency === 'TJS') {
            res.status(400).json({
                success: false,
                message: 'Нельзя удалить базовую валюту TJS'
            });
            return;
        }

        const deletedRate = await prisma.exchangeRate.delete({
            where: { currency }
        });

        res.json({
            success: true,
            message: 'Курс валюты удален',
            data: deletedRate
        });
    } catch (error: any) {
        if (error.code === 'P2025') {
            res.status(404).json({
                success: false,
                message: 'Курс валюты не найден'
            });
        } else {
            console.error('Error deleting exchange rate:', error);
            res.status(500).json({
                success: false,
                message: 'Ошибка при удалении курса валюты'
            });
        }
    }
};

// Создать новый курс валюты
export const createExchangeRate = async (req: Request, res: Response) => {
    try {
        const { currency, rate, symbol, name } = req.body;

        if (!currency || !rate || !symbol || !name) {
            res.status(400).json({
                success: false,
                message: 'Все поля обязательны: currency, rate, symbol, name'
            });
            return;
        }

        // Проверяем, что валюта еще не существует
        const existingRate = await prisma.exchangeRate.findUnique({
            where: { currency }
        });

        if (existingRate) {
            res.status(409).json({
                success: false,
                message: 'Валюта уже существует'
            });
            return;
        }

        const newRate = await prisma.exchangeRate.create({
            data: {
                currency: currency.toUpperCase(),
                rate: parseFloat(rate),
                symbol,
                name,
                isActive: true
            }
        });

        res.json({
            success: true,
            message: 'Новая валюта добавлена',
            data: newRate
        });
    } catch (error) {
        console.error('Error creating exchange rate:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при создании курса валюты'
        });
    }
};

// Конвертировать цену из TJS в указанную валюту
export const convertPrice = async (req: Request, res: Response) => {
    try {
        const { amount, targetCurrency } = req.query;

        if (!amount || !targetCurrency) {
            res.status(400).json({
                success: false,
                message: 'Необходимо указать amount и targetCurrency'
            });
            return;
        }

        const rate = await prisma.exchangeRate.findUnique({
            where: { 
                currency: targetCurrency as string,
                isActive: true
            }
        });

        if (!rate) {
            res.status(404).json({
                success: false,
                message: 'Валюта не найдена'
            });
            return;
        }

        const tjsAmount = parseFloat(amount as string);
        // Новая логика: курс показывает сколько TJS за 1 единицу валюты
        // Для конвертации из TJS в другую валюту: tjsAmount / rate
        const convertedAmount = tjsAmount / rate.rate;

        res.json({
            success: true,
            data: {
                originalAmount: tjsAmount,
                originalCurrency: 'TJS',
                convertedAmount: Math.round(convertedAmount * 100) / 100,
                targetCurrency: rate.currency,
                symbol: rate.symbol,
                rate: rate.rate
            }
        });
    } catch (error) {
        console.error('Error converting price:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка при конвертации цены'
        });
    }
};