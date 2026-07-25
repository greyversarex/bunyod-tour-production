import nodemailer from 'nodemailer';
import { Order, Customer } from '@prisma/client';
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
    connectionTimeout: 30000,
    greetingTimeout: 20000,
    socketTimeout: 45000
  } as any);
}

async function sendViaResend(mailOptions: any): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
    const toList = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];

    let htmlForResend = mailOptions.html;

    const baseUrl = process.env.FRONTEND_URL || 'https://bunyodtour.tj';
    if (mailOptions.attachments && mailOptions.attachments.length > 0) {
      mailOptions.attachments.forEach((att: any) => {
        if (att.cid) {
          const cidPattern = new RegExp(`cid:${att.cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
          if (att.cid === 'bunyod_logo') {
            htmlForResend = htmlForResend.replace(cidPattern, `${baseUrl}/Logo-Ru_1754635713718.png`);
          } else {
            let b64 = att._base64Content || '';
            if (!b64 && att.content instanceof Buffer) b64 = att.content.toString('base64');
            else if (!b64 && typeof att.content === 'string') b64 = Buffer.from(att.content).toString('base64');
            if (b64) {
              const mimeType = att.contentType || att.type || 'image/png';
              htmlForResend = htmlForResend.replace(cidPattern, `data:${mimeType};base64,${b64}`);
            }
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

async function sendMailWithRetry(mailOptions: any, maxRetries = 4): Promise<void> {
  // 1. Try Resend (primary — works via HTTPS, not blocked by VPS firewall)
  const resendSent = await sendViaResend(mailOptions);
  if (resendSent) return;

  if (process.env.RESEND_API_KEY) {
    console.log(`⚠️ Resend failed, falling back to SMTP...`);
  }

  // 2. Fall back to SMTP
  let lastError: any;
  const host = process.env.SMTP_HOST || 'mail.timeweb.com';

  const portSequence = [465, 587, 465, 587, 587];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const usePort587 = portSequence[attempt] === 587;
    const portUsed = portSequence[attempt];
    try {
      console.log(`📧 SMTP attempt ${attempt + 1}/${maxRetries + 1} on port ${portUsed}...`);
      const transporter = createSmtpTransporter(usePort587);
      await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully via port ${portUsed} (attempt ${attempt + 1})`);
      return;
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ SMTP attempt ${attempt + 1}/${maxRetries + 1} failed (port ${portUsed}):`, error.code || error.message);
      if (attempt < maxRetries) {
        const delay = 3000 * (attempt + 1);
        console.log(`⏳ Waiting ${delay/1000}s before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  console.error(`❌ All email sending methods failed. Resend: ${process.env.RESEND_API_KEY ? 'failed' : 'not configured'}, SMTP: all ${maxRetries + 1} attempts failed for ${host}`);
  throw lastError;
}

// Bilingual translations for emails
export const translations = {
  ru: {
    companySubtitle: 'Ваш надежный спутник в мире путешествий по Центральной Азии',
    bookingConfirmed: 'ПОДТВЕРЖДЕН',
    contactPerson: 'Контактное лицо:',
    tourParticipants: 'Участники тура:',
    person: 'человек',
    participantSingular: 'участник',
    participantsCount: 'участника(ов)',
    tourLanguage: 'Язык тура:',
    included: 'Включено:',
    hotelIncluded: 'Проживание в отеле',
    notSelected: 'Не выбран',
    confirmed: 'Подтверждено',
    confirmedAt: 'Подтверждено',
    clientPhone: 'Номер телефона клиента:',
    meetingPoint: 'Место сбора:',
    bookingSource: 'Источник бронирования:',
    productCode: 'Код продукта:',
    tourGuide: 'Гид тура:',
    assignedAtStart: 'Назначается при начале тура',
    specialRequests: 'Особые требования:',
    totalAmount: 'Сумма к оплате:',
    paymentStatus: 'Статус оплаты:',
    paid: 'Оплачено',
    depositLabel: 'Бронируй сейчас - плати потом',
    depositDesc10: 'Оплата 10% сейчас, 90% перед началом тура',
    depositDesc25: 'Оплата 25% сейчас, 75% перед началом тура',
    deposit25Label: 'Депозит 25%',
    fullPaymentLabel: 'Полная оплата',
    fullPaymentDesc: '100% оплата сейчас',
    remainderLabel: 'Остаток',
    remainderNote: 'Оплата перед началом тура',
    tourDate: 'Дата тура:',
    tourStartTime: 'Время начала:',
    freeCancellation: 'Бесплатная отмена',
    cancellationTerms: 'Возврат средств возможен лишь за 30 дней до начала забронированного тура',
    footerCompany: 'ООО «Бунёд-Тур». Все права защищены.',
    footerAddress: 'Таджикистан, г. Душанбе, ул. Айни 104',
    days: 'дней',
    day: 'день',
    hours: 'часов',
    hour: 'час',
    adults: 'взросл.',
    children: 'дет.',
    tourTypes: {
      'individual': 'Персональный',
      'Individual': 'Персональный',
      'group_private': 'Групповой',
      'group_general': 'Групповой общий',
      'group_shared': 'Групповой общий'
    },
    emailSubject: 'Подтверждение бронирования',
    emailGreeting: 'Уважаемый(ая)',
    emailBody: 'Администрация ООО «Бунёд-Тур» подтверждает вашу заявку (договор)',
    emailFrom: 'от',
    emailTour: 'на тур в рамках программы',
    emailOnDate: 'на дату',
    emailDetails: 'Подробно со всеми деталями вашего заказа вы можете ознакомиться в билете тура.',
    emailAttachment: 'Ваучер прикреплён к письму в формате PDF',
    emailContacts: 'Контакты для связи:',
    defaultPickup: 'Рудаки парк',
    languageName: 'Русский',
    paymentConfirmed: 'Оплата подтверждена!',
    thankYouPayment: 'Благодарим за оплату! Ваш заказ успешно обработан.',
    orderNumber: 'Номер заказа:',
    service: 'Услуга:',
    paidAmount: 'Оплачено:',
    guideHire: 'Найм гида',
    transfer: 'Трансфер',
    customTour: 'Собственный тур',
    otherService: 'Услуга',
    guide: 'Гид:',
    languages: 'Языки:',
    selectedDates: 'Выбранные даты:',
    numberOfDays: 'Количество дней:',
    pricePerDay: 'Цена за день:',
    notSpecified: 'не указано',
    from: 'Откуда:',
    to: 'Куда:',
    date: 'Дата:',
    orderSaved: 'Детали заказа сохранены в системе',
    managerContact: 'Наш менеджер свяжется с вами для подтверждения деталей.',
    saveEmail: 'Пожалуйста, сохраните это письмо и покажите его гиду в день тура',
    accommodation: 'Проживание',
    hotel: 'Отель:',
    rooms: 'Номера:',
    category: 'Категория',
    amenities: 'Удобства:',
    accommodationDetails: 'Детали проживания'
  },
  en: {
    companySubtitle: 'Your reliable travel companion across Central Asia',
    bookingConfirmed: 'CONFIRMED',
    contactPerson: 'Contact Person:',
    tourParticipants: 'Tour Participants:',
    person: 'person(s)',
    participantSingular: 'participant',
    participantsCount: 'participant(s)',
    tourLanguage: 'Tour Language:',
    included: 'Included:',
    hotelIncluded: 'Hotel Accommodation',
    notSelected: 'Not selected',
    confirmed: 'Confirmed',
    confirmedAt: 'Confirmed at',
    clientPhone: 'Client Phone:',
    meetingPoint: 'Pickup Location:',
    bookingSource: 'Booking Source:',
    productCode: 'Product Code:',
    tourGuide: 'Tour Guide:',
    assignedAtStart: 'Assigned at tour start',
    specialRequests: 'Special Requests:',
    totalAmount: 'Total Amount:',
    paymentStatus: 'Payment Status:',
    paid: 'Paid',
    depositLabel: 'Book Now - Pay Later',
    depositDesc10: 'Pay 10% now, 90% before the tour starts',
    depositDesc25: 'Pay 25% now, 75% before the tour starts',
    deposit25Label: 'Deposit 25%',
    fullPaymentLabel: 'Full Payment',
    fullPaymentDesc: '100% payment now',
    remainderLabel: 'Remainder',
    remainderNote: 'Payment before tour start',
    tourDate: 'Tour Date:',
    tourStartTime: 'Start Time:',
    freeCancellation: 'Free Cancellation',
    cancellationTerms: 'Free cancellation and full refund up to 30 days before the tour starts (local time, UTC +5)',
    footerCompany: 'Bunyod-Tour LLC. All rights reserved.',
    footerAddress: 'Tajikistan, Dushanbe, Ayni Street 104',
    days: 'days',
    day: 'day',
    hours: 'hours',
    hour: 'hour',
    adults: 'adults',
    children: 'children',
    tourTypes: {
      'individual': 'Individual',
      'Individual': 'Individual',
      'group_private': 'Private Group',
      'group_general': 'Group Shared',
      'group_shared': 'Group Shared'
    },
    emailSubject: 'Booking Confirmation',
    emailGreeting: 'Dear',
    emailBody: 'Bunyod-Tour LLC confirms your booking (contract)',
    emailFrom: 'dated',
    emailTour: 'for the tour',
    emailOnDate: 'scheduled for',
    emailDetails: 'You can find all the details of your order in the attached tour ticket.',
    emailAttachment: 'Voucher is attached to this email in PDF format',
    emailContacts: 'Contact us:',
    defaultPickup: 'Rudaki Park',
    languageName: 'English',
    paymentConfirmed: 'Payment Confirmed!',
    thankYouPayment: 'Thank you for your payment! Your order has been processed successfully.',
    orderNumber: 'Order Number:',
    service: 'Service:',
    paidAmount: 'Paid:',
    guideHire: 'Guide Hire',
    transfer: 'Transfer',
    customTour: 'Custom Tour',
    otherService: 'Service',
    guide: 'Guide:',
    languages: 'Languages:',
    selectedDates: 'Selected Dates:',
    numberOfDays: 'Number of Days:',
    pricePerDay: 'Price per Day:',
    notSpecified: 'not specified',
    from: 'From:',
    to: 'To:',
    date: 'Date:',
    orderSaved: 'Order details have been saved in our system',
    managerContact: 'Our manager will contact you to confirm the details.',
    saveEmail: 'Please save this email and show it to your guide on the day of the tour',
    accommodation: 'Accommodation',
    hotel: 'Hotel:',
    rooms: 'Rooms:',
    category: 'Category',
    amenities: 'Amenities:',
    accommodationDetails: 'Accommodation Details'
  }
};

// Helper function to get translations based on order language
export function getEmailTranslations(language: string = 'ru') {
  return translations[language === 'en' ? 'en' : 'ru'];
}

async function generateTicketPDF(order: any, customer: Customer, language: string = 'ru'): Promise<Buffer> {
  const lang = language === 'en' ? 'en' : 'ru';
  const t = translations[lang];
  const usdRate = await getUsdRate();
  const toUsd = (tjs: number) => (tjs / usdRate).toFixed(2);
  
  const tourists = JSON.parse(order.tourists || '[]');
  const tourTitle = order.tour?.title?.[lang] || order.tour?.title?.ru || order.tour?.title?.en || 'Tour';
  const hotelName = order.hotel?.name?.[lang] || order.hotel?.name?.ru || order.hotel?.name?.en || t.notSelected;
  const tourDurationType = order.tour?.durationType || 'days';
  const tourDuration = tourDurationType === 'hours'
    ? (parseInt(order.tour?.duration) || order.tour?.durationDays || 1)
    : (order.tour?.durationDays || parseInt(order.tour?.duration) || 1);
  const rawTourType = order.tour?.tourType || order.tour?.format || 'individual';
  
  let logoBase64 = '';
  try {
    const fs = require('fs');
    const path = require('path');
    const logoPath = path.join(process.cwd(), 'frontend', 'Logo-Ru_1754635713718.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
  } catch (e) {
    console.warn('Failed to load logo for PDF:', e);
  }
  
  const tourType = t.tourTypes[rawTourType as keyof typeof t.tourTypes] || rawTourType;
  const bookingRef = `BT-${order.id}${new Date().getFullYear()}`;
  const submissionTime = new Date(order.createdAt || Date.now());
  const dateLocale = lang === 'en' ? 'en-US' : 'ru-RU';
  const tourDateFormatted = order.tourDate ? new Date(order.tourDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  
  let services: any[] = [];
  try {
    if (order.tour?.services) {
      services = typeof order.tour.services === 'string' ? 
        JSON.parse(order.tour.services) : order.tour.services;
    }
  } catch (e) {
    console.warn('Error parsing tour services:', e);
  }
  
  let durationText: string;
  if (tourDurationType === 'hours') {
    durationText = tourDuration > 1 ? t.hours : t.hour;
  } else {
    durationText = tourDuration > 1 ? t.days : t.day;
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
        .company-logo { display: block; width: 70px; height: 70px; border-radius: 50%; margin: 0 auto 15px; object-fit: cover; }
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
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="company-header">
          <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; margin-bottom: 12px; text-transform: uppercase; opacity: 0.95;">VOUCHER</div>
          ${logoBase64 ? `<img src="${logoBase64}" alt="Bunyod-Tour Logo" class="company-logo">` : ''}
          <div class="company-subtitle">${t.companySubtitle}</div>
        </div>
        
        <div class="voucher-content">
          <div class="voucher-header">
            <div class="date">📅 ${new Date(order.tourDate).toLocaleDateString(dateLocale)}</div>
            <div class="status-badge">${t.bookingConfirmed}</div>
          </div>
          
          <div class="tour-title">${tourTitle}</div>
          <div class="tour-subtitle">${tourType} - ${tourDuration} ${durationText}</div>
          
          <div class="two-column">
            <div>
              ${customer.fullName ? `
                <div class="section">
                  <div class="section-title">${t.contactPerson}</div>
                  <div class="section-value">${customer.fullName}</div>
                </div>
              ` : ''}
              
              <div class="section">
                <div class="section-title">${t.tourParticipants}</div>
                <div class="section-value">${tourists.length} ${t.person}</div>
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
                <div class="section-title">${t.tourLanguage}</div>
                <div class="section-value">${t.languageName}</div>
              </div>
              
              <div class="section">
                <div class="section-title">${t.included}</div>
                <div class="services-list">
                  ${(Array.isArray(services) ? services : [])
                    .filter((s: any) => !(s && typeof s === 'object' && s.key === 'accommodation_std' && (s.id === undefined || s.id === null)))
                    .map((service: any) => {
                      const serviceName = typeof service.name === 'object' 
                        ? (service.name[lang] || service.name.ru || service.name.en || JSON.stringify(service.name))
                        : service.name;
                      return `<div class="service-item">${serviceName}</div>`;
                    }).join('')}
                  ${hotelName !== t.notSelected ? `<div class="service-item">${t.hotelIncluded}</div>` : ''}
                </div>
              </div>
              
              <!-- 🆕 Selected Hotels block (multi-hotel) -->
              ${buildSelectedHotelsHtml(order, lang, 'pdf')}
            </div>
            
            <div>
              <div class="section">
                <div class="section-title">${bookingRef}</div>
                <div class="section-value">${t.confirmed} ${submissionTime.toLocaleDateString(dateLocale)} ${submissionTime.toLocaleTimeString(dateLocale, {hour: '2-digit', minute:'2-digit'})} GMT+5</div>
              </div>
              
              ${tourDateFormatted ? `
                <div class="section">
                  <div class="section-title">${t.tourDate}</div>
                  <div class="section-value">${tourDateFormatted}</div>
                </div>
              ` : ''}

              ${customer.phone ? `
                <div class="section">
                  <div class="section-title">${t.clientPhone}</div>
                  <div class="section-value">${customer.phone}</div>
                </div>
              ` : ''}
              
              <div class="section">
                <div class="section-title">${t.meetingPoint}</div>
                <div class="section-value">${typeof order.tour?.pickupInfo === 'object' ? (order.tour.pickupInfo[lang] || order.tour.pickupInfo.ru || order.tour.pickupInfo.en || t.defaultPickup) : (order.tour?.pickupInfo || t.defaultPickup)}</div>
              </div>
              
              <div class="section">
                <div class="section-title">${t.bookingSource}</div>
                <div class="section-value">Bunyod-Tour</div>
              </div>
              
              <div class="section">
                <div class="section-title">${t.productCode}</div>
                <div class="section-value">TOUR-${order.tourId || order.id}</div>
              </div>
              
              ${(() => {
                const fullPrice = order.booking?.totalPrice || order.totalAmount;
                const payOpt = order.paymentOption || 'full';
                const fix2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
                if (payOpt === 'deposit') {
                  const depAmt = fix2(fullPrice * 0.1);
                  const remAmt = fix2(fullPrice * 0.9);
                  return `
                    <div class="section">
                      <div class="section-title">${lang === 'en' ? 'Tour Total:' : 'Итого за тур:'}</div>
                      <div class="section-value" style="font-size: 24px; font-weight: bold; color: #1f2937;">${fix2(fullPrice)} TJS</div>
                      <div class="section-value" style="font-size: 13px; color: #6b7280;">≈ ${toUsd(fullPrice)} USD</div>
                    </div>
                    <div class="section">
                      <div class="section-title">${lang === 'en' ? 'Deposit (10%) — paid:' : 'Депозит (10%) — оплачено:'}</div>
                      <div class="section-value" style="font-size: 22px; font-weight: bold; color: #10b981;">${depAmt} TJS</div>
                      <div class="section-value" style="font-size: 12px; color: #6b7280;">≈ ${toUsd(fullPrice * 0.1)} USD</div>
                    </div>
                    <div class="section">
                      <div class="section-title">${lang === 'en' ? 'Remainder (90%):' : 'Остаток (90%):'}</div>
                      <div class="section-value">${remAmt} TJS</div>
                    </div>
                  `;
                }
                if (payOpt === 'deposit_25') {
                  const depAmt = fix2(fullPrice * 0.25);
                  const remAmt = fix2(fullPrice * 0.75);
                  return `
                    <div class="section">
                      <div class="section-title">${lang === 'en' ? 'Tour Total:' : 'Итого за тур:'}</div>
                      <div class="section-value" style="font-size: 24px; font-weight: bold; color: #1f2937;">${fix2(fullPrice)} TJS</div>
                      <div class="section-value" style="font-size: 13px; color: #6b7280;">≈ ${toUsd(fullPrice)} USD</div>
                    </div>
                    <div class="section">
                      <div class="section-title">${lang === 'en' ? 'Deposit (25%) — paid:' : 'Депозит (25%) — оплачено:'}</div>
                      <div class="section-value" style="font-size: 22px; font-weight: bold; color: #10b981;">${depAmt} TJS</div>
                      <div class="section-value" style="font-size: 12px; color: #6b7280;">≈ ${toUsd(fullPrice * 0.25)} USD</div>
                    </div>
                    <div class="section">
                      <div class="section-title">${lang === 'en' ? 'Remainder (75%):' : 'Остаток (75%):'}</div>
                      <div class="section-value">${remAmt} TJS</div>
                    </div>
                  `;
                }
                return `
                  <div class="section">
                    <div class="section-title">${t.totalAmount}</div>
                    <div class="section-value" style="font-size: 24px; font-weight: bold; color: #10b981;">${fix2(order.totalAmount)} TJS</div>
                    <div class="section-value" style="font-size: 13px; color: #6b7280;">≈ ${toUsd(order.totalAmount)} USD</div>
                  </div>
                `;
              })()}
              
              <div class="section">
                <div class="section-title">${t.paymentStatus}</div>
                <div class="section-value" style="color: #10b981; font-weight: bold;">✅ ${t.paid}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          © ${new Date().getFullYear()} ${t.footerCompany}<br>
          734042, ${t.footerAddress}
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

export async function sendEmailWithSendGrid(
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{content: string; filename: string; type: string; content_id?: string; disposition?: string}>
) {
  try {
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
    
    const mailOptions: any = {
      from: `"Bunyod-Tour" <${fromEmail}>`,
      to,
      subject,
      html
    };
    
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map(att => {
        const result: any = {
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.type,
          _base64Content: att.content
        };
        if (att.content_id) {
          result.cid = att.content_id;
          result.contentDisposition = 'inline';
        }
        if (att.disposition) {
          result.contentDisposition = att.disposition;
        }
        return result;
      });
    }
    
    await sendMailWithRetry(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Email send error:', error?.message || error);
    throw error;
  }
}

/**
 * 🆕 Универсальный рендер мульти-отелей для email/PDF.
 * Использует order.selectedHotels (JSON-массив, заполняется на этапе booking step1),
 * при отсутствии — fallback на одиночный order.hotel (старые заказы).
 * mode: 'email' — таблица для тела письма; 'pdf' — секция для PDF-билета.
 */
function buildSelectedHotelsHtml(order: any, lang: 'ru' | 'en', mode: 'email' | 'pdf'): string {
  const L = (v: any): string => {
    if (!v) return '';
    if (typeof v === 'string') {
      try { const p = JSON.parse(v); return L(p); } catch { return v; }
    }
    if (typeof v === 'object') return v[lang] || v.ru || v.en || Object.values(v)[0] || '';
    return String(v);
  };
  const tr = {
    accommodation: lang === 'en' ? 'Accommodation' : 'Проживание',
    hotel: lang === 'en' ? 'Hotel' : 'Отель',
    city: lang === 'en' ? 'City' : 'Город',
    nights: lang === 'en' ? 'nights' : 'ночей',
    night: lang === 'en' ? 'night' : 'ночь',
    rooms: lang === 'en' ? 'Rooms' : 'Номера',
    meal: lang === 'en' ? 'Meal' : 'Питание',
    pcs: lang === 'en' ? 'pcs' : 'шт',
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

  // Получаем массив отелей
  let hotels: any[] = [];
  const raw = order.selectedHotels;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) hotels = parsed;
    } catch {}
  }
  // Fallback на одиночный отель (старые заказы)
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

  if (mode === 'pdf') {
    const items = hotels.map((h: any) => {
      const hn = L(h.hotelName) || tr.hotel;
      const cn = L(h.cityName);
      const nightsTxt = h.nights ? ` · ${h.nights} ${h.nights === 1 ? tr.night : tr.nights}` : '';
      const roomsArr = Object.entries(h.rooms || {});
      const roomsTxt = roomsArr.length
        ? roomsArr.map(([rt, info]: any) => `${roomTypeLabel(rt)} × ${info.quantity || info}`).join(', ')
        : '';
      const mealTxt = h.meal ? mealLabel(h.meal) : '';
      return `
        <div style="margin-bottom: 8px; padding: 8px 12px; background: #f9fafb; border-left: 3px solid #6b7280; border-radius: 4px;">
          <div style="font-weight: 600; color: #1f2937; font-size: 14px;">${hn}${cn ? ` <span style="color:#6b7280;font-weight:400;">— ${cn}</span>` : ''}${nightsTxt}</div>
          ${roomsTxt ? `<div style="color:#4b5563;font-size:13px;margin-top:3px;">${tr.rooms}: ${roomsTxt}</div>` : ''}
          ${mealTxt ? `<div style="color:#4b5563;font-size:13px;margin-top:2px;">${tr.meal}: ${mealTxt}</div>` : ''}
        </div>`;
    }).join('');
    return `
      <div class="section">
        <div class="section-title">${hotels.length > 1 ? (lang === 'en' ? 'Hotels' : 'Отели') : tr.hotel}:</div>
        ${items}
      </div>`;
  }

  // mode === 'email'
  const items = hotels.map((h: any) => {
    const hn = L(h.hotelName) || tr.hotel;
    const cn = L(h.cityName);
    const nightsTxt = h.nights ? ` · ${h.nights} ${h.nights === 1 ? tr.night : tr.nights}` : '';
    const roomsArr = Object.entries(h.rooms || {});
    const roomsTxt = roomsArr.length
      ? roomsArr.map(([rt, info]: any) => `${roomTypeLabel(rt)} × ${info.quantity || info}`).join(', ')
      : '';
    const mealTxt = h.meal ? mealLabel(h.meal) : '';
    return `
      <tr><td style="padding: 6px 10px; background: #f9fafb; border-left: 3px solid #6b7280; border-radius: 4px;">
        <div style="font-weight:600;color:#1f2937;font-size:13px;">🏨 ${hn}${cn ? ` <span style="color:#6b7280;font-weight:400;">— ${cn}</span>` : ''}${nightsTxt}</div>
        ${roomsTxt ? `<div style="color:#4b5563;font-size:12px;margin-top:2px;">${tr.rooms}: ${roomsTxt}</div>` : ''}
        ${mealTxt ? `<div style="color:#4b5563;font-size:12px;margin-top:2px;">${tr.meal}: ${mealTxt}</div>` : ''}
      </td></tr>
      <tr><td style="height:6px;"></td></tr>`;
  }).join('');
  return `
    <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 12px 0 6px 0;">${hotels.length > 1 ? (lang === 'en' ? 'Hotels' : 'Отели') : tr.hotel}</p>
    <table cellpadding="0" cellspacing="0" width="100%">${items}</table>
    <div style="margin-bottom: 12px;"></div>`;
}

export async function sendBookingConfirmation(order: any, customer: Customer, tour: any, language?: string) {
  try {
    const lang = (language || order.language || 'ru') === 'en' ? 'en' : 'ru';
    const t = translations[lang];
    const dateLocale = lang === 'en' ? 'en-US' : 'ru-RU';
    
    console.log(`📧 Building inline ticket email for order ${order.orderNumber} in language: ${lang}...`);
    
    const subject = `${t.emailSubject} №${order.orderNumber}`;
    const tourTitle = tour.title?.[lang] || tour.title?.ru || tour.title?.en || 'Tour';
    const paymentDate = new Date(order.updatedAt || order.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });
    const tourDateForEmail = order.tourDate ? new Date(order.tourDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    
    const tourists = (() => { try { return JSON.parse(order.tourists || '[]'); } catch { return []; } })();
    const rawTourType = order.tour?.tourType || tour.tourType || '';
    const tourType = t.tourTypes[rawTourType as keyof typeof t.tourTypes] || rawTourType;
    const tourDuration = order.tour?.duration || tour.duration || 1;
    const durationType = order.tour?.durationType || tour.durationType || 'days';
    let durationText: string;
    if (durationType === 'hours') {
      durationText = tourDuration > 1 ? t.hours : t.hour;
    } else {
      durationText = tourDuration > 1 ? t.days : t.day;
    }
    const bookingRef = order.orderNumber;
    const submissionTime = new Date(order.createdAt || Date.now());
    const totalAmount = order.totalAmount || 0;
    const fullTourPrice = order.booking?.totalPrice || totalAmount;
    const paymentOption = order.paymentOption || order.selectedPaymentOption || 'full';
    const usdRate = await getUsdRate();
    
    const numAdults = order.numAdults || tourists.length || 1;
    const numChildren = order.numChildren || 0;
    let participantsText: string;
    if (numChildren > 0) {
      participantsText = `${numAdults} ${t.adults} + ${numChildren} ${t.children}`;
    } else {
      participantsText = `${tourists.length || numAdults} ${tourists.length === 1 ? t.participantSingular : t.participantsCount}`;
    }
    
    let services: any[] = [];
    try {
      const svcData = order.tour?.services || tour.services;
      if (svcData) {
        services = typeof svcData === 'string' ? JSON.parse(svcData) : svcData;
      }
    } catch (e) {}

    // 🌐 Подтягиваем английские названия (nameEn) из таблицы PriceCalculatorComponent.
    // На туре сохраняется только русское `name` (snapshot), а английский перевод живёт
    // отдельно, поэтому без обогащения раздел "Included" в email-ваучере на английском
    // показывал русские названия услуг.
    if (Array.isArray(services) && services.length > 0) {
      try {
        // Не фильтруем по isActive: старые заказы могут ссылаться на компоненты,
        // которые позже были деактивированы — английский перевод нам всё равно нужен.
        const components = await prisma.priceCalculatorComponent.findMany({
          select: { id: true, key: true, name: true, nameEn: true }
        });
        const norm = (v: any) => (v == null ? '' : String(v).trim());
        services = services.map((service: any) => {
          if (service && typeof service === 'object' && service.nameEn) return service;
          const sKey = norm(service.key);
          const sId = norm(service.id);
          const sName = typeof service.name === 'string' ? service.name.trim() : '';
          const match = components.find(c =>
            (sKey && norm(c.key) === sKey) ||
            (sId && norm(c.id) === sId) ||
            (sName && c.name === sName)
          );
          if (match?.nameEn) return { ...service, nameEn: match.nameEn };
          return service;
        });
      } catch (enrichErr) {
        console.warn('⚠️  Could not enrich services with English names:', enrichErr);
      }
    }
    
    const pickupInfo = (() => {
      const pi = order.tour?.pickupInfo || tour.pickupInfo;
      const piEn = order.tour?.pickupInfoEn || tour.pickupInfoEn;
      if (lang === 'en' && piEn) return piEn;
      if (!pi) return t.defaultPickup;
      return typeof pi === 'object' ? (pi[lang] || pi.ru || pi.en || t.defaultPickup) : pi;
    })();
    
    let logoBase64 = '';
    try {
      const path = require('path');
      const logoPath = path.join(process.cwd(), 'frontend', 'Logo-Ru_1754635713718.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (e) {}
    
    const tourId = order.tour?.id || tour.id || 0;
    const specialRequests = (() => {
      const raw = order.specialRequests || order.wishes || '';
      return raw.replace(/tourStartTime:[^\s|]+\s*\|?\s*/g, '').trim();
    })();
    
    const tourStartTime = (() => {
      const fromTour = order.tour?.startTime || tour.startTime || '';
      if (fromTour) return fromTour;
      const wishes = order.wishes || '';
      const match = wishes.match(/tourStartTime:([^\s|]+)/);
      return match ? match[1] : '';
    })();
    
    const touristListHtml = tourists.length > 0 ? tourists.map((tourist: any, index: number) => `
      <tr><td style="padding: 2px 0; font-size: 13px; color: #4b5563;">
        <span style="display: inline-block; width: 20px; height: 20px; background: #6b7280; color: white; border-radius: 50%; text-align: center; line-height: 20px; font-size: 10px; margin-right: 6px;">${index + 1}</span>
        ${tourist.fullName}${tourist.dateOfBirth || tourist.birthDate ? ` (${new Date(tourist.dateOfBirth || tourist.birthDate).toLocaleDateString(dateLocale)})` : ''}
      </td></tr>
    `).join('') : '';
    
    // 🚫 Скрываем авто-добавленные accommodation_std (без id) — нужны только серверу
    // для логики замены проживания, в PDF-билет не должны попадать.
    const servicesHtml = (Array.isArray(services) ? services : [])
      .filter((s: any) => !(s && typeof s === 'object' && s.key === 'accommodation_std' && (s.id === undefined || s.id === null)))
      .map((service: any) => {
        const sName = lang === 'en' && service.nameEn ? service.nameEn : 
          (typeof service.name === 'object' ? (service.name[lang] || service.name.ru || service.name.en || '') : (service.name || ''));
        return `<tr><td style="padding: 2px 0; font-size: 13px; color: #374151;">
          <span style="color: #10b981; margin-right: 4px;">✓</span> ${sName}
        </td></tr>`;
      }).join('');
    
    const hasHotel = order.hotel && order.hotel.name;
    const hotelServiceHtml = hasHotel ? `<tr><td style="padding: 2px 0; font-size: 13px; color: #374151;">
      <span style="color: #10b981; margin-right: 4px;">✓</span> ${t.accommodation}
    </td></tr>` : '';
    
    let amountHtml = '';
    const toFixed2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
    const toUsd = (tjs: number) => (tjs / usdRate).toFixed(2);
    
    if (paymentOption === 'deposit') {
      const depositAmt = toFixed2(fullTourPrice * 0.1);
      const remainAmt = toFixed2(fullTourPrice * 0.9);
      amountHtml = `
        <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 4px 0;">${lang === 'en' ? 'Tour Total:' : 'Итого за тур:'}</p>
        <p style="font-size: 24px; font-weight: bold; color: #374151; margin: 0;">${toFixed2(fullTourPrice)} TJS</p>
        <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0 0;">≈ ${toUsd(fullTourPrice)} USD</p>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #d1d5db;">
          <p style="font-size: 13px; color: #374151; margin: 0 0 4px 0;">${lang === 'en' ? 'Deposit (10%) — pay now:' : 'Депозит (10%) — к оплате сейчас:'}</p>
          <p style="font-size: 22px; font-weight: bold; color: #059669; margin: 0;">${depositAmt} TJS</p>
          <p style="font-size: 12px; color: #6b7280; margin: 2px 0 0 0;">≈ ${toUsd(fullTourPrice * 0.1)} USD</p>
        </div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 13px; color: #374151; margin: 0;">${t.remainderLabel} (90%): <strong>${remainAmt} TJS</strong></p>
          <p style="font-size: 11px; color: #6b7280; margin: 2px 0 0 0;">${t.remainderNote}</p>
        </div>
      `;
    } else if (paymentOption === 'deposit_25') {
      const depositAmt = toFixed2(fullTourPrice * 0.25);
      const remainAmt = toFixed2(fullTourPrice * 0.75);
      amountHtml = `
        <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 4px 0;">${lang === 'en' ? 'Tour Total:' : 'Итого за тур:'}</p>
        <p style="font-size: 24px; font-weight: bold; color: #374151; margin: 0;">${toFixed2(fullTourPrice)} TJS</p>
        <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0 0;">≈ ${toUsd(fullTourPrice)} USD</p>
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #d1d5db;">
          <p style="font-size: 13px; color: #374151; margin: 0 0 4px 0;">${lang === 'en' ? 'Deposit (25%) — pay now:' : 'Депозит (25%) — к оплате сейчас:'}</p>
          <p style="font-size: 22px; font-weight: bold; color: #059669; margin: 0;">${depositAmt} TJS</p>
          <p style="font-size: 12px; color: #6b7280; margin: 2px 0 0 0;">≈ ${toUsd(fullTourPrice * 0.25)} USD</p>
        </div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 13px; color: #374151; margin: 0;">${t.remainderLabel} (75%): <strong>${remainAmt} TJS</strong></p>
          <p style="font-size: 11px; color: #6b7280; margin: 2px 0 0 0;">${t.remainderNote}</p>
        </div>
      `;
    } else {
      amountHtml = `
        <p style="font-size: 24px; font-weight: bold; color: #374151; margin: 0;">${toFixed2(totalAmount)} TJS</p>
        <p style="font-size: 13px; color: #6b7280; margin: 4px 0 0 0;">≈ ${toUsd(totalAmount)} USD</p>
      `;
    }
    
    let paymentBadgeHtml = '';
    if (paymentOption === 'deposit') {
      paymentBadgeHtml = `
        <div style="margin-top: 12px; padding: 10px; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px;">
          <p style="font-size: 13px; font-weight: 600; color: #1f2937; margin: 0;">📅 ${t.depositLabel} (10%)</p>
          <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">${t.depositDesc10}</p>
        </div>
      `;
    } else if (paymentOption === 'deposit_25') {
      paymentBadgeHtml = `
        <div style="margin-top: 12px; padding: 10px; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px;">
          <p style="font-size: 13px; font-weight: 600; color: #1f2937; margin: 0;">💰 ${t.deposit25Label}</p>
          <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">${t.depositDesc25}</p>
        </div>
      `;
    } else {
      paymentBadgeHtml = `
        <div style="margin-top: 12px; padding: 10px; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px;">
          <p style="font-size: 13px; font-weight: 600; color: #1f2937; margin: 0;">✅ ${t.fullPaymentLabel}</p>
          <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">${t.fullPaymentDesc}</p>
        </div>
      `;
    }
    
    let cancellationHtml = '';
    if (order.tourDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tourDateObj = new Date(order.tourDate);
      tourDateObj.setHours(0, 0, 0, 0);
      const daysUntilTour = Math.ceil((tourDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilTour >= 30) {
        cancellationHtml = `
          <div style="margin-top: 12px; padding: 10px; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 8px;">
            <p style="font-size: 13px; font-weight: 600; color: #1f2937; margin: 0;">↩ ${t.freeCancellation}</p>
            <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0;">${t.cancellationTerms}</p>
          </div>
        `;
      }
    }
    
    const tourLanguageDisplay = lang === 'en' ? 'English' : 'Русский';
    
    let logoAttachment: any = null;
    if (logoBase64) {
      const rawBase64 = logoBase64.replace(/^data:image\/png;base64,/, '');
      logoAttachment = {
        content: rawBase64,
        filename: 'logo.png',
        type: 'image/png',
        content_id: 'bunyod_logo',
        disposition: 'inline'
      };
    }
    
    const tourDateDisplay = (() => {
      const d = new Date(order.tourDate || order.createdAt);
      const dateStr = d.toLocaleDateString(dateLocale);
      if (tourStartTime) return `${dateStr}, ${tourStartTime}`;
      return dateStr;
    })();
    const tourDateOnly = order.tourDate ? new Date(order.tourDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #333; background: #f5f5f5; margin: 0; padding: 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 680px; margin: 0 auto;">
          <tr><td>
            
            <!-- Greeting Section -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background: white; border-radius: 8px 8px 0 0; border-bottom: 1px solid #e5e7eb;">
              <tr><td style="padding: 24px 28px;">
                <p style="font-size: 15px; color: #1f2937; line-height: 1.7; margin: 0 0 10px 0;">${t.emailGreeting} <strong>${customer.fullName}</strong>,</p>
                <p style="font-size: 15px; color: #1f2937; line-height: 1.7; margin: 0;">
                  ${t.emailBody} <strong>№${bookingRef}</strong>, ${t.emailFrom} <strong>${paymentDate}</strong>, ${t.emailTour} <strong>«${tourTitle}»</strong>${tourDateForEmail ? ` ${t.emailOnDate} <strong>${tourDateForEmail}</strong>` : ''}. ${t.emailDetails}
                </p>
              </td></tr>
            </table>
            
            <!-- Company Header -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #3E3E3E;">
              <tr><td style="padding: 20px; text-align: center;">
                <p style="font-size: 28px; font-weight: 800; letter-spacing: 6px; text-transform: uppercase; color: white; opacity: 0.95; margin: 0 0 12px 0;">VOUCHER</p>
                <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    ${logoAttachment ? `<td style="padding-right: 12px; vertical-align: middle;"><img src="cid:bunyod_logo" alt="Bunyod-Tour" style="width: 50px; height: 50px; border-radius: 50%;"></td>` : ''}
                    <td style="vertical-align: middle;">
                      <p style="font-size: 12px; color: rgba(255,255,255,0.85); margin: 2px 0 0 0;">${t.companySubtitle}</p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
            
            <!-- Ticket Body -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background: white;">
              <tr><td style="padding: 24px 28px;">
                
                <!-- Date + Confirmed Badge -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 20px;">
                  <tr>
                    <td style="padding-bottom: 12px; font-size: 14px; color: #6b7280;">📅 ${tourDateDisplay}</td>
                    <td style="padding-bottom: 12px; text-align: right;">
                      <span style="background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${t.bookingConfirmed}</span>
                    </td>
                  </tr>
                </table>
                
                <!-- Tour Title -->
                <p style="font-size: 22px; font-weight: bold; color: #1f2937; margin: 0 0 4px 0;">${tourTitle}</p>
                <p style="font-size: 14px; color: #6b7280; margin: 0 0 20px 0;">${tourType} - ${tourDuration} ${durationText}</p>
                
                <!-- Two Column Layout -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <!-- LEFT COLUMN -->
                    <td style="width: 48%; vertical-align: top; padding-right: 16px;">
                      
                      <!-- Contact Person -->
                      ${customer.fullName ? `
                        <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.contactPerson}</p>
                        <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${customer.fullName}</p>
                      ` : ''}
                      
                      <!-- Participants -->
                      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.tourParticipants}</p>
                      <p style="font-size: 14px; color: #374151; margin: 0;">${participantsText}</p>
                      ${touristListHtml ? `
                        <table cellpadding="0" cellspacing="0" style="margin-top: 6px;">
                          ${touristListHtml}
                        </table>
                      ` : ''}
                      <div style="margin-bottom: 16px;"></div>
                      
                      <!-- Tour Language -->
                      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.tourLanguage}</p>
                      <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${tourLanguageDisplay}</p>
                      
                      <!-- Included -->
                      ${(servicesHtml || hotelServiceHtml) ? `
                        <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.included}</p>
                        <table cellpadding="0" cellspacing="0">
                          ${servicesHtml}
                          ${hotelServiceHtml}
                        </table>
                        <div style="margin-bottom: 16px;"></div>
                      ` : ''}
                      
                      <!-- 🆕 Selected Hotels (multi-hotel support) -->
                      ${buildSelectedHotelsHtml(order, lang, 'email')}
                      
                      <!-- Special Requests -->
                      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.specialRequests}</p>
                      <p style="font-size: 13px; color: #374151; margin: 0 0 16px 0;">${specialRequests || '-'}</p>
                      
                    </td>
                    
                    <!-- RIGHT COLUMN -->
                    <td style="width: 48%; vertical-align: top; padding-left: 16px;">
                      
                      <!-- Booking Reference -->
                      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 2px 0;">${bookingRef}</p>
                      <p style="font-size: 12px; color: #6b7280; margin: 0 0 16px 0;">${t.confirmedAt} ${submissionTime.toLocaleDateString(dateLocale)} ${submissionTime.toLocaleTimeString(dateLocale, {hour: '2-digit', minute:'2-digit'})} GMT+5</p>
                      
                      <!-- Tour Date -->
                      ${tourDateOnly ? `
                        <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.tourDate}</p>
                        <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${tourDateOnly}</p>
                      ` : ''}

                      <!-- Client Phone -->
                      ${customer.phone ? `
                        <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.clientPhone}</p>
                        <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${customer.phone}</p>
                      ` : ''}
                      
                      <!-- Pickup Location -->
                      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.meetingPoint}</p>
                      <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${pickupInfo}</p>
                      
                      <!-- Start Time -->
                      ${tourStartTime ? `
                        <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.tourStartTime}</p>
                        <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${tourStartTime}</p>
                      ` : ''}
                      
                      <!-- Booking Source -->
                      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.bookingSource}</p>
                      <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">Bunyod-Tour</p>
                      
                      <!-- Product Code -->
                      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.productCode}</p>
                      <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">TOUR${tourId}TJ${tourDuration}D</p>
                      
                      <!-- Tour Guide -->
                      <p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 6px 0;">${t.tourGuide}</p>
                      <p style="font-size: 14px; color: #374151; margin: 0 0 16px 0;">${t.assignedAtStart}</p>
                      
                      <!-- Total Amount Box -->
                      <div style="background: #f9fafb; padding: 14px; border-radius: 8px; margin-bottom: 0;">
                        ${paymentOption === 'full' ? `<p style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 8px 0;">${t.totalAmount}</p>` : ''}
                        ${amountHtml}
                      </div>
                      
                      <!-- Payment Badge -->
                      ${paymentBadgeHtml}
                      
                      <!-- Cancellation Policy -->
                      ${cancellationHtml}
                      
                    </td>
                  </tr>
                </table>
                
              </td></tr>
            </table>
            
            <!-- Footer: Save email notice -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-top: 1px solid #e5e7eb;">
              <tr><td style="padding: 14px 24px; text-align: center; font-size: 12px; color: #6b7280;">
                ${t.saveEmail}
              </td></tr>
            </table>
            
            <!-- Contact Section -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 0 0 8px 8px;">
              <tr><td style="padding: 14px 24px; text-align: center;">
                <p style="font-size: 13px; font-weight: 600; color: #4b5563; margin: 0 0 4px 0;">${t.emailContacts}</p>
                <p style="font-size: 13px; color: #4b5563; margin: 0;">📞 +992 44 625 7575 | ✉️ booking@bunyodtour.tj</p>
                <p style="font-size: 11px; color: #9ca3af; margin: 8px 0 0 0;">© ${new Date().getFullYear()} ${t.footerCompany} 734042, ${t.footerAddress}</p>
              </td></tr>
            </table>
            
          </td></tr>
        </table>
      </body>
      </html>
    `;
    
    const attachments = logoAttachment ? [logoAttachment] : undefined;
    
    await sendEmailWithSendGrid(
      customer.email,
      subject,
      html,
      attachments
    );
    
    console.log(`✅ Booking confirmation with inline ticket (${lang}) sent to ${customer.email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending booking confirmation:', error);
    throw error;
  }
}

export async function sendNonTourPaymentConfirmation(
  order: any,
  customer: any,
  orderType: 'guideHire' | 'transfer' | 'customTour' | 'other',
  detailsData?: {
    guideName?: string;
    guideLanguages?: string;
    selectedDates?: string;
    numberOfDays?: number;
    pricePerDay?: number;
    pickupLocation?: string;
    dropoffLocation?: string;
    date?: string;
    dropoffDate?: string;
    rentalDays?: number;
    pickupTime?: string;
    passengers?: number;
    vehicleType?: string;
    driverName?: string;
    tourName?: string;
    startDate?: string;
    durationDays?: number;
    countries?: string;
    components?: string;
    specialRequests?: string;
  }
) {
  const lang = (order.language || 'ru') === 'en' ? 'en' : 'ru';
  const t = translations[lang];
  
  const orderTypeText = orderType === 'guideHire' ? t.guideHire 
    : orderType === 'transfer' ? t.transfer
    : orderType === 'customTour' ? t.customTour
    : t.otherService;
  
  const orderTypeIcon = orderType === 'guideHire' ? '🧑‍🏫' 
    : orderType === 'transfer' ? '🚗' 
    : orderType === 'customTour' ? '🗺️' 
    : '📦';
  
  const dateLocale = lang === 'en' ? 'en-US' : 'ru-RU';
  const formatDetailDate = (raw: string | undefined) => {
    if (!raw) return t.notSpecified;
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      return d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return raw; }
  };

  let detailsRows = '';
  
  if (orderType === 'guideHire' && detailsData) {
    detailsRows = `
      <tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase; width: 40%;">${t.guide}</td>
          <td style="padding: 10px 15px; color: #1f2937; font-weight: 600;">${detailsData.guideName || t.notSpecified}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${t.languages}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.guideLanguages || t.notSpecified}</td></tr>
      <tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${t.selectedDates}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.selectedDates || t.notSpecified}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${t.numberOfDays}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.numberOfDays || t.notSpecified}</td></tr>
      <tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${t.pricePerDay}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.pricePerDay ? detailsData.pricePerDay + ' TJS' : t.notSpecified}</td></tr>
    `;
  } else if (orderType === 'transfer' && detailsData) {
    detailsRows = `
      <tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase; width: 40%;">${t.from}</td>
          <td style="padding: 10px 15px; color: #1f2937; font-weight: 600;">${detailsData.pickupLocation || t.notSpecified}</td></tr>
      <tr style="background: #f9fafb;"><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${t.to}</td>
          <td style="padding: 10px 15px; color: #1f2937; font-weight: 600;">${detailsData.dropoffLocation || t.notSpecified}</td></tr>
      <tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${t.date}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.rentalDays && detailsData.rentalDays > 1 && detailsData.dropoffDate ? `${formatDetailDate(detailsData.date)} — ${formatDetailDate(detailsData.dropoffDate)}` : formatDetailDate(detailsData.date)}</td></tr>
      ${detailsData.rentalDays && detailsData.rentalDays > 1 ? `<tr style="background: #f9fafb;"><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Rental Days' : 'Дней аренды'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.rentalDays}</td></tr>` : ''}
      ${detailsData.pickupTime ? `<tr${detailsData.rentalDays && detailsData.rentalDays > 1 ? '' : ' style="background: #f9fafb;"'}><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Time' : 'Время'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.pickupTime}</td></tr>` : ''}
      ${detailsData.passengers ? `<tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Passengers' : 'Пассажиров'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.passengers}</td></tr>` : ''}
      ${detailsData.vehicleType ? `<tr style="background: #f9fafb;"><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Vehicle' : 'Транспорт'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.vehicleType}</td></tr>` : ''}
      ${detailsData.driverName ? `<tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Driver' : 'Водитель'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.driverName}</td></tr>` : ''}
      ${detailsData.rentalDays && detailsData.rentalDays > 1 ? `<tr style="background: #eff6ff;"><td style="padding: 10px 15px; color: #1e40af; font-size: 13px; text-transform: uppercase; font-weight: 600;">${lang === 'en' ? "Driver's daily expenses" : 'Суточные расходы водителя'}</td>
          <td style="padding: 10px 15px; color: #1e40af; font-weight: 600;">${Math.max(0, detailsData.rentalDays - 1) * 300} TJS <span style="font-weight: normal; color: #6b7280; font-size: 12px;">(${detailsData.rentalDays - 1} × 300 TJS)</span></td></tr>` : ''}
    `;
  } else if (orderType === 'customTour' && detailsData) {
    detailsRows = `
      ${detailsData.tourName ? `<tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase; width: 40%;">${lang === 'en' ? 'Tour' : 'Тур'}</td>
          <td style="padding: 10px 15px; color: #1f2937; font-weight: 600;">${detailsData.tourName}</td></tr>` : ''}
      ${detailsData.startDate ? `<tr style="background: #f9fafb;"><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Start Date' : 'Дата начала'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${formatDetailDate(detailsData.startDate)}</td></tr>` : ''}
      ${detailsData.durationDays ? `<tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Duration' : 'Продолжительность'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.durationDays} ${lang === 'en' ? 'days' : 'дней'}</td></tr>` : ''}
      ${detailsData.countries ? `<tr style="background: #f9fafb;"><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Countries' : 'Страны'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.countries}</td></tr>` : ''}
      ${detailsData.components ? `<tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Components' : 'Компоненты'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.components}</td></tr>` : ''}
      ${detailsData.specialRequests ? `<tr style="background: #f9fafb;"><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase;">${lang === 'en' ? 'Special Requests' : 'Пожелания'}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${detailsData.specialRequests}</td></tr>` : ''}
    `;
  } else {
    detailsRows = `
      <tr><td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase; width: 40%;">${t.service}</td>
          <td style="padding: 10px 15px; color: #1f2937;">${orderTypeText}</td></tr>
      <tr style="background: #f9fafb;"><td colspan="2" style="padding: 10px 15px; color: #6b7280; font-size: 13px;">${t.managerContact}</td></tr>
    `;
  }
  
  let logoBase64 = '';
  try {
    const path = require('path');
    const logoPath = path.join(process.cwd(), 'frontend', 'Logo-Ru_1754635713718.png');
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    }
  } catch (e) {
    console.warn('Failed to load logo for non-tour email:', e);
  }

  let logoAttachment: any = null;
  if (logoBase64) {
    const rawBase64 = logoBase64.replace(/^data:image\/png;base64,/, '');
    logoAttachment = {
      content: rawBase64,
      filename: 'logo.png',
      type: 'image/png',
      content_id: 'bunyod_logo',
      disposition: 'inline'
    };
  }
  
  const subject = `✅ ${t.paymentConfirmed} - ${orderTypeText} #${order.orderNumber}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
      </style>
    </head>
    <body>
      <div style="max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="background: #3E3E3E; color: white; padding: 20px 25px; text-align: center;">
          ${logoAttachment ? `<img src="cid:bunyod_logo" alt="Bunyod-Tour" style="width: 55px; height: 55px; border-radius: 50%; margin: 0 auto 10px; display: block;">` : ''}
          <h1 style="margin: 0; font-size: 24px; font-weight: bold;">BUNYOD-TOUR</h1>
          <p style="margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;">${t.companySubtitle}</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 25px; text-align: center;">
          <div style="font-size: 36px; margin-bottom: 8px;">${orderTypeIcon}</div>
          <h2 style="margin: 0; font-size: 22px;">✅ ${t.paymentConfirmed}</h2>
          <p style="margin: 8px 0 0 0; font-size: 15px; opacity: 0.95;">${orderTypeText}</p>
        </div>
        
        <div style="padding: 25px 30px;">
          <p style="font-size: 15px; color: #1f2937; margin-bottom: 20px;">${t.emailGreeting} <strong>${customer.fullName}</strong>,</p>
          <p style="font-size: 15px; color: #4b5563; margin-bottom: 20px;">${t.thankYouPayment}</p>
          
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
            <tr style="background: #f3f4f6;">
              <td style="padding: 10px 15px; color: #6b7280; font-size: 13px; text-transform: uppercase; width: 40%;">${t.orderNumber}</td>
              <td style="padding: 10px 15px; color: #1f2937; font-weight: bold; font-size: 16px;">${order.orderNumber}</td>
            </tr>
            ${detailsRows}
          </table>
          
          ${(() => {
            // 🆕 Блок суммы: для депозита 10% показываем полную/оплачено/остаток (как у туров)
            const paid = Number(order.totalAmount) || 0;
            const isDep = order.paymentOption === 'deposit';
            const isDep25 = order.paymentOption === 'deposit_25';
            const pct = isDep ? 10 : isDep25 ? 25 : 0;
            const fmt = (n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            if (pct > 0) {
              // Восстанавливаем полную стоимость: paid — это уже pct% от полной
              const full = Math.round((paid * 100 / pct) * 100) / 100;
              const remainder = Math.round((full - paid) * 100) / 100;
              const depositLabel = lang === 'en' ? `Deposit (${pct}%) — paid:` : `Депозит (${pct}%) — оплачено:`;
              const fullLabel = lang === 'en' ? 'Total:' : 'Полная стоимость:';
              const remainLabel = lang === 'en' ? `Remaining (${100 - pct}%) — pay before service:` : `Остаток (${100 - pct}%) — оплатить перед услугой:`;
              return `
                <div style="background: #f0fdf4; border: 2px solid #10b981; padding: 18px 20px; border-radius: 10px; text-align: center;">
                  <p style="margin: 0; color: #6b7280; font-size: 13px;">${fullLabel}</p>
                  <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 600; color: #374151;">${fmt(full)} TJS</p>
                  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #d1d5db;">
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">${depositLabel}</p>
                    <p style="margin: 4px 0 0 0; font-size: 26px; font-weight: bold; color: #059669;">${fmt(paid)} TJS</p>
                    <p style="margin: 4px 0 0 0; color: #10b981; font-size: 13px; font-weight: bold;">✅ ${lang === 'en' ? 'Paid' : 'Оплачено'}</p>
                  </div>
                  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">${remainLabel}</p>
                    <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 600; color: #d97706;">${fmt(remainder)} TJS</p>
                  </div>
                </div>
              `;
            }
            return `
              <div style="background: #f0fdf4; border: 2px solid #10b981; padding: 15px 20px; border-radius: 10px; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 13px;">${t.paidAmount}</p>
                <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #059669;">${fmt(paid)} TJS</p>
                <p style="margin: 5px 0 0 0; color: #10b981; font-size: 14px; font-weight: bold;">✅ ${lang === 'en' ? 'Paid' : 'Оплачено'}</p>
              </div>
            `;
          })()}
          
          <p style="margin-top: 20px; font-size: 14px; color: #6b7280; background: #eff6ff; padding: 12px 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            ${t.managerContact}
          </p>
        </div>
        
        <div style="background: #3E3E3E; color: white; padding: 20px; text-align: center;">
          <p style="margin: 5px 0; font-size: 14px;">${t.emailContacts}</p>
          <p style="margin: 5px 0; font-size: 14px;">📞 +992 44 625 7575 | +992 93-126-1134</p>
          <p style="margin: 5px 0; font-size: 14px;">✉️ booking@bunyodtour.tj | 🌐 bunyodtour.tj</p>
          <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.8;">© ${new Date().getFullYear()} ${t.footerCompany}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    const attachments = logoAttachment ? [logoAttachment] : undefined;
    await sendEmailWithSendGrid(customer.email, subject, html, attachments);
    console.log(`✅ Non-tour payment confirmation (${lang}) for ${orderType} sent to ${customer.email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending non-tour payment confirmation:', error);
    throw error;
  }
}

export async function sendTestEmail(to: string) {
  const subject = 'Test Email from Bunyod-Tour';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #3E3E3E 0%, #2a2a2a 100%); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BUNYOD-TOUR</h1>
          <p>Your reliable travel companion</p>
        </div>
        <div class="content">
          <h2>✅ Test Email / Тестовое письмо</h2>
          <p>This is a test email from Bunyod-Tour booking system.</p>
          <p>Это тестовое письмо от системы бронирования Bunyod-Tour.</p>
          <p><strong>Date / Дата:</strong> ${new Date().toISOString().split('T')[0]} ${new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} Bunyod-Tour LLC. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmailWithSendGrid(to, subject, html);
}

export async function sendGuideAssignmentNotification(
  guideEmail: string,
  guideName: string,
  tourTitle: string,
  tourId: number,
  scheduledStartDate?: Date,
  scheduledEndDate?: Date
) {
  const dateRange = scheduledStartDate && scheduledEndDate 
    ? `${scheduledStartDate.toLocaleDateString('ru-RU')} - ${scheduledEndDate.toLocaleDateString('ru-RU')}`
    : scheduledStartDate 
      ? scheduledStartDate.toLocaleDateString('ru-RU')
      : 'Дата будет уточнена';
  
  const subject = `Вам назначен новый тур: ${tourTitle}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #f5f5f5; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #3E3E3E 0%, #2a2a2a 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
        .banner { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
        .banner-icon { font-size: 48px; margin-bottom: 10px; }
        .banner-title { font-size: 24px; font-weight: bold; margin: 0; }
        .content { padding: 30px; }
        .greeting { font-size: 16px; color: #1f2937; margin-bottom: 20px; }
        .info-box { background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #6b7280; font-size: 14px; }
        .info-value { color: #1f2937; font-weight: 600; font-size: 14px; }
        .action-note { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 8px; margin-top: 20px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BUNYOD-TOUR</h1>
          <p>Система управления турами</p>
        </div>
        
        <div class="banner">
          <div class="banner-icon">🎯</div>
          <h2 class="banner-title">Вам назначен новый тур!</h2>
        </div>
        
        <div class="content">
          <p class="greeting">Здравствуйте, <strong>${guideName}</strong>!</p>
          <p>Администрация Bunyod-Tour назначила вас гидом на следующий тур:</p>
          
          <div class="info-box">
            <div class="info-row">
              <span class="info-label">Название тура:</span>
              <span class="info-value">${tourTitle}</span>
            </div>
            <div class="info-row">
              <span class="info-label">ID тура:</span>
              <span class="info-value">#${tourId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Даты проведения:</span>
              <span class="info-value">${dateRange}</span>
            </div>
          </div>
          
          <div class="action-note">
            <strong>📋 Что делать дальше?</strong><br>
            Войдите в личный кабинет для просмотра деталей тура и подготовки к его проведению.
          </div>
        </div>
        
        <div class="footer">
          <p>При возникновении вопросов свяжитесь с администрацией:</p>
          <p>📞 +992 44 625 7575 | ✉️ booking@bunyodtour.tj</p>
          <p>© ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    await sendEmailWithSendGrid(guideEmail, subject, html);
    console.log(`✅ Tour assignment notification sent to guide ${guideName} (${guideEmail})`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send tour assignment notification to ${guideEmail}:`, error);
    throw error;
  }
}

export async function sendGuideBookingAssignmentNotification(
  guideEmail: string,
  guideName: string,
  tourTitle: string,
  bookingId: number,
  tourDate: string,
  touristCount: number,
  touristNames: string[],
  contactName: string,
  contactPhone: string,
  contactEmail: string
) {
  const subject = `Новое бронирование: ${tourTitle} — ${tourDate}`;
  
  const touristList = touristNames.length > 0 
    ? touristNames.map((name, i) => `${i + 1}. ${name}`).join('<br>')
    : `${touristCount} турист(ов)`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #f5f5f5; margin: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #3E3E3E 0%, #2a2a2a 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
        .banner { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
        .banner-icon { font-size: 48px; margin-bottom: 10px; }
        .banner-title { font-size: 22px; font-weight: bold; margin: 0; }
        .banner-subtitle { font-size: 16px; margin-top: 8px; opacity: 0.9; }
        .content { padding: 30px; }
        .greeting { font-size: 16px; color: #1f2937; margin-bottom: 20px; }
        .section-title { font-size: 14px; font-weight: 600; color: #374151; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-box { background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 15px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #6b7280; font-size: 14px; }
        .info-value { color: #1f2937; font-weight: 600; font-size: 14px; text-align: right; }
        .tourists-box { background: #fef3c7; border-radius: 12px; padding: 20px; margin: 15px 0; }
        .tourists-list { color: #92400e; font-size: 14px; line-height: 1.8; }
        .contact-box { background: #dbeafe; border-radius: 12px; padding: 20px; margin: 15px 0; }
        .contact-info { color: #1e40af; font-size: 14px; line-height: 1.6; }
        .action-note { background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; border-radius: 8px; margin-top: 20px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>BUNYOD-TOUR</h1>
          <p>Система управления турами</p>
        </div>
        
        <div class="banner">
          <div class="banner-icon">📋</div>
          <h2 class="banner-title">Вам назначено бронирование!</h2>
          <p class="banner-subtitle">Бронирование #${bookingId}</p>
        </div>
        
        <div class="content">
          <p class="greeting">Здравствуйте, <strong>${guideName}</strong>!</p>
          <p>Вам назначено новое бронирование. Пожалуйста, ознакомьтесь с деталями:</p>
          
          <div class="section-title">📍 Информация о туре</div>
          <div class="info-box">
            <div class="info-row">
              <span class="info-label">Название тура:</span>
              <span class="info-value">${tourTitle}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Дата проведения:</span>
              <span class="info-value">${tourDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Количество туристов:</span>
              <span class="info-value">${touristCount}</span>
            </div>
          </div>
          
          <div class="section-title">👥 Туристы</div>
          <div class="tourists-box">
            <div class="tourists-list">${touristList}</div>
          </div>
          
          <div class="section-title">📞 Контактное лицо</div>
          <div class="contact-box">
            <div class="contact-info">
              <strong>${contactName || 'Не указано'}</strong><br>
              ${contactPhone ? `📱 ${contactPhone}<br>` : ''}
              ${contactEmail ? `✉️ ${contactEmail}` : ''}
            </div>
          </div>
          
          <div class="action-note">
            <strong>✅ Что делать дальше?</strong><br>
            1. Войдите в личный кабинет для просмотра полных деталей<br>
            2. Когда начнёте тур — измените статус на "В процессе"<br>
            3. После завершения — отметьте тур как "Завершён"
          </div>
        </div>
        
        <div class="footer">
          <p>При возникновении вопросов свяжитесь с администрацией:</p>
          <p>📞 +992 44 625 7575 | ✉️ booking@bunyodtour.tj</p>
          <p>© ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    await sendEmailWithSendGrid(guideEmail, subject, html);
    console.log(`✅ Booking assignment notification sent to guide ${guideName} (${guideEmail})`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send booking assignment notification to ${guideEmail}:`, error);
    throw error;
  }
}
