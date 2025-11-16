import sgMail from '@sendgrid/mail';
import { Order, Customer } from '@prisma/client';
import puppeteer from 'puppeteer';

// SendGrid client setup using Replit integration
let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

// PDF Generation Function (same as original emailService.ts)
async function generateTicketPDF(order: any, customer: Customer): Promise<Buffer> {
  const tourists = JSON.parse(order.tourists || '[]');
  const tourTitle = order.tour?.title?.ru || order.tour?.title?.en || 'Tour';
  const hotelName = order.hotel?.name?.ru || order.hotel?.name?.en || 'Не выбран';
  const tourDuration = order.tour?.durationDays || parseInt(order.tour?.duration) || 1;
  const tourType = order.tour?.tourType || order.tour?.format || 'Персональный';
  const bookingRef = `BT-${order.id}${new Date().getFullYear()}`;
  const submissionTime = new Date(order.createdAt || Date.now());
  
  // Parse tour services
  let services = [];
  try {
    if (order.tour?.services) {
      services = typeof order.tour.services === 'string' ? 
        JSON.parse(order.tour.services) : order.tour.services;
    }
  } catch (e) {
    console.warn('Error parsing tour services:', e);
  }
  
  // Create HTML for PDF (matching booking-step3.html voucher design)
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
        <!-- Company Header -->
        <div class="company-header">
          <div class="company-name">BUNYOD-TOUR</div>
          <div class="company-subtitle">Ваш надежный спутник в мире путешествий по Центральной Азии</div>
        </div>
        
        <div class="voucher-content">
          <!-- Header with Date and Status -->
          <div class="voucher-header">
            <div class="date">📅 ${new Date(order.tourDate).toLocaleDateString('ru-RU')}</div>
            <div class="status-badge">ПОДТВЕРЖДЕН</div>
          </div>
          
          <!-- Tour Title -->
          <div class="tour-title">${tourTitle}</div>
          <div class="tour-subtitle">${tourType} - ${tourDuration} ${tourDuration > 1 ? 'дней' : 'день'}</div>
          
          <!-- Two Column Layout -->
          <div class="two-column">
            <!-- Left Column -->
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
            
            <!-- Right Column -->
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
          
          <!-- Total Amount -->
          <div class="amount-box">
            <div class="amount-label">Итоговая сумма:</div>
            <div class="amount-value">${Math.round(order.totalAmount).toLocaleString()} TJS</div>
            <div class="amount-usd">≈ ${Math.round(order.totalAmount * 0.091)} USD</div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          © ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.<br>
          734042, Таджикистан, г. Душанбе, ул. Айни 104
        </div>
      </div>
    </body>
    </html>
  `;
  
  // Generate PDF using Puppeteer with system Chromium
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

// Send email with SendGrid
export async function sendEmailWithSendGrid(
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{content: string; filename: string; type: string}>
) {
  try {
    const {client, fromEmail} = await getUncachableSendGridClient();
    
    const msg: any = {
      to,
      from: fromEmail,
      subject,
      html
    };
    
    if (attachments && attachments.length > 0) {
      msg.attachments = attachments;
    }
    
    await client.send(msg);
    console.log(`✅ Email sent successfully to ${to} via SendGrid`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ SendGrid email error:', error);
    if (error.response) {
      console.error('SendGrid error response:', error.response.body);
    }
    throw error;
  }
}

// Send booking confirmation with PDF ticket
export async function sendBookingConfirmation(order: any, customer: Customer, tour: any) {
  try {
    console.log(`📧 Generating ticket PDF for order ${order.orderNumber}...`);
    const pdfBuffer = await generateTicketPDF(order, customer);
    
    const subject = `Подтверждение бронирования №${order.orderNumber}`;
    const tourTitle = tour.title?.ru || tour.title?.en || 'Tour';
    const paymentDate = new Date(order.updatedAt || order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const html = `
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
          .contact-section { background: #f3f4f6; padding: 20px; text-align: center; margin-top: 30px; border-radius: 8px; }
          .footer { text-align: center; padding: 25px; background: #f9fafb; color: #6b7280; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="company-header">
            <h1 class="company-name">BUNYOD-TOUR</h1>
            <p class="company-subtitle">Ваш надежный спутник в мире путешествий по Центральной Азии</p>
          </div>
          
          <div class="success-banner">
            <div class="success-icon">✅</div>
            <h1 class="success-title">Бронирование подтверждено!</h1>
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
          
          <div class="contact-section">
            <p><strong>Контакты для связи:</strong></p>
            <p>📞 +992 123 456 789 | ✉️ booking@bunyodtour.tj</p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.</p>
            <p>734042, Таджикистан, г. Душанбе, ул. Айни 104</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmailWithSendGrid(
      customer.email,
      subject,
      html,
      [{
        content: pdfBuffer.toString('base64'),
        filename: `bunyod-tour-ticket-${order.orderNumber}.pdf`,
        type: 'application/pdf'
      }]
    );
    
    console.log(`✅ Booking confirmation sent to ${customer.email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending booking confirmation:', error);
    throw error;
  }
}

// Send agent welcome email with credentials (B2B Partnership)
export async function sendAgentWelcomeEmail(email: string, data: {
  fullName: string;
  uniqueId: string;
  email: string;
  password: string;
  loginUrl: string;
}) {
  try {
    const subject = `Доступ к партнерской программе Bunyod-Tour - ID: ${data.uniqueId}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.8; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 650px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #3E3E3E 0%, #2a2a2a 100%); color: white; padding: 30px; text-align: center; }
          .company-name { font-size: 32px; font-weight: bold; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
          .company-subtitle { font-size: 14px; margin: 8px 0 0 0; opacity: 0.95; }
          .content { padding: 40px; }
          .success-banner { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; margin: -40px -40px 30px -40px; }
          .success-icon { font-size: 48px; margin-bottom: 10px; }
          .success-title { font-size: 24px; font-weight: bold; margin: 0; }
          .credentials-box { background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; padding: 25px; margin: 25px 0; }
          .credential-item { margin: 15px 0; }
          .credential-label { color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
          .credential-value { background: white; padding: 12px 15px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 16px; color: #1f2937; border: 1px solid #d1d5db; word-break: break-all; }
          .login-button { display: inline-block; background: #3E3E3E; color: white !important; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
          .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { background: #f9fafb; padding: 25px; text-align: center; color: #6b7280; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="company-name">BUNYOD-TOUR</h1>
            <p class="company-subtitle">B2B Партнерская программа</p>
          </div>
          
          <div class="success-banner">
            <div class="success-icon">🎉</div>
            <h1 class="success-title">Заявка одобрена!</h1>
            <p>Добро пожаловать в партнерскую сеть Bunyod-Tour</p>
          </div>
          
          <div class="content">
            <p>Уважаемый(ая) <strong>${data.fullName}</strong>,</p>
            <p>Поздравляем! Ваша заявка на партнерство была одобрена.</p>
            <p>Для вас создан личный кабинет турагента, где вы можете:</p>
            <ul style="margin: 15px 0; padding-left: 25px;">
              <li>Подавать заявки на туры для ваших клиентов</li>
              <li>Отслеживать статус заявок</li>
              <li>Просматривать историю реализованных туров</li>
              <li>Получать комиссионные за каждое бронирование</li>
            </ul>
            
            <div class="credentials-box">
              <h3 style="margin: 0 0 20px 0; color: #1f2937;">Данные для входа в систему:</h3>
              
              <div class="credential-item">
                <div class="credential-label">Ваш уникальный ID турагента:</div>
                <div class="credential-value">${data.uniqueId}</div>
              </div>
              
              <div class="credential-item">
                <div class="credential-label">Email (логин):</div>
                <div class="credential-value">${data.email}</div>
              </div>
              
              <div class="credential-item">
                <div class="credential-label">Пароль:</div>
                <div class="credential-value">${data.password}</div>
              </div>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Важно:</strong> Сохраните эти данные в безопасном месте. Рекомендуем изменить пароль после первого входа в систему.
            </div>
            
            <div style="text-align: center;">
              <a href="${data.loginUrl}" class="login-button">Войти в личный кабинет →</a>
            </div>
            
            <p style="margin-top: 30px; color: #6b7280;">
              Если у вас возникнут вопросы или потребуется помощь, наша служба поддержки всегда готова вам помочь.
            </p>
            
            <p style="margin-top: 20px;">
              С уважением,<br>
              <strong>Команда Bunyod-Tour</strong>
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Bunyod-Tour</strong> - Ваш надежный партнер в туристическом бизнесе</p>
            <p style="margin-top: 10px;">© ${new Date().getFullYear()} Все права защищены</p>
            <p style="margin-top: 15px;">
              📧 Email: booking@bunyodtour.tj<br>
              📞 Телефон: +992 XX XXX XXXX
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await sendEmailWithSendGrid(email, subject, html);
    console.log(`✅ Agent welcome email sent to ${email} via SendGrid`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending agent welcome email:', error);
    throw error;
  }
}

// Send simple test email
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
          <p>Ваш надежный спутник в мире путешествий</p>
        </div>
        <div class="content">
          <h2>✅ Тестовое письмо</h2>
          <p>Это тестовое письмо от системы бронирования Bunyod-Tour.</p>
          <p>Если вы получили это письмо, значит система email настроена корректно!</p>
          <p><strong>Дата отправки:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.
        </div>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmailWithSendGrid(to, subject, html);
}
