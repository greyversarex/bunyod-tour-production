#!/usr/bin/env node

// 📧 Quick Email Test Script for Timeweb SMTP
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('📧 Sending test email to greyversarex@gmail.com via Timeweb SMTP...\n');

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: parseInt(process.env.SMTP_PORT || '465') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    console.log('✅ SMTP Configuration:');
    console.log(`  Host: ${process.env.SMTP_HOST}`);
    console.log(`  Port: ${process.env.SMTP_PORT}`);
    console.log(`  User: ${process.env.SMTP_USER}`);
    console.log(`  From: ${process.env.SMTP_FROM}\n`);

    // Test connection
    console.log('🔗 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!\n');

    // Send email
    console.log('📮 Sending email...');
    const info = await transporter.sendMail({
      from: `"Bunyod-Tour" <${process.env.SMTP_FROM}>`,
      to: 'greyversarex@gmail.com',
      subject: '✅ Тест SMTP - Bunyod-Tour',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3E3E3E 0%, #2a2a2a 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 32px;">BUNYOD-TOUR</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Ваш надежный спутник в мире путешествий</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #10b981;">✅ Тест отправки Email успешен!</h2>
            <p>Если вы видите это письмо, значит SMTP сервер Timeweb работает корректно!</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #1f2937;">Параметры подключения:</h3>
              <ul style="color: #4b5563; line-height: 1.8;">
                <li><strong>SMTP сервер:</strong> ${process.env.SMTP_HOST}</li>
                <li><strong>Порт:</strong> ${process.env.SMTP_PORT}</li>
                <li><strong>Отправитель:</strong> ${process.env.SMTP_FROM}</li>
                <li><strong>Дата отправки:</strong> ${new Date().toLocaleString('ru-RU')}</li>
              </ul>
            </div>
            
            <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #047857;">
                <strong>✅ Email система готова к использованию!</strong><br>
                Письма будут автоматически отправляться при платежах и бронированиях.
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px;">
              © ${new Date().getFullYear()} ООО «Бунёд-Тур». Все права защищены.
            </p>
          </div>
        </div>
      `
    });

    console.log('\n✅ EMAIL SENT SUCCESSFULLY!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log(`📮 Recipient: greyversarex@gmail.com`);
    console.log('⏰ Check your inbox (and spam folder) for the test email.\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR SENDING EMAIL:');
    console.error(`Error: ${error.message}`);
    console.error(`\nSMTP Config:`);
    console.error(`  Host: ${process.env.SMTP_HOST}`);
    console.error(`  Port: ${process.env.SMTP_PORT}`);
    console.error(`  User: ${process.env.SMTP_USER}`);
    process.exit(1);
  }
}

testEmail();
