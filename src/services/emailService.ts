import nodemailer from 'nodemailer';
import { Order, Customer, Tour } from '@prisma/client';
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import prisma from '../config/database';

async function getUsdRate(): Promise<number> {
  try {
    const usdRate = await prisma.exchangeRate.findFirst({ where: { currency: 'USD' } });
    return usdRate?.rate ? Number(usdRate.rate) : 10.6;
  } catch {
    return 10.6;
  }
}

function findChromiumPath(): string | null {
  const knownPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROMIUM_PATH,
  ];

  for (const p of knownPaths) {
    if (p && fs.existsSync(p)) return p;
  }

  try {
    const nixPaths = execSync('find /nix/store -maxdepth 2 -name "chromium-browser" -o -name "chromium" 2>/dev/null | head -1', { timeout: 5000 }).toString().trim();
    if (nixPaths && fs.existsSync(nixPaths)) return nixPaths;
  } catch {}

  try {
    const whichResult = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null', { timeout: 3000 }).toString().trim();
    if (whichResult && fs.existsSync(whichResult)) return whichResult;
  } catch {}

  return null;
}

function createSmtpTransporter(usePort587 = false) {
  const host = process.env.SMTP_HOST || 'mail.timeweb.com';
  const port = usePort587 ? 587 : parseInt(process.env.SMTP_PORT || '465');
  const isSecure = port === 465;
  
  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER || 'booking@bunyodtour.tj',
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000
  } as any);
}

async function sendViaResend(mailOptions: any): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
    const toList = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];

    let htmlForResend = mailOptions.html;

    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      mailOptions.attachments.forEach((att: any) => {
        if (att.cid) {
          let b64 = att._base64Content || '';
          if (!b64 && att.content instanceof Buffer) b64 = att.content.toString('base64');
          else if (!b64 && typeof att.content === 'string') b64 = Buffer.from(att.content).toString('base64');
          if (b64) {
            const mimeType = att.contentType || att.type || 'image/png';
            const dataUri = `data:${mimeType};base64,${b64}`;
            htmlForResend = htmlForResend.replace(
              new RegExp(`cid:${att.cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
              dataUri
            );
          }
        }
      });
    }

    const payload: any = {
      from: `Bunyod-Tour <${fromEmail}>`,
      to: toList,
      subject: mailOptions.subject,
      html: htmlForResend,
    };

    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      const attachments = mailOptions.attachments
        .filter((att: any) => !att.cid && att.contentDisposition !== 'inline')
        .map((att: any) => {
          let content = '';
          if (att.content instanceof Buffer) content = att.content.toString('base64');
          else if (typeof att.content === 'string') content = Buffer.from(att.content).toString('base64');
          if (att._base64Content) content = att._base64Content;
          if (!content) return null;
          return { filename: att.filename, content };
        })
        .filter(Boolean);
      if (attachments.length > 0) payload.attachments = attachments;
    }

    const body = JSON.stringify(payload);

    await new Promise<void>((resolve, reject) => {
      const req = https.request({
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ Email sent via Resend (status: ${res.statusCode})`);
            resolve();
          } else {
            console.error(`❌ Resend API error (HTTP ${res.statusCode}): ${data}`);
            reject(new Error(`Resend HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Resend: request timeout')); });
      req.write(body);
      req.end();
    });

    return true;
  } catch (err: any) {
    console.error(`❌ Resend error:`, err.message);
    return false;
  }
}

async function sendMailWithRetry(mailOptions: any, maxRetries = 1): Promise<void> {
  // 1. Try Resend (primary — works via HTTPS, not blocked by VPS firewall)
  const resendSent = await sendViaResend(mailOptions);
  if (resendSent) return;

  if (process.env.RESEND_API_KEY) {
    console.log(`⚠️ Resend failed, falling back to SMTP...`);
  }

  // 2. Fall back to SMTP
  let lastError: any;
  const host = process.env.SMTP_HOST || 'mail.timeweb.com';
  const portSequence = [465, 587];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const portUsed = portSequence[attempt] ?? 587;
    const usePort587 = portUsed === 587;
    try {
      console.log(`📧 SMTP attempt ${attempt + 1}/${maxRetries + 1} on port ${portUsed}...`);
      const transporter = createSmtpTransporter(usePort587);
      await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully via SMTP port ${portUsed} (attempt ${attempt + 1})`);
      return;
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ SMTP attempt ${attempt + 1}/${maxRetries + 1} failed (port ${portUsed}):`, error.code || error.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  console.error(`❌ All email sending methods failed. Resend: ${process.env.RESEND_API_KEY ? 'failed' : 'not configured'}, SMTP: all ${maxRetries + 1} attempts failed for ${host}`);
  throw lastError;
}

type SupportedLanguage = 'ru' | 'en';

const emailTranslations = {
  ru: {
    companyName: 'BUNYOD-TOUR',
    companySubtitle: 'Ваш надежный спутник в мире путешествий по Центральной Азии',
    thankYou: 'Спасибо за ваш заказ!',
    bookingConfirmed: 'Ваше бронирование успешно подтверждено',
    dear: 'Уважаемый(ая)',
    confirmationMessage: 'Мы рады подтвердить ваше бронирование тура. Ниже вы найдете детали вашего заказа:',
    orderDetails: 'Детали заказа',
    orderNumber: 'Номер заказа',
    tour: 'Тур',
    tourDate: 'Дата тура',
    tourists: 'Количество туристов',
    totalAmount: 'Общая сумма',
    touristList: 'Список туристов',
    hotel: 'Отель',
    guide: 'Гид',
    contactInfo: 'Контакты для связи',
    allRightsReserved: 'Все права защищены',
    bookingCancelled: 'Бронирование отменено',
    bookingCancelledMessage: 'Ваше бронирование было отменено.',
    questionsContact: 'Если у вас есть вопросы, свяжитесь с нами:',
    email: 'Email',
    phones: 'Телефоны',
    website: 'Сайт',
    regards: 'С уважением',
    team: 'Команда Bunyod-Tour',
    paymentConfirmed: 'Оплата подтверждена',
    paymentConfirmationTitle: 'Подтверждение оплаты',
    administrationConfirms: 'Администрация ООО «Бунёд-Тур» подтверждает вашу заявку (договор)',
    from: 'от',
    tourProgram: 'на тур в рамках программы',
    onDate: 'на дату',
    seeTicketDetails: 'Подробно со всеми деталями вашего заказа вы можете ознакомиться в билете тура.',
    ticketAttached: 'Ваучер прикреплён к письму в формате PDF',
    ticketInline: 'Ваш ваучер представлен ниже',
    contactInformation: 'Контактная информация',
    administration: 'Администрация ООО «Бунёд-Тур»',
    importantInfo: 'Важная информация:',
    showTicketToGuide: 'Пожалуйста, сохраните этот билет и предъявите его гиду в день тура',
    arriveEarly: 'Прибудьте на место встречи за 15 минут до начала тура',
    contactUs: 'При возникновении вопросов свяжитесь с нами по телефону или email',
    ticketHeader: '🎫 ВАУЧЕР',
    paid: '✅ ОПЛАЧЕНО',
    reference: 'Референс',
    duration: 'Продолжительность',
    tourType: 'Тип тура',
    touristsSection: '👥 Туристы',
    fullName: 'ФИО',
    passport: 'Паспорт',
    includedServices: '📦 Включённые услуги',
    standardPackage: 'Стандартный пакет услуг',
    totalToPay: 'ИТОГО К ОПЛАТЕ',
    paidOn: 'Оплачено:',
    showTicketNote: 'Важно: Предъявите этот билет гиду в день тура',
    day: 'день',
    days2to4: 'дня',
    days5plus: 'дней',
    hour: 'час',
    hours2to4: 'часа',
    hours5plus: 'часов',
    notSelected: 'Не выбран',
    notSpecified: 'Не указан',
    guideAssigned: 'Назначается при начале тура',
    guideHireApproved: 'Заявка на найм тургида одобрена!',
    hello: 'Здравствуйте',
    guideHireApprovedMessage: 'Рады сообщить, что ваша заявка на найм тургида была одобрена нашим администратором.',
    requestDetails: 'Детали заявки:',
    amount: 'Сумма',
    proceedToPayment: 'Перейти к оплате',
    guideHirePaymentConfirmed: 'Оплата найма тургида подтверждена',
    guideHireDetails: 'Детали найма',
    selectedDates: 'Даты найма',
    numberOfDays: 'Количество дней',
    pricePerDay: 'Цена за день',
    transferPaymentConfirmed: 'Оплата трансфера подтверждена',
    transferDetails: 'Детали трансфера',
    pickupLocation: 'Место подачи',
    dropoffLocation: 'Место прибытия',
    pickupDate: 'Дата',
    pickupTime: 'Время',
    passengers: 'Пассажиров',
    vehicleType: 'Тип транспорта',
    driver: 'Водитель',
    customTourPaymentConfirmed: 'Оплата индивидуального тура подтверждена',
    customTourDetails: 'Детали индивидуального тура',
    startDate: 'Дата начала',
    durationDays: 'Продолжительность',
    countries: 'Страны',
    components: 'Компоненты',
    specialRequests: 'Особые пожелания'
  },
  en: {
    companyName: 'BUNYOD-TOUR',
    companySubtitle: 'Your reliable partner for travel in Central Asia',
    thankYou: 'Thank you for your order!',
    bookingConfirmed: 'Your booking has been successfully confirmed',
    dear: 'Dear',
    confirmationMessage: 'We are pleased to confirm your tour booking. Below you will find the details of your order:',
    orderDetails: 'Order Details',
    orderNumber: 'Order Number',
    tour: 'Tour',
    tourDate: 'Tour Date',
    tourists: 'Number of Tourists',
    totalAmount: 'Total Amount',
    touristList: 'Tourist List',
    hotel: 'Hotel',
    guide: 'Guide',
    contactInfo: 'Contact Information',
    allRightsReserved: 'All rights reserved',
    bookingCancelled: 'Booking Cancelled',
    bookingCancelledMessage: 'Your booking has been cancelled.',
    questionsContact: 'If you have any questions, please contact us:',
    email: 'Email',
    phones: 'Phones',
    website: 'Website',
    regards: 'Best regards',
    team: 'Bunyod-Tour Team',
    paymentConfirmed: 'Payment Confirmed',
    paymentConfirmationTitle: 'Payment Confirmation',
    administrationConfirms: 'Bunyod-Tour LLC confirms your order (contract)',
    from: 'from',
    tourProgram: 'for the tour program',
    onDate: 'scheduled for',
    seeTicketDetails: 'You can find all the details of your order in the tour ticket.',
    ticketAttached: 'Tour ticket is attached to this email in PDF format',
    ticketInline: 'Your tour ticket is shown below',
    contactInformation: 'Contact Information',
    administration: 'Bunyod-Tour LLC Administration',
    importantInfo: 'Important information:',
    showTicketToGuide: 'Please save this ticket and show it to your guide on the day of the tour',
    arriveEarly: 'Arrive at the meeting point 15 minutes before the tour starts',
    contactUs: 'If you have any questions, contact us by phone or email',
    ticketHeader: '🎫 TOUR TICKET',
    paid: '✅ PAID',
    reference: 'Reference',
    duration: 'Duration',
    tourType: 'Tour Type',
    touristsSection: '👥 Tourists',
    fullName: 'Full Name',
    passport: 'Passport',
    includedServices: '📦 Included Services',
    standardPackage: 'Standard service package',
    totalToPay: 'TOTAL TO PAY',
    paidOn: 'Paid on:',
    showTicketNote: 'Important: Show this ticket to your guide on the day of the tour',
    day: 'day',
    days2to4: 'days',
    days5plus: 'days',
    hour: 'hour',
    hours2to4: 'hours',
    hours5plus: 'hours',
    notSelected: 'Not selected',
    notSpecified: 'Not specified',
    guideAssigned: 'To be assigned at the start of the tour',
    guideHireApproved: 'Guide hire request approved!',
    hello: 'Hello',
    guideHireApprovedMessage: 'We are pleased to inform you that your guide hire request has been approved by our administrator.',
    requestDetails: 'Request Details:',
    amount: 'Amount',
    proceedToPayment: 'Proceed to Payment',
    guideHirePaymentConfirmed: 'Guide hire payment confirmed',
    guideHireDetails: 'Hire Details',
    selectedDates: 'Selected Dates',
    numberOfDays: 'Number of Days',
    pricePerDay: 'Price per Day',
    transferPaymentConfirmed: 'Transfer payment confirmed',
    transferDetails: 'Transfer Details',
    pickupLocation: 'Pickup Location',
    dropoffLocation: 'Dropoff Location',
    pickupDate: 'Date',
    pickupTime: 'Time',
    passengers: 'Passengers',
    vehicleType: 'Vehicle Type',
    driver: 'Driver',
    customTourPaymentConfirmed: 'Custom tour payment confirmed',
    customTourDetails: 'Custom Tour Details',
    startDate: 'Start Date',
    durationDays: 'Duration',
    countries: 'Countries',
    components: 'Components',
    specialRequests: 'Special Requests'
  }
};

function getTranslation(lang: string): typeof emailTranslations.ru {
  return lang === 'en' ? emailTranslations.en : emailTranslations.ru;
}

function formatDate(date: Date | string, lang: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (lang === 'en') {
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDays(count: number, lang: string): string {
  const t = getTranslation(lang);
  if (lang === 'en') {
    return count === 1 ? t.day : t.days5plus;
  }
  if (count === 1) return t.day;
  if (count >= 2 && count <= 4) return t.days2to4;
  return t.days5plus;
}

function formatHours(count: number, lang: string): string {
  const t = getTranslation(lang);
  if (lang === 'en') {
    return count === 1 ? t.hour : t.hours5plus;
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return t.hour;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t.hours2to4;
  return t.hours5plus;
}

function formatDuration(count: number, durationType: string | null | undefined, lang: string): string {
  return durationType === 'hours' ? formatHours(count, lang) : formatDays(count, lang);
}

function getLocalizedValue(obj: any, lang: string): string {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return lang === 'en' ? (obj.en || obj.ru || '') : (obj.ru || obj.en || '');
}

/**
 * Подтягивает английские названия (nameEn) из таблицы PriceCalculatorComponent
 * для каждого сервиса в массиве. Сервисы на туре сохраняются с одним только русским
 * `name`, тогда как английский перевод живёт отдельно в справочнике компонентов.
 * Эта функция возвращает обогащённый массив, в котором у каждого сервиса появляется
 * поле `nameEn`, чтобы в email-ваучере английская версия отображалась корректно.
 */
async function enrichServicesWithEnglish(rawServices: any): Promise<any[]> {
  try {
    if (!rawServices) return [];
    const services = typeof rawServices === 'string' ? JSON.parse(rawServices) : rawServices;
    if (!Array.isArray(services) || services.length === 0) return [];

    // Не фильтруем по isActive: старые заказы могут ссылаться на компоненты,
    // которые позже были деактивированы. Для письма-ваучера нам всё равно нужен
    // их английский перевод.
    const components = await prisma.priceCalculatorComponent.findMany({
      select: { id: true, key: true, name: true, nameEn: true }
    });

    const norm = (v: any) => (v == null ? '' : String(v).trim());

    return services.map((service: any) => {
      if (service && typeof service === 'object' && service.nameEn) return service;
      const sKey = norm(service.key);
      const sId = norm(service.id);
      const sName = typeof service.name === 'string' ? service.name.trim() : '';
      const match = components.find(c =>
        (sKey && norm(c.key) === sKey) ||
        (sId && norm(c.id) === sId) ||
        (sName && c.name === sName)
      );
      if (match?.nameEn) {
        return { ...service, nameEn: match.nameEn };
      }
      return service;
    });
  } catch (error) {
    console.warn('⚠️  Failed to enrich services with English names:', error);
    try {
      return typeof rawServices === 'string' ? JSON.parse(rawServices) : (rawServices || []);
    } catch {
      return [];
    }
  }
}

function generateInlineTicketHTML(order: any, customer: Customer, language?: string, usdRate: number = 10.6): string {
  const lang = language || order.language || 'ru';
  const t = getTranslation(lang);
  const dateLocale = lang === 'en' ? 'en-US' : 'ru-RU';
  
  const tourists = (() => { try { return JSON.parse(order.tourists || '[]'); } catch { return []; } })();
  const tourTitle = getLocalizedValue(order.tour?.title, lang) || (lang === 'en' ? 'Tour' : 'Тур');
  const hotelName = getLocalizedValue(order.hotel?.name, lang) || t.notSelected;
  const tourDurationType = order.tour?.durationType || 'days';
  const tourDuration = tourDurationType === 'hours'
    ? (parseInt(order.tour?.duration) || order.tour?.durationDays || 1)
    : (order.tour?.durationDays || parseInt(order.tour?.duration) || 1);
  const rawTourType = order.tour?.tourType || order.tour?.format || 'individual';
  const tourTypeMapRu: Record<string, string> = {
    'individual': 'Персональный', 'Individual': 'Персональный',
    'group_private': 'Групповой', 'group_general': 'Групповой общий', 'group_shared': 'Групповой общий'
  };
  const tourTypeMapEn: Record<string, string> = {
    'individual': 'Individual', 'Individual': 'Individual',
    'group_private': 'Private Group', 'group_general': 'Group Shared', 'group_shared': 'Group Shared'
  };
  const tourType = lang === 'en' ? (tourTypeMapEn[rawTourType] || rawTourType) : (tourTypeMapRu[rawTourType] || rawTourType);
  const bookingRef = order.orderNumber || `BT-${order.id}${new Date().getFullYear()}`;
  const submissionTime = new Date(order.createdAt || Date.now());
  const tourDate = order.tourDate ? new Date(order.tourDate).toLocaleDateString(dateLocale) : t.notSpecified;
  const durationText = `${tourDuration} ${formatDuration(tourDuration, tourDurationType, lang)}`;
  const totalAmount = order.totalAmount || 0;

  // Данные аренды автомобиля (для трансфер-заказов TR-)
  const transferRequest = order.transferRequest;
  const isTransfer = !!(transferRequest || order.orderNumber?.startsWith('TR-'));
  const rentalDays: number = transferRequest?.rentalDays || 1;
  const dropoffDate: string | null = transferRequest?.dropoffDate || null;
  const dropoffDateFormatted = dropoffDate ? new Date(dropoffDate).toLocaleDateString(dateLocale) : null;
  const fullTourPrice = order.booking?.totalPrice || totalAmount;
  const paymentOption = order.paymentOption || order.selectedPaymentOption || 'full';
  
  const toFixed2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
  const toUsd = (tjs: number) => (tjs / usdRate).toFixed(2);
  
  const numAdults = order.numAdults || tourists.length || 1;
  const numChildren = order.numChildren || 0;
  let participantsText: string;
  if (numChildren > 0) {
    participantsText = `${numAdults} ${lang === 'en' ? 'adults' : 'взр.'} + ${numChildren} ${lang === 'en' ? 'children' : 'дет.'}`;
  } else {
    participantsText = `${tourists.length || numAdults} ${(tourists.length || numAdults) === 1 ? (lang === 'en' ? 'participant' : 'участник') : (lang === 'en' ? 'participants' : 'участников')}`;
  }
  
  let services: any[] = [];
  try {
    if (order.tour?.services) {
      services = typeof order.tour.services === 'string' ? 
        JSON.parse(order.tour.services) : order.tour.services;
    }
  } catch (e) {}

  // 🚫 Скрываем авто-добавленные accommodation_std (без id) — нужны только серверу
  // для логики замены проживания, в ваучер не должны попадать.
  services = (Array.isArray(services) ? services : []).filter((s: any) => {
    if (!s || typeof s !== 'object') return true;
    return !(s.key === 'accommodation_std' && (s.id === undefined || s.id === null));
  });

  const touristListHtml = tourists.length > 0 
    ? tourists.map((tourist: any, i: number) => `
        <div style="padding: 4px 0; font-size: 13px; color: #4b5563;">
          <span style="display: inline-block; width: 20px; height: 20px; background: #6b7280; color: white; border-radius: 50%; text-align: center; line-height: 20px; font-size: 10px; margin-right: 6px;">${i + 1}</span>
          ${tourist.fullName || tourist.name || (lang === 'en' ? 'Tourist' : 'Турист') + ' ' + (i + 1)}${tourist.dateOfBirth || tourist.birthDate ? ` (${new Date(tourist.dateOfBirth || tourist.birthDate).toLocaleDateString(dateLocale)})` : ''}
        </div>
      `).join('')
    : '';

  const servicesHTML = services.length > 0 
    ? services.map((s: any) => {
        let serviceName: string;
        if (typeof s === 'string') {
          serviceName = s;
        } else if (lang === 'en' && s.nameEn) {
          serviceName = s.nameEn;
        } else {
          serviceName = getLocalizedValue(s.name, lang) || s.name || (lang === 'en' ? 'Service' : 'Услуга');
        }
        return `<div style="padding: 3px 0; font-size: 13px; color: #374151;"><span style="color: #10b981; margin-right: 4px;">✓</span> ${serviceName}</div>`;
      }).join('')
    : '';
  
  const hasHotel = order.hotel && order.hotel.name;
  const hotelServiceHtml = hasHotel ? `<div style="padding: 3px 0; font-size: 13px; color: #374151;"><span style="color: #10b981; margin-right: 4px;">✓</span> ${lang === 'en' ? 'Hotel accommodation' : 'Проживание в отеле'}</div>` : '';

  const specialRequests = (() => {
    const raw = order.specialRequests || order.wishes || '';
    return raw.replace(/tourStartTime:[^\s|]+\s*\|?\s*/g, '').trim();
  })();

  const pickupInfo = (() => {
    const pi = order.tour?.pickupInfo;
    const piEn = order.tour?.pickupInfoEn;
    if (lang === 'en' && piEn) return piEn;
    if (!pi) return lang === 'en' ? 'Dushanbe city center' : 'Центр города Душанбе';
    return typeof pi === 'object' ? (pi[lang] || pi.ru || pi.en || '') : pi;
  })();
  
  const tourId = order.tour?.id || order.tourId || 0;

  let amountHtml = '';
  if (paymentOption === 'deposit') {
    const depositAmt = toFixed2(fullTourPrice * 0.1);
    const remainAmt = toFixed2(fullTourPrice * 0.9);
    amountHtml = `
      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 4px 0;">${lang === 'en' ? 'Tour Total:' : 'Итого за тур:'}</p>
      <p style="font-size: 22px; font-weight: bold; color: #374151; margin: 0;">${toFixed2(fullTourPrice)} TJS</p>
      <p style="font-size: 12px; color: #6b7280; margin: 2px 0 0 0;">≈ ${toUsd(fullTourPrice)} USD</p>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #d1d5db;">
        <p style="font-size: 13px; color: #374151; margin: 0 0 4px 0;">${lang === 'en' ? 'Deposit (10%) — pay now:' : 'Депозит (10%) — к оплате сейчас:'}</p>
        <p style="font-size: 20px; font-weight: bold; color: #059669; margin: 0;">${depositAmt} TJS</p>
        <p style="font-size: 11px; color: #6b7280; margin: 2px 0 0 0;">≈ ${toUsd(fullTourPrice * 0.1)} USD</p>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 13px; color: #374151; margin: 0;">${lang === 'en' ? 'Remainder' : 'Остаток'} (90%): <strong>${remainAmt} TJS</strong></p>
        <p style="font-size: 11px; color: #6b7280; margin: 2px 0 0 0;">${lang === 'en' ? 'Pay before tour start' : 'Оплатить до начала тура'}</p>
      </div>
    `;
  } else if (paymentOption === 'deposit_25') {
    const depositAmt = toFixed2(fullTourPrice * 0.25);
    const remainAmt = toFixed2(fullTourPrice * 0.75);
    amountHtml = `
      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 4px 0;">${lang === 'en' ? 'Tour Total:' : 'Итого за тур:'}</p>
      <p style="font-size: 22px; font-weight: bold; color: #374151; margin: 0;">${toFixed2(fullTourPrice)} TJS</p>
      <p style="font-size: 12px; color: #6b7280; margin: 2px 0 0 0;">≈ ${toUsd(fullTourPrice)} USD</p>
      <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #d1d5db;">
        <p style="font-size: 13px; color: #374151; margin: 0 0 4px 0;">${lang === 'en' ? 'Deposit (25%) — pay now:' : 'Депозит (25%) — к оплате сейчас:'}</p>
        <p style="font-size: 20px; font-weight: bold; color: #059669; margin: 0;">${depositAmt} TJS</p>
        <p style="font-size: 11px; color: #6b7280; margin: 2px 0 0 0;">≈ ${toUsd(fullTourPrice * 0.25)} USD</p>
      </div>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 13px; color: #374151; margin: 0;">${lang === 'en' ? 'Remainder' : 'Остаток'} (75%): <strong>${remainAmt} TJS</strong></p>
        <p style="font-size: 11px; color: #6b7280; margin: 2px 0 0 0;">${lang === 'en' ? 'Pay before tour start' : 'Оплатить до начала тура'}</p>
      </div>
    `;
  } else {
    amountHtml = `
      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 8px 0;">${lang === 'en' ? 'Total amount:' : 'Сумма к оплате:'}</p>
      <p style="font-size: 22px; font-weight: bold; color: #374151; margin: 0;">${toFixed2(totalAmount)} TJS</p>
      <p style="font-size: 12px; color: #6b7280; margin: 2px 0 0 0;">≈ ${toUsd(totalAmount)} USD</p>
    `;
  }

  return `
    <div style="max-width: 680px; margin: 30px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border: 2px solid #3E3E3E;">
      <div style="background: #3E3E3E; color: white; padding: 25px; text-align: center;">
        <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; margin-bottom: 12px; text-transform: uppercase; opacity: 0.95;">VOUCHER</div>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">${t.companySubtitle}</p>
      </div>
      
      <div style="padding: 28px;">
        <!-- Date + Confirmed Badge -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; margin-bottom: 20px;">
          <span style="font-size: 14px; color: #6b7280;">📅 ${tourDate}</span>
          <span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${lang === 'en' ? 'CONFIRMED' : 'ПОДТВЕРЖДЕН'}</span>
        </div>
        
        <!-- Tour / Transfer Title -->
        <h2 style="font-size: 22px; font-weight: bold; color: #1f2937; margin: 0 0 4px 0;">${tourTitle}</h2>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 ${isTransfer ? '12px' : '20px'} 0;">${isTransfer ? (lang === 'en' ? 'Car Rental / Transfer' : 'Аренда авто / Трансфер') : `${tourType} - ${durationText}`}</p>

        ${isTransfer && rentalDays > 0 ? `
        <!-- Transfer Rental Info -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f0f9ff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 10px 14px; border: 1px solid #bae6fd;">
              <span style="font-size: 12px; color: #0369a1; font-weight: 600; text-transform: uppercase;">${lang === 'en' ? 'Rental start' : 'Начало аренды'}</span><br>
              <span style="font-size: 14px; color: #1e3a5f; font-weight: 700;">📅 ${tourDate}${transferRequest?.pickupTime ? ' ' + transferRequest.pickupTime : ''}</span>
            </td>
            <td style="padding: 10px 14px; border: 1px solid #bae6fd;">
              <span style="font-size: 12px; color: #0369a1; font-weight: 600; text-transform: uppercase;">${lang === 'en' ? 'Rental end' : 'Конец аренды'}</span><br>
              <span style="font-size: 14px; color: #1e3a5f; font-weight: 700;">📅 ${dropoffDateFormatted || (lang === 'en' ? 'Not specified' : 'Не указано')}</span>
            </td>
            <td style="padding: 10px 14px; border: 1px solid #bae6fd; text-align: center;">
              <span style="font-size: 12px; color: #0369a1; font-weight: 600; text-transform: uppercase;">${lang === 'en' ? 'Rental days' : 'Дней аренды'}</span><br>
              <span style="font-size: 20px; font-weight: 800; color: #0369a1;">🗓 ${rentalDays}</span>
            </td>
          </tr>
        </table>
        ` : ''}
        
        <!-- Two Column Layout (table for email compatibility) -->
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <!-- LEFT COLUMN -->
            <td style="width: 48%; vertical-align: top; padding-right: 16px;">
              ${customer.fullName ? `
                <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Contact person:' : 'Контактное лицо:'}</p>
                <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${customer.fullName}</p>
              ` : ''}
              
              <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Tour participants:' : 'Участники тура:'}</p>
              <p style="font-size: 14px; color: #374151; margin: 0;">${participantsText}</p>
              ${touristListHtml ? `<div style="margin-top: 6px;">${touristListHtml}</div>` : ''}
              <div style="margin-bottom: 16px;"></div>
              
              <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Tour language:' : 'Язык тура:'}</p>
              <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${lang === 'en' ? 'English' : 'Русский'}</p>
              
              ${(servicesHTML || hotelServiceHtml) ? `
                <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Included:' : 'Включено:'}</p>
                <div style="margin-bottom: 16px;">
                  ${servicesHTML}
                  ${hotelServiceHtml}
                </div>
              ` : ''}
              
              <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Special requests:' : 'Особые требования:'}</p>
              <p style="font-size: 13px; color: #374151; margin: 0 0 16px 0;">${specialRequests || '-'}</p>
            </td>
            
            <!-- RIGHT COLUMN -->
            <td style="width: 48%; vertical-align: top; padding-left: 16px;">
              <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 2px 0;">${bookingRef}</p>
              <p style="font-size: 12px; color: #6b7280; margin: 0 0 16px 0;">${lang === 'en' ? 'Confirmed' : 'Подтверждено'} ${submissionTime.toLocaleDateString(dateLocale)} ${submissionTime.toLocaleTimeString(dateLocale, {hour: '2-digit', minute:'2-digit'})} GMT+5</p>
              
              ${customer.phone ? `
                <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Client phone:' : 'Номер телефона клиента:'}</p>
                <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${customer.phone}</p>
              ` : ''}
              
              <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Meeting point:' : 'Место сбора:'}</p>
              <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${pickupInfo}</p>
              
              <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Booking source:' : 'Источник бронирования:'}</p>
              <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">Bunyod-Tour</p>
              
              <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Product code:' : 'Код продукта:'}</p>
              <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">TOUR${tourId}TJ${tourDuration}D</p>
              
              <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${lang === 'en' ? 'Tour guide:' : 'Гид тура:'}</p>
              <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${lang === 'en' ? 'Assigned at tour start' : 'Назначается при начале тура'}</p>
              
              <!-- Amount Box -->
              <div style="background: #f9fafb; padding: 14px; border-radius: 8px;">
                ${amountHtml}
              </div>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="background: #f3f4f6; padding: 20px; text-align: center; border-top: 2px dashed #d1d5db;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #4b5563;">
          <strong>${t.showTicketNote}</strong>
        </p>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">
          📞 +992 915 123 344<br>
          📧 booking@bunyodtour.tj | 🌐 bunyodtour.tj
        </p>
      </div>
    </div>
  `;
}

/**
 * 🆕 Универсальный рендер мульти-отелей для email/PDF.
 * Использует order.selectedHotels (JSON-массив, заполняется на шаге 1 бронирования),
 * при отсутствии — fallback на одиночный order.hotel (старые заказы).
 */
function buildSelectedHotelsHtml(order: any, lang: 'ru' | 'en' = 'ru', mode: 'email' | 'pdf' = 'pdf'): string {
  const L = (v: any): string => {
    if (!v) return '';
    if (typeof v === 'string') {
      try { const p = JSON.parse(v); return L(p); } catch { return v; }
    }
    if (typeof v === 'object') return v[lang] || v.ru || v.en || Object.values(v)[0] || '';
    return String(v);
  };
  const tr = {
    hotel: lang === 'en' ? 'Hotel' : 'Отель',
    nights: lang === 'en' ? 'nights' : 'ночей',
    night: lang === 'en' ? 'night' : 'ночь',
    rooms: lang === 'en' ? 'Rooms' : 'Номера',
    meal: lang === 'en' ? 'Meal' : 'Питание',
  };
  const roomTypeLabel = (rt: string): string => {
    const map: Record<string, { ru: string; en: string }> = {
      single: { ru: 'Одноместный', en: 'Single' },
      double: { ru: 'Двухместный', en: 'Double' },
      twin: { ru: 'Твин', en: 'Twin' },
      triple: { ru: 'Трёхместный', en: 'Triple' },
      quad: { ru: 'Четырёхместный', en: 'Quad' },
      suite: { ru: 'Люкс', en: 'Suite' },
      family: { ru: 'Семейный', en: 'Family' },
    };
    const key = String(rt).toLowerCase();
    return map[key] ? map[key][lang] : rt;
  };
  const mealLabel = (m: any): string => {
    if (!m) return '';
    const v = typeof m === 'string' ? m : (m.meal || m.type || '');
    const map: Record<string, { ru: string; en: string }> = {
      bb: { ru: 'Завтрак (BB)', en: 'Breakfast (BB)' },
      hb: { ru: 'Полупансион (HB)', en: 'Half Board (HB)' },
      fb: { ru: 'Полный пансион (FB)', en: 'Full Board (FB)' },
      ai: { ru: 'Всё включено (AI)', en: 'All Inclusive (AI)' },
      ro: { ru: 'Без питания (RO)', en: 'Room Only (RO)' },
      none: { ru: 'Без питания', en: 'No meal' },
    };
    const key = String(v).toLowerCase();
    return map[key] ? map[key][lang] : String(v);
  };

  let hotels: any[] = [];
  const raw = order.selectedHotels;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) hotels = parsed;
    } catch {}
  }
  if (hotels.length === 0 && order.hotel) {
    let roomSel: any = {};
    try { roomSel = order.booking?.roomSelection ? JSON.parse(order.booking.roomSelection) : {}; } catch {}
    let mealSel: any = order.booking?.mealSelection || null;
    try { if (typeof mealSel === 'string') mealSel = JSON.parse(mealSel); } catch {}
    const rooms: Record<string, any> = {};
    const hRooms = roomSel && roomSel[order.hotel.id];
    if (hRooms && typeof hRooms === 'object') {
      for (const [rt, val] of Object.entries(hRooms)) {
        const qty = typeof val === 'object' ? ((val as any).quantity || 0) : (parseInt(val as any) || 0);
        if (qty > 0) rooms[rt] = { quantity: qty };
      }
    }
    hotels = [{ hotelId: order.hotel.id, hotelName: order.hotel.name, rooms, meal: mealSel }];
  }
  if (hotels.length === 0) return '';

  const items = hotels.map((h: any) => {
    const hn = L(h.hotelName) || tr.hotel;
    const cn = L(h.cityName);
    const nightsTxt = h.nights ? ` · ${h.nights} ${h.nights === 1 ? tr.night : tr.nights}` : '';
    const roomsArr = Object.entries(h.rooms || {});
    const roomsTxt = roomsArr.length
      ? roomsArr.map(([rt, info]: any) => `${roomTypeLabel(rt)} × ${(info && typeof info === 'object') ? (info.quantity || 0) : info}`).join(', ')
      : '';
    const mealTxt = h.meal ? mealLabel(h.meal) : '';
    if (mode === 'pdf') {
      return `
        <div style="margin-bottom: 8px; padding: 10px 12px; background: #f9fafb; border-left: 3px solid #6b7280; border-radius: 4px;">
          <div style="font-weight: 600; color: #1f2937; font-size: 14px;">${hn}${cn ? ` <span style="color:#6b7280;font-weight:400;">— ${cn}</span>` : ''}${nightsTxt}</div>
          ${roomsTxt ? `<div style="color:#4b5563;font-size:13px;margin-top:3px;">${tr.rooms}: ${roomsTxt}</div>` : ''}
          ${mealTxt ? `<div style="color:#4b5563;font-size:13px;margin-top:2px;">${tr.meal}: ${mealTxt}</div>` : ''}
        </div>`;
    }
    return `
      <div style="margin-bottom: 8px; padding: 8px 10px; background: #f9fafb; border-left: 3px solid #6b7280; border-radius: 4px;">
        <div style="font-weight:600;color:#1f2937;font-size:13px;">🏨 ${hn}${cn ? ` <span style="color:#6b7280;font-weight:400;">— ${cn}</span>` : ''}${nightsTxt}</div>
        ${roomsTxt ? `<div style="color:#4b5563;font-size:12px;margin-top:2px;">${tr.rooms}: ${roomsTxt}</div>` : ''}
        ${mealTxt ? `<div style="color:#4b5563;font-size:12px;margin-top:2px;">${tr.meal}: ${mealTxt}</div>` : ''}
      </div>`;
  }).join('');

  if (mode === 'pdf') {
    return `
      <div class="section">
        <div class="section-title">${hotels.length > 1 ? (lang === 'en' ? 'Hotels' : 'Отели') : tr.hotel}:</div>
        ${items}
      </div>`;
  }
  return `
    <h3>${hotels.length > 1 ? (lang === 'en' ? 'Hotels' : 'Отели') : tr.hotel}</h3>
    ${items}`;
}

async function generateTicketPDF(order: any, customer: Customer, usdRateVal: number = 10.6): Promise<Buffer> {
  const tourists = JSON.parse(order.tourists || '[]');
  const tourTitle = order.tour?.title?.ru || order.tour?.title?.en || 'Tour';
  const hotelName = order.hotel?.name?.ru || order.hotel?.name?.en || 'Не выбран';
  const tourDurationType = order.tour?.durationType || 'days';
  const tourDuration = tourDurationType === 'hours'
    ? (parseInt(order.tour?.duration) || order.tour?.durationDays || 1)
    : (order.tour?.durationDays || parseInt(order.tour?.duration) || 1);
  const rawTourType = order.tour?.tourType || order.tour?.format || 'individual';
  const tourTypeMap: Record<string, string> = {
    'individual': 'Персональный',
    'Individual': 'Персональный',
    'group_private': 'Групповой',
    'group_general': 'Групповой общий',
    'group_shared': 'Групповой общий'
  };
  const tourType = tourTypeMap[rawTourType] || rawTourType;
  const bookingRef = `BT-${order.id}${new Date().getFullYear()}`;
  const submissionTime = new Date(order.createdAt || Date.now());
  
  let services = [];
  try {
    if (order.tour?.services) {
      services = typeof order.tour.services === 'string' ? 
        JSON.parse(order.tour.services) : order.tour.services;
    }
  } catch (e) {
    console.warn('Error parsing tour services:', e);
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .company-header { background: #3E3E3E; color: white; padding: 25px; text-align: center; }
        .company-logo { width: 70px; height: 70px; border-radius: 50%; margin: 0 auto 15px; }
        .company-name { font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .company-subtitle { font-size: 14px; margin-top: 8px; opacity: 0.95; }
        .voucher-content { padding: 40px; }
        .voucher-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb; margin-bottom: 25px; }
        .date { color: #6b7280; }
        .status-badge { background: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        .tour-title { font-size: 26px; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
        .tour-subtitle { color: #6b7280; font-size: 16px; margin-bottom: 30px; }
        .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
        .section { margin-bottom: 25px; }
        .section-title { font-weight: bold; color: #1f2937; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .section-value { color: #4b5563; line-height: 1.8; }
        .tourist-list { background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 10px; }
        .tourist-item { padding: 8px 0; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; }
        .tourist-item:last-child { border-bottom: none; }
        .tourist-number { width: 24px; height: 24px; background: #6b7280; color: white; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; margin-right: 10px; }
        .services-list { margin-top: 10px; }
        .service-item { padding: 5px 0; color: #4b5563; }
        .service-item::before { content: "✓"; color: #10b981; font-weight: bold; margin-right: 8px; }
        .amount-box { background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin-top: 30px; }
        .amount-label { color: #6b7280; font-size: 14px; margin-bottom: 5px; }
        .amount-value { font-size: 32px; font-weight: bold; color: #1f2937; }
        .amount-usd { color: #6b7280; font-size: 14px; margin-top: 5px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="company-header">
          <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; margin-bottom: 12px; text-transform: uppercase; opacity: 0.95;">VOUCHER</div>
          <img src="https://bunyodtour.tj/Logo-Ru_1754635713718.png" alt="Bunyod-Tour" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 15px;" onerror="this.style.display='none'">
          <div class="company-subtitle">Ваш надежный спутник в мире путешествий по Центральной Азии</div>
        </div>
        
        <div class="voucher-content">
          <div class="voucher-header">
            <div class="date">📅 ${new Date(order.tourDate).toLocaleDateString('ru-RU')}</div>
            <div class="status-badge">ПОДТВЕРЖДЕН</div>
          </div>
          
          <div class="tour-title">${tourTitle}</div>
          <div class="tour-subtitle">${tourType} - ${tourDuration} ${formatDuration(tourDuration, tourDurationType, 'ru')}</div>
          
          <div class="two-column">
            <div>
              ${customer.fullName ? `
                <div class="section">
                  <div class="section-title">Контактное лицо:</div>
                  <div class="section-value">${customer.fullName}</div>
                </div>
              ` : ''}
              
              <div class="section">
                <div class="section-title">Участники тура:</div>
                <div class="section-value">${tourists.length} ${tourists.length === 1 ? 'человек' : 'человек'}</div>
                ${tourists.length > 0 ? `
                  <div class="tourist-list">
                    ${tourists.map((tourist: any, index: number) => `
                      <div class="tourist-item">
                        <span class="tourist-number">${index + 1}</span>
                        <span>${tourist.fullName} ${tourist.birthDate ? `(${tourist.birthDate})` : ''}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
              
              <div class="section">
                <div class="section-title">Язык тура:</div>
                <div class="section-value">Russian</div>
              </div>
              
              <div class="section">
                <div class="section-title">Включено:</div>
                <div class="services-list">
                  ${(Array.isArray(services) ? services : [])
                    .filter((s: any) => !(s && typeof s === 'object' && s.key === 'accommodation_std' && (s.id === undefined || s.id === null)))
                    .map((service: any) => {
                      const serviceName = typeof service === 'string' ? service : (service.name?.ru || service.name?.en || service.name || 'Услуга');
                      return `<div class="service-item">${serviceName}</div>`;
                    }).join('')}
                  ${hotelName !== 'Не выбран' ? '<div class="service-item">Проживание в отеле</div>' : ''}
                </div>
              </div>
              
              <!-- 🆕 Selected Hotels block (multi-hotel) -->
              ${buildSelectedHotelsHtml(order, 'ru', 'pdf')}
            </div>
            
            <div>
              <div class="section">
                <div class="section-title">${bookingRef}</div>
                <div class="section-value">Подтверждено ${submissionTime.toLocaleDateString('ru-RU')} ${submissionTime.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})} GMT+5</div>
              </div>
              
              ${order.tourDate ? `
                <div class="section">
                  <div class="section-title">Дата тура:</div>
                  <div class="section-value">${new Date(order.tourDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
              ` : ''}

              ${customer.phone ? `
                <div class="section">
                  <div class="section-title">Номер телефона клиента:</div>
                  <div class="section-value">${customer.phone}</div>
                </div>
              ` : ''}
              
              <div class="section">
                <div class="section-title">Место сбора:</div>
                <div class="section-value">${typeof order.tour?.pickupInfo === 'object' ? (order.tour.pickupInfo?.ru || order.tour.pickupInfo?.en || 'Рудаки парк') : (order.tour?.pickupInfo || 'Рудаки парк')}</div>
              </div>
              
              <div class="section">
                <div class="section-title">Источник бронирования:</div>
                <div class="section-value">Bunyod-Tour</div>
              </div>
              
              <div class="section">
                <div class="section-title">Код продукта:</div>
                <div class="section-value">TOUR${order.tour?.id}TJ${tourDuration}D</div>
              </div>
              
              <div class="section">
                <div class="section-title">Гид тура:</div>
                <div class="section-value">${order.guide ? (order.guide.name?.ru || order.guide.name?.en) : 'Назначается при начале тура'}</div>
              </div>
            </div>
          </div>
          
          <!-- Старый одиночный блок отеля убран — мульти-отели рендерятся в секции "Включено" выше -->

          
          ${order.wishes ? `
            <div class="section">
              <div class="section-title">Особые требования:</div>
              <div class="section-value">${order.wishes}</div>
            </div>
          ` : ''}
          
          <div class="amount-box">
            ${(() => {
              const fullPrice = order.booking?.totalPrice || order.totalAmount;
              const payOpt = order.paymentOption || 'full';
              const fix2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
              const toUsd = (tjs: number) => (tjs / usdRateVal).toFixed(2);
              if (payOpt === 'deposit') {
                const depositAmt = fix2(fullPrice * 0.1);
                const remainAmt = fix2(fullPrice * 0.9);
                return `
                  <div class="amount-label">Итого за тур:</div>
                  <div class="amount-value">${fix2(fullPrice)} TJS</div>
                  <div class="amount-usd">≈ ${toUsd(fullPrice)} USD</div>
                  <div style="border-top: 1px solid #d1d5db; margin-top: 12px; padding-top: 12px;">
                    <div class="amount-label">Депозит (10%) — к оплате сейчас:</div>
                    <div style="font-size: 24px; font-weight: bold; color: #10b981;">${depositAmt} TJS</div>
                  </div>
                  <div style="margin-top: 8px;">
                    <div class="amount-label">Остаток (90%): ${remainAmt} TJS</div>
                    <div style="font-size: 11px; color: #9ca3af;">Оплата перед началом тура</div>
                  </div>
                `;
              }
              if (payOpt === 'deposit_25') {
                const depositAmt = fix2(fullPrice * 0.25);
                const remainAmt = fix2(fullPrice * 0.75);
                return `
                  <div class="amount-label">Итого за тур:</div>
                  <div class="amount-value">${fix2(fullPrice)} TJS</div>
                  <div class="amount-usd">≈ ${toUsd(fullPrice)} USD</div>
                  <div style="border-top: 1px solid #d1d5db; margin-top: 12px; padding-top: 12px;">
                    <div class="amount-label">Депозит (25%) — к оплате сейчас:</div>
                    <div style="font-size: 24px; font-weight: bold; color: #10b981;">${depositAmt} TJS</div>
                  </div>
                  <div style="margin-top: 8px;">
                    <div class="amount-label">Остаток (75%): ${remainAmt} TJS</div>
                    <div style="font-size: 11px; color: #9ca3af;">Оплата перед началом тура</div>
                  </div>
                `;
              }
              return `
                <div class="amount-label">Итоговая сумма:</div>
                <div class="amount-value">${fix2(order.totalAmount)} TJS</div>
                <div class="amount-usd">≈ ${toUsd(order.totalAmount)} USD</div>
              `;
            })()}
          </div>
        </div>
        
        <div class="footer">
          © ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.<br>
          734042, Таджикистан, г. Душанбе, ул. Айни 104
        </div>
      </div>
    </body>
    </html>
  `;
  
  const chromiumPath = findChromiumPath();
  if (!chromiumPath) {
    throw new Error('Chromium not found. Install chromium on the server: pacman -S chromium (Arch) or nix-env -iA nixpkgs.chromium (Nix)');
  }
  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions'
    ]
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });
    
    return pdfBuffer as Buffer;
  } finally {
    await browser.close();
  }
}

const emailTemplates = {
  bookingConfirmation: (order: any, customer: Customer, tour: any, lang: string = 'ru') => {
    const t = getTranslation(lang);
    const tourTitle = getLocalizedValue(tour.title, lang) || 'Tour';
    const hotelName = order.hotel ? getLocalizedValue(order.hotel.name, lang) : null;
    const guideName = order.guide ? getLocalizedValue(order.guide.name, lang) : null;
    
    return {
      subject: lang === 'en' 
        ? `Booking Confirmation #${order.orderNumber}` 
        : `Подтверждение бронирования №${order.orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; }
            .company-header { background: #3E3E3E; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .company-name { font-size: 28px; font-weight: bold; margin: 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
            .company-subtitle { font-size: 14px; margin: 5px 0 0 0; opacity: 0.9; }
            .voucher-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .button { display: inline-block; padding: 12px 30px; background: #3E3E3E; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="company-header">
              <img src="cid:bunyod_logo" alt="Bunyod-Tour" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">
              <h1 class="company-name">${t.companyName}</h1>
              <p class="company-subtitle">${t.companySubtitle}</p>
            </div>
            <div class="voucher-header">
              <h1>${t.thankYou}</h1>
              <p>${t.bookingConfirmed}</p>
            </div>
            
            <div class="content">
              <p>${t.dear} ${customer.fullName},</p>
              <p>${t.confirmationMessage}</p>
              
              <div class="order-details">
                <h3>${t.orderDetails}</h3>
                <div class="detail-row">
                  <span><strong>${t.orderNumber}:</strong></span>
                  <span>${order.orderNumber}</span>
                </div>
                <div class="detail-row">
                  <span><strong>${t.tour}:</strong></span>
                  <span>${tourTitle}</span>
                </div>
                <div class="detail-row">
                  <span><strong>${t.tourDate}:</strong></span>
                  <span>${formatDate(order.tourDate, lang)}</span>
                </div>
                <div class="detail-row">
                  <span><strong>${t.tourists}:</strong></span>
                  <span>${JSON.parse(order.tourists || '[]').length}</span>
                </div>
                ${(() => {
                  const fullPrice = order.booking?.totalPrice || order.totalAmount;
                  const payOpt = order.paymentOption || 'full';
                  const fix2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
                  if (payOpt === 'deposit' || payOpt === 'deposit_25') {
                    const pct = payOpt === 'deposit' ? 10 : 25;
                    const depositAmt = fix2(fullPrice * pct / 100);
                    const remainAmt = fix2(fullPrice * (100 - pct) / 100);
                    return `
                      <div class="detail-row">
                        <span><strong>${lang === 'en' ? 'Tour Total' : 'Итого за тур'}:</strong></span>
                        <span style="font-size: 20px; color: #667eea;"><strong>${fix2(fullPrice)} ${order.currency || 'TJS'}</strong></span>
                      </div>
                      <div class="detail-row">
                        <span><strong>${lang === 'en' ? `Deposit (${pct}%)` : `Депозит (${pct}%)`}:</strong></span>
                        <span style="font-size: 18px; color: #10b981;"><strong>${depositAmt} ${order.currency || 'TJS'}</strong></span>
                      </div>
                      <div class="detail-row">
                        <span><strong>${lang === 'en' ? `Remainder (${100-pct}%)` : `Остаток (${100-pct}%)`}:</strong></span>
                        <span>${remainAmt} ${order.currency || 'TJS'}</span>
                      </div>
                    `;
                  }
                  return `
                    <div class="detail-row">
                      <span><strong>${t.totalAmount}:</strong></span>
                      <span style="font-size: 20px; color: #667eea;"><strong>${fix2(order.totalAmount)} ${order.currency || 'TJS'}</strong></span>
                    </div>
                  `;
                })()}
              </div>
              
              <h3>${t.touristList}</h3>
              <ol>
                ${JSON.parse(order.tourists || '[]').map((tourist: any) => `
                  <li>${tourist.fullName} (${tourist.birthDate})</li>
                `).join('')}
              </ol>
              
              <!-- 🆕 Мульти-отели (с fallback на одиночный order.hotel) -->
              ${buildSelectedHotelsHtml(order, lang as 'ru' | 'en', 'email')}
              
              ${guideName ? `
                <h3>${t.guide}</h3>
                <p>${guideName}</p>
              ` : ''}
              
              <div class="footer">
                <p><strong>${t.contactInfo}:</strong></p>
                <p>📞 +992 915 123 344 | ✉️ booking@bunyodtour.tj</p>
                <p>© ${new Date().getFullYear()} Bunyod-Tour. ${t.allRightsReserved}.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };
  },
  
  bookingCancellation: (order: any, customer: Customer, lang: string = 'ru') => {
    const t = getTranslation(lang);
    
    return {
      subject: lang === 'en' 
        ? `Booking Cancellation #${order.orderNumber}` 
        : `Отмена бронирования №${order.orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; }
            .company-header { background: #3E3E3E; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .company-name { font-size: 28px; font-weight: bold; margin: 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.3); }
            .company-subtitle { font-size: 14px; margin: 5px 0 0 0; opacity: 0.9; }
            .header { background: #ef4444; color: white; padding: 30px; text-align: center; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="company-header">
              <img src="cid:bunyod_logo" alt="Bunyod-Tour" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">
              <h1 class="company-name">${t.companyName}</h1>
              <p class="company-subtitle">${t.companySubtitle}</p>
            </div>
          <div class="header">
            <h1>${t.bookingCancelled}</h1>
          </div>
          <div class="content">
            <p>${t.dear} ${customer.fullName},</p>
            <p>${t.bookingCancelledMessage} ${lang === 'en' ? `Order #${order.orderNumber}` : `№${order.orderNumber}`}</p>
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              ${t.questionsContact}<br>
              📧 ${t.email}: booking@bunyodtour.tj<br>
              📞 ${t.phones}: +992 915 123 344<br>
              🌐 ${t.website}: bunyodtour.tj
            </p>
            <p>${t.regards},<br>${t.team}</p>
          </div>
        </div>
      </body>
      </html>
      `
    };
  },
  
  paymentConfirmation: (order: any, customer: Customer, lang: string = 'ru') => {
    const t = getTranslation(lang);
    const tourTitle = getLocalizedValue(order.tour?.title, lang) || 'Tour';
    const paymentDate = formatDate(order.updatedAt || order.createdAt, lang);
    const dateLocalePC = lang === 'en' ? 'en-US' : 'ru-RU';
    const tourDateForEmail = order.tourDate ? new Date(order.tourDate).toLocaleDateString(dateLocalePC, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    
    return {
      subject: lang === 'en' 
        ? `Payment Confirmation #${order.orderNumber} - ${tourTitle}`
        : `Подтверждение оплаты №${order.orderNumber} - ${tourTitle}`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.8; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .company-header { background: linear-gradient(135deg, #3E3E3E 0%, #2a2a2a 100%); color: white; padding: 25px; text-align: center; }
          .company-name { font-size: 32px; font-weight: bold; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
          .company-subtitle { font-size: 14px; margin: 8px 0 0 0; opacity: 0.95; }
          .greeting-section { background: #fff; padding: 30px; border-bottom: 2px solid #f3f4f6; }
          .greeting-text { font-size: 15px; line-height: 1.8; color: #1f2937; margin-bottom: 15px; }
          .success-banner { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 35px 20px; text-align: center; }
          .success-icon { font-size: 48px; margin-bottom: 10px; }
          .success-title { font-size: 28px; font-weight: bold; margin: 0 0 10px 0; }
          .success-subtitle { font-size: 16px; opacity: 0.95; margin: 0; }
          .voucher-section { background: #fff; padding: 30px; }
          .contact-section { background: #f3f4f6; padding: 20px; text-align: center; margin-top: 30px; border-radius: 8px; }
          .footer { text-align: center; padding: 25px; background: #f9fafb; color: #6b7280; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="company-header">
            <img src="cid:bunyod_logo" alt="Bunyod-Tour" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">
            <h1 class="company-name">${t.companyName}</h1>
            <p class="company-subtitle">${t.companySubtitle}</p>
          </div>
          
          <div class="greeting-section">
            <p class="greeting-text">${t.dear} <strong>${customer.fullName}</strong>,</p>
            <p class="greeting-text">
              ${t.administrationConfirms} <strong>#${order.orderNumber}</strong>, ${t.from} <strong>${paymentDate}</strong>, ${t.tourProgram} <strong>«${tourTitle}»</strong>${tourDateForEmail ? ` ${t.onDate} <strong>${tourDateForEmail}</strong>` : ''}. 
              ${t.seeTicketDetails}
            </p>
            <p class="greeting-text" style="background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              📎 <strong>${t.ticketAttached}</strong>
            </p>
          </div>
          
          <div class="voucher-section">
            <div class="contact-section">
              <h3 style="margin-top: 0; color: #1f2937;">${t.contactInformation}</h3>
              <div style="text-align: left; max-width: 500px; margin: 0 auto; font-size: 14px; line-height: 1.8;">
                <p style="margin: 5px 0;">☎️ +992 915 123 344</p>
                <p style="margin: 5px 0;">💌 booking@bunyodtour.tj</p>
                <p style="margin: 5px 0;">🌐 <a href="https://bunyodtour.tj" style="color: #667eea; text-decoration: none;">bunyodtour.tj</a></p>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p style="margin: 10px 0; font-size: 15px;"><strong>${t.regards},</strong></p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>${t.administration}</strong></p>
            <p style="margin: 15px 0 5px 0; font-size: 13px; color: #6b7280;">734042, ${lang === 'en' ? 'Tajikistan, Dushanbe, Aini St. 104' : 'Таджикистан, г. Душанбе, ул. Айни 104'}</p>
            <p style="margin-top: 15px; font-size: 12px; line-height: 1.6; color: #9ca3af;">
              <strong>${t.importantInfo}</strong><br>
              • ${t.showTicketToGuide}<br>
              • ${t.arriveEarly}<br>
              • ${t.contactUs}
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">© ${new Date().getFullYear()} ${lang === 'en' ? 'Bunyod-Tour LLC' : 'ООО «Бунёд-Тур»'}. ${t.allRightsReserved}.</p>
          </div>
        </div>
      </body>
      </html>
    `
    };
  },
  
  adminNotification: (order: any, customer: Customer, tour: any) => {
    const tourists = JSON.parse(order.tourists || '[]');
    const tourTitle = tour.title?.ru || tour.title?.en || 'Tour';
    const hotelName = order.hotel?.name?.ru || order.hotel?.name?.en || 'Не выбран';
    
    return {
      subject: `💰 Новая оплата! Заказ №${order.orderNumber} - ${order.totalAmount} ${order.currency || 'TJS'}`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 26px; }
          .header p { margin: 10px 0 0 0; opacity: 0.95; }
          .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px; color: #92400e; }
          .content { padding: 30px; }
          .info-block { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #667eea; }
          .info-title { font-weight: bold; color: #1f2937; margin-bottom: 15px; font-size: 16px; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #6b7280; font-size: 14px; }
          .info-value { font-weight: 600; color: #1f2937; }
          .amount-box { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .amount { font-size: 36px; font-weight: bold; }
          .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Новая оплата получена!</h1>
            <p>Заказ успешно оплачен через ${order.paymentMethod || 'платежную систему'}</p>
          </div>
          
          <div class="alert-box">
            <strong>⚡ Требуется действие:</strong> Проверьте детали заказа и подготовьте тур для клиента
          </div>
          
          <div class="content">
            <div class="info-block">
              <div class="info-title">📋 Информация о заказе</div>
              <div class="info-row">
                <span class="info-label">Номер заказа</span>
                <span class="info-value">${order.orderNumber}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Дата заказа</span>
                <span class="info-value">${new Date(order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Статус оплаты</span>
                <span class="info-value" style="color: #10b981;">✓ Оплачено</span>
              </div>
            </div>
            
            <div class="info-block">
              <div class="info-title">🗺️ Детали тура</div>
              <div class="info-row">
                <span class="info-label">Название</span>
                <span class="info-value">${tourTitle}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Дата начала</span>
                <span class="info-value">${new Date(order.tourDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Количество туристов</span>
                <span class="info-value">${tourists.length} чел.</span>
              </div>
              <div class="info-row">
                <span class="info-label">Отель</span>
                <span class="info-value">${hotelName}</span>
              </div>
            </div>
            
            <div class="info-block">
              <div class="info-title">👤 Информация о клиенте</div>
              <div class="info-row">
                <span class="info-label">Имя</span>
                <span class="info-value">${customer.fullName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email</span>
                <span class="info-value">${customer.email}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Телефон</span>
                <span class="info-value">${customer.phone || 'Не указан'}</span>
              </div>
            </div>
            
            <div class="amount-box">
              <div style="font-size: 16px; margin-bottom: 5px;">Сумма заказа</div>
              <div class="amount">${order.totalAmount} ${order.currency || 'TJS'}</div>
              <div style="font-size: 14px; margin-top: 5px; opacity: 0.9;">Оплачено ${order.paymentMethod || 'онлайн'}</div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Bunyod-Tour</strong> - Система управления туристическими заказами</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} Все права защищены</p>
          </div>
        </div>
      </body>
      </html>
    `
    };
  }
};

export const emailService = {
  async sendBookingConfirmation(order: any, customer: Customer, tour: any): Promise<boolean> {
    try {
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
      const lang = order.language || 'ru';
      const template = emailTemplates.bookingConfirmation(order, customer, tour, lang);
      
      const fs = require('fs');
      const path = require('path');
      let logoBase64Content = '';
      let hasLogo = false;
      try {
        const logoPath = path.join(process.cwd(), 'frontend', 'Logo-Ru_1754635713718.png');
        if (fs.existsSync(logoPath)) {
          const logoBuffer = fs.readFileSync(logoPath);
          logoBase64Content = logoBuffer.toString('base64');
          hasLogo = true;
        }
      } catch (e) {
        console.warn('Failed to load logo for email:', e);
      }
      
      const mailOptions: any = {
        from: `"Bunyod-Tour" <${fromEmail}>`,
        to: customer.email,
        subject: template.subject,
        html: template.html
      };
      
      if (hasLogo) {
        mailOptions.attachments = [{
          filename: 'logo.png',
          content: Buffer.from(logoBase64Content, 'base64'),
          contentType: 'image/png',
          cid: 'bunyod_logo',
          contentDisposition: 'inline'
        }];
      }
      
      await sendMailWithRetry(mailOptions);
      
      console.log(`✅ Booking confirmation email sent to ${customer.email} via SMTP (lang: ${lang})`);
      return true;
    } catch (error) {
      console.error('❌ Error sending booking confirmation email:', error);
      return false;
    }
  },
  
  async sendCancellationEmail(order: any, customer: Customer): Promise<boolean> {
    try {
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
      const lang = order.language || 'ru';
      const template = emailTemplates.bookingCancellation(order, customer, lang);
      
      await sendMailWithRetry({
        from: `"Bunyod-Tour" <${fromEmail}>`,
        to: customer.email,
        subject: template.subject,
        html: template.html
      });
      
      console.log(`✅ Cancellation email sent to ${customer.email} via SMTP (lang: ${lang})`);
      return true;
    } catch (error) {
      console.error('❌ Error sending cancellation email:', error);
      return false;
    }
  },
  
  async sendPaymentConfirmation(order: any, customer: Customer): Promise<boolean> {
    try {
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
      const lang = order.language || 'ru';
      const t = getTranslation(lang);
      const tourTitle = getLocalizedValue(order.tour?.title, lang) || 'Tour';
      const paymentDate = formatDate(order.updatedAt || order.createdAt, lang);
      const dateLocaleEmail = lang === 'en' ? 'en-US' : 'ru-RU';
      const tourDateForEmail = order.tourDate ? new Date(order.tourDate).toLocaleDateString(dateLocaleEmail, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
      const usdRateVal = await getUsdRate();

      // 🌐 Подтягиваем английские переводы для услуг тура из справочника компонентов.
      // Без этого в email-ваучере на английском языке раздел "Included" показывал
      // русские названия, потому что в snapshot тура (`tour.services`) сохраняется
      // только русское `name`, а `nameEn` живёт в таблице PriceCalculatorComponent.
      if (order?.tour?.services) {
        try {
          const enriched = await enrichServicesWithEnglish(order.tour.services);
          order.tour.services = enriched;
        } catch (enrichErr) {
          console.warn('⚠️  Could not enrich tour services with English names:', enrichErr);
        }
      }
      
      const fs = require('fs');
      const path = require('path');
      let logoBase64Content = '';
      let hasLogo = false;
      try {
        const logoPath = path.join(process.cwd(), 'frontend', 'Logo-Ru_1754635713718.png');
        console.log('📷 Logo path:', logoPath);
        if (fs.existsSync(logoPath)) {
          const logoBuffer = fs.readFileSync(logoPath);
          logoBase64Content = logoBuffer.toString('base64');
          hasLogo = true;
          console.log('✅ Logo loaded for sendPaymentConfirmation, base64 length:', logoBase64Content.length);
        } else {
          console.warn('⚠️ Logo file not found at:', logoPath);
        }
      } catch (e) {
        console.warn('❌ Failed to load logo for email:', e);
      }
      
      const inlineTicket = generateInlineTicketHTML(order, customer, lang, usdRateVal);
      
      const emailHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.8; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 700px; margin: 0 auto; }
              .company-header { background: linear-gradient(135deg, #3E3E3E 0%, #2a2a2a 100%); color: white; padding: 25px; text-align: center; border-radius: 12px 12px 0 0; }
              .company-name { font-size: 32px; font-weight: bold; margin: 0; }
              .company-subtitle { font-size: 14px; margin: 8px 0 0 0; opacity: 0.95; }
              .greeting-section { background: #fff; padding: 30px; }
              .footer { text-align: center; padding: 25px; background: #f9fafb; color: #6b7280; font-size: 13px; border-radius: 0 0 12px 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="company-header">
                <div style="font-size: 24px; font-weight: 800; letter-spacing: 5px; margin-bottom: 10px; text-transform: uppercase; opacity: 0.95;">VOUCHER</div>
                ${hasLogo ? `<img src="cid:bunyod_logo" alt="Bunyod-Tour" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;">` : ''}
                <p class="company-subtitle">${t.companySubtitle}</p>
              </div>
              
              <div class="greeting-section">
                <p>${t.dear} <strong>${customer.fullName}</strong>,</p>
                <p>${t.administrationConfirms} <strong>#${order.orderNumber}</strong>, ${t.from} <strong>${paymentDate}</strong>, ${t.tourProgram} <strong>«${tourTitle}»</strong>${tourDateForEmail ? ` ${t.onDate} <strong>${tourDateForEmail}</strong>` : ''}.</p>
                <p>${t.ticketInline}:</p>
              </div>
              
              ${inlineTicket}
              
              <div class="footer">
                <p><strong>${t.regards}, ${t.administration}</strong></p>
                <p>734042, ${lang === 'en' ? 'Tajikistan, Dushanbe, Aini St. 104' : 'Таджикистан, г. Душанбе, ул. Айни 104'}</p>
                <p style="margin-top: 10px; font-size: 12px; line-height: 1.6; color: #9ca3af;">
                  <strong>${t.importantInfo}</strong><br>
                  • ${t.showTicketToGuide}<br>
                  • ${t.arriveEarly}
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">© ${new Date().getFullYear()} ${lang === 'en' ? 'Bunyod-Tour LLC' : 'ООО «Бунёд-Тур»'}. ${t.allRightsReserved}.</p>
              </div>
            </div>
          </body>
          </html>
        `;
      console.log('📧 Using inline HTML ticket in email body');
      
      const emailSubject = lang === 'en' 
        ? `Payment Confirmation #${order.orderNumber} - ${tourTitle}`
        : `Подтверждение оплаты №${order.orderNumber} - ${tourTitle}`;
      
      const nodemailerAttachments: any[] = [];
      
      if (hasLogo && logoBase64Content) {
        nodemailerAttachments.push({
          filename: 'logo.png',
          content: Buffer.from(logoBase64Content, 'base64'),
          contentType: 'image/png',
          cid: 'bunyod_logo',
          contentDisposition: 'inline'
        });
      }
      
      const mailOptions: any = {
        from: `"Bunyod-Tour" <${fromEmail}>`,
        to: customer.email,
        subject: emailSubject,
        html: emailHTML
      };
      
      if (nodemailerAttachments.length > 0) {
        mailOptions.attachments = nodemailerAttachments;
      }
      
      await sendMailWithRetry(mailOptions);
      
      console.log(`✅ Payment confirmation email with inline ticket sent to ${customer.email} (lang: ${lang})`);
      return true;
    } catch (error) {
      console.error('❌ Error sending payment confirmation email:', error);
      if (error instanceof Error) {
        console.error('❌ Error stack:', error.stack);
      }
      return false;
    }
  },
  
  async sendAdminNotification(order: any, customer: Customer, tour: any): Promise<boolean> {
    try {
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
      const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
      const template = emailTemplates.adminNotification(order, customer, tour);
      
      await sendMailWithRetry({
        from: `"Bunyod-Tour" <${fromEmail}>`,
        to: adminEmail,
        subject: template.subject,
        html: template.html
      });
      
      console.log(`✅ Admin notification email sent to ${adminEmail} via SMTP`);
      return true;
    } catch (error) {
      console.error('❌ Error sending admin notification email:', error);
      return false;
    }
  },
  
  async testEmailConfiguration(): Promise<boolean> {
    try {
      const transporter = createSmtpTransporter();
      await transporter.verify();
      console.log('✅ SMTP is ready to send messages');
      return true;
    } catch (error) {
      console.error('❌ SMTP configuration error:', error);
      return false;
    }
  },

  async sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
    try {
      console.log(`📧 Attempting to send email to: ${options.to}`);
      console.log(`📧 Subject: ${options.subject}`);
      
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
      console.log(`📧 Using SMTP from: ${fromEmail}`);
      
      await sendMailWithRetry({
        from: `"Bunyod-Tour" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html
      });
      console.log(`✅ Email successfully sent to ${options.to} via SMTP`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${options.to}`);
      console.error('❌ Email error:', error);
      if (error instanceof Error) {
        console.error('❌ Error stack:', error.stack);
      }
      throw error;
    }
  }
};

export async function sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
  try {
    console.log(`📧 [Standalone] Attempting to send email to: ${options.to}`);
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
    await sendMailWithRetry({
      from: `"Bunyod-Tour" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    });
    console.log(`✅ [Standalone] Email sent to ${options.to} via SMTP`);
  } catch (error) {
    console.error(`❌ [Standalone] Failed to send email to ${options.to}:`, error);
    throw error;
  }
}

export default emailService;
