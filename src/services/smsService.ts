// @ts-nocheck
import { Order, Customer } from '@prisma/client';

/**
 * SMS Service для отправки уведомлений владельцу сайта
 * Поддерживает Twilio, EasySendSMS, Messaggio и другие провайдеры
 */

// SMS Configuration
const SMS_CONFIG = {
  provider: process.env.SMS_PROVIDER || 'twilio', // 'twilio', 'easysendsms', 'messaggio'
  adminPhone: process.env.ADMIN_PHONE || '+992123456789',
  
  // Twilio configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_PHONE_NUMBER
  },
  
  // EasySendSMS configuration
  easysendsms: {
    apiKey: process.env.EASYSENDSMS_API_KEY,
    apiSecret: process.env.EASYSENDSMS_API_SECRET,
    senderId: process.env.EASYSENDSMS_SENDER_ID || 'Bunyod-Tour'
  },
  
  // Messaggio configuration
  messaggio: {
    login: process.env.MESSAGGIO_LOGIN,
    senderId: process.env.MESSAGGIO_SENDER_ID || 'Bunyod-Tour'
  }
};

export const smsService = {
  /**
   * Отправить SMS уведомление владельцу о новой оплате
   */
  async sendPaymentNotificationToAdmin(order: any, customer: Customer): Promise<boolean> {
    try {
      // Проверка, настроен ли SMS-сервис
      if (!this.isConfigured()) {
        console.log('📱 SMS service not configured - skipping admin notification');
        return false;
      }

      const tourTitle = order.tour?.title?.ru || order.tour?.title?.en || 'Tour';
      const message = this.formatPaymentNotification(order, customer, tourTitle);

      // Отправка SMS через выбранный провайдер
      const sent = await this.sendSMS(SMS_CONFIG.adminPhone, message);
      
      if (sent) {
        console.log(`📱 SMS notification sent to admin: ${SMS_CONFIG.adminPhone}`);
        return true;
      } else {
        console.error('📱 Failed to send SMS notification to admin');
        return false;
      }
    } catch (error) {
      console.error('📱 SMS sending error:', error);
      return false;
    }
  },

  /**
   * Форматирование текста SMS для уведомления о платеже
   */
  formatPaymentNotification(order: any, customer: Customer, tourTitle: string): string {
    return `🎉 НОВАЯ ОПЛАТА!\n` +
           `Заказ: ${order.orderNumber}\n` +
           `Тур: ${tourTitle}\n` +
           `Сумма: ${order.totalAmount} ${order.currency || 'TJS'}\n` +
           `Клиент: ${customer.full_name}\n` +
           `Тел: ${customer.phone || 'не указан'}\n` +
           `Дата тура: ${new Date(order.tourDate).toLocaleDateString('ru-RU')}`;
  },

  /**
   * Проверка конфигурации SMS-сервиса
   */
  isConfigured(): boolean {
    const provider = SMS_CONFIG.provider;
    
    switch (provider) {
      case 'twilio':
        return !!(SMS_CONFIG.twilio.accountSid && SMS_CONFIG.twilio.authToken && SMS_CONFIG.twilio.fromNumber);
      case 'easysendsms':
        return !!(SMS_CONFIG.easysendsms.apiKey && SMS_CONFIG.easysendsms.apiSecret);
      case 'messaggio':
        return !!(SMS_CONFIG.messaggio.login);
      default:
        return false;
    }
  },

  /**
   * Отправка SMS через выбранный провайдер
   */
  async sendSMS(toPhone: string, message: string): Promise<boolean> {
    const provider = SMS_CONFIG.provider;

    try {
      switch (provider) {
        case 'twilio':
          return await this.sendViaTwilio(toPhone, message);
        case 'easysendsms':
          return await this.sendViaEasySendSMS(toPhone, message);
        case 'messaggio':
          return await this.sendViaMessaggio(toPhone, message);
        default:
          console.error(`❌ Unknown SMS provider: ${provider}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ SMS sending failed with ${provider}:`, error);
      return false;
    }
  },

  /**
   * Отправка SMS через Twilio
   */
  async sendViaTwilio(toPhone: string, message: string): Promise<boolean> {
    try {
      // Динамический импорт Twilio только если настроен
      const twilio = require('twilio');
      const client = twilio(SMS_CONFIG.twilio.accountSid, SMS_CONFIG.twilio.authToken);

      const result = await client.messages.create({
        body: message,
        from: SMS_CONFIG.twilio.fromNumber,
        to: toPhone
      });

      console.log('📱 Twilio SMS sent:', result.sid);
      return true;
    } catch (error) {
      console.error('❌ Twilio SMS error:', error);
      return false;
    }
  },

  /**
   * Отправка SMS через EasySendSMS
   */
  async sendViaEasySendSMS(toPhone: string, message: string): Promise<boolean> {
    try {
      const fetch = require('node-fetch');
      
      const response = await fetch('https://api.easysendsms.app/bulksms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          user: SMS_CONFIG.easysendsms.apiKey,
          password: SMS_CONFIG.easysendsms.apiSecret,
          from: SMS_CONFIG.easysendsms.senderId,
          to: toPhone.replace('+', ''), // Remove + sign
          text: message
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('📱 EasySendSMS sent successfully');
        return true;
      } else {
        console.error('❌ EasySendSMS error:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ EasySendSMS error:', error);
      return false;
    }
  },

  /**
   * Отправка SMS через Messaggio
   */
  async sendViaMessaggio(toPhone: string, message: string): Promise<boolean> {
    try {
      const fetch = require('node-fetch');
      
      const response = await fetch('https://msg.messaggio.com/api/v1/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Messaggio-Login': SMS_CONFIG.messaggio.login || ''
        },
        body: JSON.stringify({
          recipients: [{ phone: toPhone.replace('+', '') }],
          channels: ['sms'],
          sms: {
            from: SMS_CONFIG.messaggio.senderId,
            content: [{ type: 'text', text: message }]
          }
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('📱 Messaggio SMS sent successfully');
        return true;
      } else {
        console.error('❌ Messaggio error:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ Messaggio error:', error);
      return false;
    }
  }
};

export default smsService;
