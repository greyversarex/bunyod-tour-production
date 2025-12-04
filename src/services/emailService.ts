import sgMail from '@sendgrid/mail';
import { Order, Customer, Tour } from '@prisma/client';
import puppeteer from 'puppeteer';

let connectionSettings: any;

async function getCredentials(): Promise<{apiKey: string, email: string}> {
  // 1. Сначала проверяем переменные окружения (для production)
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
    console.log('📧 Using SendGrid from environment variables');
    return {
      apiKey: process.env.SENDGRID_API_KEY,
      email: process.env.SENDGRID_FROM_EMAIL
    };
  }

  // 2. Затем пробуем Replit интеграцию (для development)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (hostname && xReplitToken) {
    try {
      connectionSettings = await fetch(
        'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
        {
          headers: {
            'Accept': 'application/json',
            'X_REPLIT_TOKEN': xReplitToken
          }
        }
      ).then(res => res.json()).then(data => data.items?.[0]);

      if (connectionSettings?.settings?.api_key && connectionSettings?.settings?.from_email) {
        console.log('📧 Using SendGrid from Replit integration');
        return {
          apiKey: connectionSettings.settings.api_key,
          email: connectionSettings.settings.from_email
        };
      }
    } catch (error) {
      console.warn('⚠️ Replit SendGrid integration not available:', error);
    }
  }

  throw new Error('SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in .env');
}

async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

function generateInlineTicketHTML(order: any, customer: Customer): string {
  const tourists = JSON.parse(order.tourists || '[]');
  const tourTitle = order.tour?.title?.ru || order.tour?.title?.en || 'Тур';
  const hotelName = order.hotel?.name?.ru || order.hotel?.name?.en || 'Не выбран';
  const tourDuration = order.tour?.durationDays || parseInt(order.tour?.duration) || 1;
  const tourType = order.tour?.tourType || order.tour?.format || 'Персональный';
  const bookingRef = `BT-${order.id}${new Date().getFullYear()}`;
  const submissionTime = new Date(order.createdAt || Date.now());
  const tourDate = order.tourDate ? new Date(order.tourDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Не указана';
  
  let services: any[] = [];
  try {
    if (order.tour?.services) {
      services = typeof order.tour.services === 'string' ? 
        JSON.parse(order.tour.services) : order.tour.services;
    }
  } catch (e) {
    console.warn('Error parsing tour services:', e);
  }

  const touristsHTML = tourists.length > 0 
    ? tourists.map((t: any, i: number) => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px; text-align: center; color: white; background: #6b7280; width: 30px; border-radius: 4px;">${i + 1}</td>
          <td style="padding: 10px;">${t.fullName || t.name || 'Турист ' + (i + 1)}</td>
          <td style="padding: 10px; color: #6b7280;">${t.passportNumber || '-'}</td>
        </tr>
      `).join('')
    : `<tr><td style="padding: 10px;" colspan="3">Турист: ${customer.fullName}</td></tr>`;

  const servicesHTML = services.length > 0 
    ? services.map((s: any) => {
        const serviceName = typeof s === 'string' ? s : (s.name?.ru || s.name?.en || s.name || 'Услуга');
        return `<li style="padding: 5px 0; color: #4b5563;">✓ ${serviceName}</li>`;
      }).join('')
    : '<li style="padding: 5px 0; color: #6b7280;">Стандартный пакет услуг</li>';

  return `
    <div style="max-width: 650px; margin: 30px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border: 2px solid #3E3E3E;">
      <!-- Заголовок билета -->
      <div style="background: #3E3E3E; color: white; padding: 25px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🎫 БИЛЕТ ТУРА</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">BUNYOD-TOUR | Ваш надежный спутник в путешествиях</p>
      </div>
      
      <!-- Статус оплаты -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px; text-align: center;">
        <span style="font-size: 18px; font-weight: bold;">✅ ОПЛАЧЕНО</span>
      </div>
      
      <!-- Информация о туре -->
      <div style="padding: 25px;">
        <h2 style="margin: 0 0 15px 0; font-size: 22px; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
          ${tourTitle}
        </h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr>
            <td style="padding: 10px 0; width: 50%; vertical-align: top;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Номер заказа</p>
              <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #1f2937;">${order.orderNumber}</p>
            </td>
            <td style="padding: 10px 0; width: 50%; vertical-align: top;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Референс</p>
              <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #1f2937;">${bookingRef}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; vertical-align: top;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Дата тура</p>
              <p style="margin: 5px 0 0 0; font-size: 16px; color: #1f2937;">${tourDate}</p>
            </td>
            <td style="padding: 10px 0; vertical-align: top;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Продолжительность</p>
              <p style="margin: 5px 0 0 0; font-size: 16px; color: #1f2937;">${tourDuration} ${tourDuration === 1 ? 'день' : tourDuration < 5 ? 'дня' : 'дней'}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; vertical-align: top;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Тип тура</p>
              <p style="margin: 5px 0 0 0; font-size: 16px; color: #1f2937;">${tourType}</p>
            </td>
            <td style="padding: 10px 0; vertical-align: top;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Отель</p>
              <p style="margin: 5px 0 0 0; font-size: 16px; color: #1f2937;">${hotelName}</p>
            </td>
          </tr>
        </table>
        
        <!-- Туристы -->
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #1f2937; text-transform: uppercase;">👥 Туристы</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #e5e7eb;">
                <th style="padding: 8px; text-align: center; width: 30px;">#</th>
                <th style="padding: 8px; text-align: left;">ФИО</th>
                <th style="padding: 8px; text-align: left;">Паспорт</th>
              </tr>
            </thead>
            <tbody>
              ${touristsHTML}
            </tbody>
          </table>
        </div>
        
        <!-- Услуги -->
        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #1f2937; text-transform: uppercase;">📦 Включённые услуги</h3>
          <ul style="margin: 0; padding-left: 20px; list-style: none;">
            ${servicesHTML}
          </ul>
        </div>
        
        <!-- Итого -->
        <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">ИТОГО К ОПЛАТЕ</p>
          <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">${order.totalAmount} ${order.currency || 'TJS'}</p>
          <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.8;">Оплачено: ${submissionTime.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
      
      <!-- Контактная информация -->
      <div style="background: #f3f4f6; padding: 20px; text-align: center; border-top: 2px dashed #d1d5db;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #4b5563;">
          <strong>Важно:</strong> Предъявите этот билет гиду в день тура
        </p>
        <p style="margin: 0; font-size: 13px; color: #6b7280;">
          📞 +992 44 625 7575 | +992 93-126-1134<br>
          📧 booking@bunyodtour.tj | 🌐 bunyodtour.tj
        </p>
      </div>
    </div>
  `;
}

async function generateTicketPDF(order: any, customer: Customer): Promise<Buffer> {
  const tourists = JSON.parse(order.tourists || '[]');
  const tourTitle = order.tour?.title?.ru || order.tour?.title?.en || 'Tour';
  const hotelName = order.hotel?.name?.ru || order.hotel?.name?.en || 'Не выбран';
  const tourDuration = order.tour?.durationDays || parseInt(order.tour?.duration) || 1;
  const tourType = order.tour?.tourType || order.tour?.format || 'Персональный';
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
          <img src="https://bunyodtour.tj/Logo-Ru_1754635713718.png" alt="Bunyod-Tour" style="width: 70px; height: 70px; border-radius: 50%; margin-bottom: 15px;" onerror="this.style.display='none'">
          <div class="company-name">BUNYOD-TOUR</div>
          <div class="company-subtitle">Ваш надежный спутник в мире путешествий по Центральной Азии</div>
        </div>
        
        <div class="voucher-content">
          <div class="voucher-header">
            <div class="date">📅 ${new Date(order.tourDate).toLocaleDateString('ru-RU')}</div>
            <div class="status-badge">ПОДТВЕРЖДЕН</div>
          </div>
          
          <div class="tour-title">${tourTitle}</div>
          <div class="tour-subtitle">${tourType} - ${tourDuration} ${tourDuration > 1 ? 'дней' : 'день'}</div>
          
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
                  ${services.map((service: any) => `
                    <div class="service-item">${service.name}</div>
                  `).join('')}
                  ${hotelName !== 'Не выбран' ? '<div class="service-item">Проживание в отеле</div>' : ''}
                </div>
              </div>
            </div>
            
            <div>
              <div class="section">
                <div class="section-title">${bookingRef}</div>
                <div class="section-value">Подтверждено ${submissionTime.toLocaleDateString('ru-RU')} ${submissionTime.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})} GMT+5</div>
              </div>
              
              ${customer.phone ? `
                <div class="section">
                  <div class="section-title">Номер телефона клиента:</div>
                  <div class="section-value">${customer.phone}</div>
                </div>
              ` : ''}
              
              <div class="section">
                <div class="section-title">Место сбора:</div>
                <div class="section-value">${order.tour?.pickupInfo || 'Рудаки парк'}</div>
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
          
          ${hotelName !== 'Не выбран' ? `
            <div class="section">
              <div class="section-title">Отель:</div>
              <div class="section-value">${hotelName}</div>
            </div>
          ` : ''}
          
          ${order.wishes ? `
            <div class="section">
              <div class="section-title">Особые требования:</div>
              <div class="section-value">${order.wishes}</div>
            </div>
          ` : ''}
          
          <div class="amount-box">
            <div class="amount-label">Итоговая сумма:</div>
            <div class="amount-value">${Math.round(order.totalAmount).toLocaleString()} TJS</div>
            <div class="amount-usd">≈ ${Math.round(order.totalAmount * 0.091)} USD</div>
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
  
  const browser = await puppeteer.launch({
    executablePath: '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium-browser',
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
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
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
  bookingConfirmation: (order: any, customer: Customer, tour: any) => ({
    subject: `Подтверждение бронирования №${order.orderNumber}`,
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
            <img src="https://bunyodtour.tj/Logo-Ru_1754635713718.png" alt="Bunyod-Tour" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" onerror="this.style.display='none'">
            <h1 class="company-name">BUNYOD-TOUR</h1>
            <p class="company-subtitle">Ваш надежный спутник в мире путешествий по Центральной Азии</p>
          </div>
          <div class="voucher-header">
            <h1>Спасибо за ваш заказ!</h1>
            <p>Ваше бронирование успешно подтверждено</p>
          </div>
          
          <div class="content">
            <p>Уважаемый(ая) ${customer.fullName},</p>
            <p>Мы рады подтвердить ваше бронирование тура. Ниже вы найдете детали вашего заказа:</p>
            
            <div class="order-details">
              <h3>Детали заказа</h3>
              <div class="detail-row">
                <span><strong>Номер заказа:</strong></span>
                <span>${order.orderNumber}</span>
              </div>
              <div class="detail-row">
                <span><strong>Тур:</strong></span>
                <span>${tour.title?.ru || tour.title?.en || 'Tour'}</span>
              </div>
              <div class="detail-row">
                <span><strong>Дата тура:</strong></span>
                <span>${new Date(order.tourDate).toLocaleDateString('ru-RU')}</span>
              </div>
              <div class="detail-row">
                <span><strong>Количество туристов:</strong></span>
                <span>${JSON.parse(order.tourists || '[]').length}</span>
              </div>
              <div class="detail-row">
                <span><strong>Общая сумма:</strong></span>
                <span style="font-size: 20px; color: #667eea;"><strong>$${order.totalAmount}</strong></span>
              </div>
            </div>
            
            <h3>Список туристов</h3>
            <ol>
              ${JSON.parse(order.tourists || '[]').map((t: any) => `
                <li>${t.fullName} (${t.birthDate})</li>
              `).join('')}
            </ol>
            
            ${order.hotel ? `
              <h3>Отель</h3>
              <p>${order.hotel.name?.ru || order.hotel.name?.en || 'Hotel'}</p>
            ` : ''}
            
            ${order.guide ? `
              <h3>Гид</h3>
              <p>${order.guide.name?.ru || order.guide.name?.en || 'Guide'}</p>
            ` : ''}
            
            <div class="footer">
              <p><strong>Контакты для связи:</strong></p>
              <p>📞 +992 93 126 1134 | ✉️ booking@bunyodtour.tj</p>
              <p>© 2025 Bunyod-Tour. Все права защищены.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }),
  
  bookingCancellation: (order: any, customer: Customer) => ({
    subject: `Отмена бронирования №${order.orderNumber}`,
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
            <img src="https://bunyodtour.tj/Logo-Ru_1754635713718.png" alt="Bunyod-Tour" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" onerror="this.style.display='none'">
            <h1 class="company-name">BUNYOD-TOUR</h1>
            <p class="company-subtitle">Ваш надежный спутник в мире путешествий по Центральной Азии</p>
          </div>
          <div class="header">
            <h1>Бронирование отменено</h1>
          </div>
          <div class="content">
            <p>Уважаемый(ая) ${customer.fullName},</p>
            <p>Ваше бронирование №${order.orderNumber} было отменено.</p>
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              Если у вас есть вопросы, свяжитесь с нами:<br>
              📧 Email: booking@bunyodtour.tj<br>
              📞 Телефоны: +992 44 625 7575; +992 93-126-1134<br>
              📞 +992 00-110-0087; +992 88-235-3434<br>
              🌐 Сайт: bunyodtour.tj
            </p>
            <p>С уважением,<br>Команда Bunyod-Tour</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),
  
  paymentConfirmation: (order: any, customer: Customer) => {
    const tourTitle = order.tour?.title?.ru || order.tour?.title?.en || 'Tour';
    const paymentDate = new Date(order.updatedAt || order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    
    return {
      subject: `Подтверждение оплаты №${order.orderNumber} - ${tourTitle}`,
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
            <img src="https://bunyodtour.tj/Logo-Ru_1754635713718.png" alt="Bunyod-Tour" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" onerror="this.style.display='none'">
            <h1 class="company-name">BUNYOD-TOUR</h1>
            <p class="company-subtitle">Ваш надежный спутник в мире путешествий по Центральной Азии</p>
          </div>
          
          <div class="greeting-section">
            <p class="greeting-text">Уважаемый(ая) <strong>${customer.fullName}</strong>,</p>
            <p class="greeting-text">
              Администрация ООО «Бунёд-Тур» подтверждает вашу заявку (договор) <strong>№${order.orderNumber}</strong>, от <strong>${paymentDate}</strong>, на тур в рамках программы <strong>«${tourTitle}»</strong>. 
              Подробно со всеми деталями вашего заказа вы можете ознакомиться в билете тура.
            </p>
            <p class="greeting-text" style="background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              📎 <strong>Билет тура прикреплён к письму в формате PDF</strong>
            </p>
          </div>
          
          <div class="voucher-section">
            <div class="contact-section">
              <h3 style="margin-top: 0; color: #1f2937;">Контактная информация</h3>
              <div style="text-align: left; max-width: 500px; margin: 0 auto; font-size: 14px; line-height: 1.8;">
                <p style="margin: 5px 0;">☎️ +992 44 625 7575; +992 93-126-1134</p>
                <p style="margin: 5px 0;">☎️ +992 00-110-0087; +992 88-235-3434</p>
                <p style="margin: 5px 0;">💌 booking@bunyodtour.tj</p>
                <p style="margin: 5px 0;">🌐 <a href="https://bunyodtour.tj" style="color: #667eea; text-decoration: none;">bunyodtour.tj</a></p>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p style="margin: 10px 0; font-size: 15px;"><strong>С уважением,</strong></p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Администрация ООО «Бунёд-Тур»</strong></p>
            <p style="margin: 15px 0 5px 0; font-size: 13px; color: #6b7280;">734042, Таджикистан, г. Душанбе, ул. Айни 104</p>
            <p style="margin-top: 15px; font-size: 12px; line-height: 1.6; color: #9ca3af;">
              <strong>Важная информация:</strong><br>
              • Пожалуйста, сохраните этот билет и предъявите его гиду в день тура<br>
              • Прибудьте на место встречи за 15 минут до начала тура<br>
              • При возникновении вопросов свяжитесь с нами по телефону или email
            </p>
            <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">© ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.</p>
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
      const { client, fromEmail } = await getUncachableSendGridClient();
      const template = emailTemplates.bookingConfirmation(order, customer, tour);
      
      await client.send({
        to: customer.email,
        from: fromEmail,
        subject: template.subject,
        html: template.html
      });
      
      console.log(`✅ Booking confirmation email sent to ${customer.email} via SendGrid`);
      return true;
    } catch (error) {
      console.error('❌ Error sending booking confirmation email:', error);
      return false;
    }
  },
  
  async sendCancellationEmail(order: any, customer: Customer): Promise<boolean> {
    try {
      const { client, fromEmail } = await getUncachableSendGridClient();
      const template = emailTemplates.bookingCancellation(order, customer);
      
      await client.send({
        to: customer.email,
        from: fromEmail,
        subject: template.subject,
        html: template.html
      });
      
      console.log(`✅ Cancellation email sent to ${customer.email} via SendGrid`);
      return true;
    } catch (error) {
      console.error('❌ Error sending cancellation email:', error);
      return false;
    }
  },
  
  async sendPaymentConfirmation(order: any, customer: Customer): Promise<boolean> {
    try {
      const { client, fromEmail } = await getUncachableSendGridClient();
      const tourTitle = order.tour?.title?.ru || order.tour?.title?.en || 'Tour';
      const paymentDate = new Date(order.updatedAt || order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      
      // Попытка сгенерировать PDF билет
      let pdfBuffer: Buffer | null = null;
      let useInlineTicket = false;
      
      try {
        console.log('📄 Generating PDF ticket...');
        pdfBuffer = await generateTicketPDF(order, customer);
        console.log('📄 PDF ticket generated successfully');
      } catch (pdfError) {
        console.error('⚠️ PDF generation failed, will embed HTML ticket in email body:', pdfError);
        useInlineTicket = true;
      }
      
      // Генерируем HTML письма с или без встроенного билета
      let emailHTML: string;
      
      if (pdfBuffer) {
        // PDF успешно сгенерирован - используем стандартный шаблон с упоминанием PDF
        emailHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.8; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
              .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
              .company-header { background: linear-gradient(135deg, #3E3E3E 0%, #2a2a2a 100%); color: white; padding: 25px; text-align: center; }
              .company-name { font-size: 32px; font-weight: bold; margin: 0; }
              .company-subtitle { font-size: 14px; margin: 8px 0 0 0; opacity: 0.95; }
              .greeting-section { background: #fff; padding: 30px; }
              .footer { text-align: center; padding: 25px; background: #f9fafb; color: #6b7280; font-size: 13px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="company-header">
                <img src="https://bunyodtour.tj/Logo-Ru_1754635713718.png" alt="Bunyod-Tour" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" onerror="this.style.display='none'">
            <h1 class="company-name">BUNYOD-TOUR</h1>
                <p class="company-subtitle">Ваш надежный спутник в мире путешествий по Центральной Азии</p>
              </div>
              
              <div class="greeting-section">
                <p>Уважаемый(ая) <strong>${customer.fullName}</strong>,</p>
                <p>Администрация ООО «Бунёд-Тур» подтверждает вашу заявку (договор) <strong>№${order.orderNumber}</strong>, от <strong>${paymentDate}</strong>, на тур в рамках программы <strong>«${tourTitle}»</strong>.</p>
                <p style="background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                  📎 <strong>Билет тура прикреплён к письму в формате PDF</strong>
                </p>
                <p style="margin-top: 20px;">
                  📞 +992 44 625 7575 | +992 93-126-1134<br>
                  📧 booking@bunyodtour.tj | 🌐 bunyodtour.tj
                </p>
              </div>
              
              <div class="footer">
                <p><strong>С уважением, Администрация ООО «Бунёд-Тур»</strong></p>
                <p>734042, Таджикистан, г. Душанбе, ул. Айни 104</p>
                <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">© ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.</p>
              </div>
            </div>
          </body>
          </html>
        `;
      } else {
        // PDF не сгенерирован - встраиваем HTML билет прямо в письмо
        const inlineTicket = generateInlineTicketHTML(order, customer);
        
        emailHTML = `
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
                <img src="https://bunyodtour.tj/Logo-Ru_1754635713718.png" alt="Bunyod-Tour" style="width: 60px; height: 60px; border-radius: 50%; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" onerror="this.style.display='none'">
            <h1 class="company-name">BUNYOD-TOUR</h1>
                <p class="company-subtitle">Ваш надежный спутник в мире путешествий по Центральной Азии</p>
              </div>
              
              <div class="greeting-section">
                <p>Уважаемый(ая) <strong>${customer.fullName}</strong>,</p>
                <p>Администрация ООО «Бунёд-Тур» подтверждает вашу заявку (договор) <strong>№${order.orderNumber}</strong>, от <strong>${paymentDate}</strong>, на тур в рамках программы <strong>«${tourTitle}»</strong>.</p>
                <p>Подробности вашего тура представлены ниже:</p>
              </div>
              
              <!-- Встроенный билет -->
              ${inlineTicket}
              
              <div class="footer">
                <p><strong>С уважением, Администрация ООО «Бунёд-Тур»</strong></p>
                <p>734042, Таджикистан, г. Душанбе, ул. Айни 104</p>
                <p style="margin-top: 10px; font-size: 12px; line-height: 1.6; color: #9ca3af;">
                  <strong>Важная информация:</strong><br>
                  • Пожалуйста, сохраните это письмо и предъявите его гиду в день тура<br>
                  • Прибудьте на место встречи за 15 минут до начала тура
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">© ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        console.log('📧 Using inline HTML ticket in email body');
      }
      
      const emailData: any = {
        to: customer.email,
        from: fromEmail,
        subject: `Подтверждение оплаты №${order.orderNumber} - ${tourTitle}`,
        html: emailHTML
      };
      
      // Добавляем PDF только если он успешно сгенерирован
      if (pdfBuffer) {
        const filename = `Ticket-${order.orderNumber}-${tourTitle.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}.pdf`;
        emailData.attachments = [
          {
            content: pdfBuffer.toString('base64'),
            filename: filename,
            type: 'application/pdf',
            disposition: 'attachment'
          }
        ];
        console.log('📎 PDF attached to email');
      }
      
      await client.send(emailData);
      
      const ticketStatus = pdfBuffer ? 'with PDF attachment' : 'with inline HTML ticket';
      console.log(`✅ Payment confirmation email ${ticketStatus} sent to ${customer.email} via SendGrid`);
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
      const { client, fromEmail } = await getUncachableSendGridClient();
      const adminEmail = process.env.ADMIN_EMAIL || 'booking@bunyodtour.tj';
      const template = emailTemplates.adminNotification(order, customer, tour);
      
      await client.send({
        to: adminEmail,
        from: fromEmail,
        subject: template.subject,
        html: template.html
      });
      
      console.log(`✅ Admin notification email sent to ${adminEmail} via SendGrid`);
      return true;
    } catch (error) {
      console.error('❌ Error sending admin notification email:', error);
      return false;
    }
  },
  
  async testEmailConfiguration(): Promise<boolean> {
    try {
      await getUncachableSendGridClient();
      console.log('✅ SendGrid is ready to send messages');
      return true;
    } catch (error) {
      console.error('❌ SendGrid configuration error:', error);
      return false;
    }
  },

  async sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
    try {
      console.log(`📧 Attempting to send email to: ${options.to}`);
      console.log(`📧 Subject: ${options.subject}`);
      
      const { client, fromEmail } = await getUncachableSendGridClient();
      console.log(`📧 Using SendGrid from: ${fromEmail}`);
      
      await client.send({
        to: options.to,
        from: fromEmail,
        subject: options.subject,
        html: options.html
      });
      console.log(`✅ Email successfully sent to ${options.to} via SendGrid`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${options.to}`);
      console.error('❌ Email error:', error);
      if (error instanceof Error) {
        console.error('❌ Error stack:', error.stack);
      }
      throw error; // Re-throw to let caller handle it
    }
  }
};

export async function sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
  try {
    console.log(`📧 [Standalone] Attempting to send email to: ${options.to}`);
    const { client, fromEmail } = await getUncachableSendGridClient();
    await client.send({
      to: options.to,
      from: fromEmail,
      subject: options.subject,
      html: options.html
    });
    console.log(`✅ [Standalone] Email sent to ${options.to} via SendGrid`);
  } catch (error) {
    console.error(`❌ [Standalone] Failed to send email to ${options.to}:`, error);
    throw error;
  }
}

export default emailService;
