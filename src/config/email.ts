import nodemailer from 'nodemailer';
import * as https from 'https';

const createTransporter = () => {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('📧 Email credentials not configured - email notifications will be disabled');
      return null;
    }

    const port = parseInt(process.env.SMTP_PORT || '465');
    const isSecure = port === 465;

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
      greetingTimeout: 20000,
      socketTimeout: 45000
    } as any);
  } catch (error) {
    console.log('📧 Failed to create email transporter:', error instanceof Error ? error.message : String(error));
    return null;
  }
};

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'booking@bunyodtour.tj';
    const body = JSON.stringify({
      from: `Bunyod-Tour <${fromEmail}>`,
      to: [to],
      subject,
      html,
    });

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
        res.on('data', (c) => data += c);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ Email sent via Resend (status: ${res.statusCode})`);
            resolve();
          } else {
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
    console.warn(`⚠️ Resend error:`, err.message);
    return false;
  }
}

async function sendMailSmart(mailOptions: { from?: string; to: string; subject: string; html: string }): Promise<{ success: boolean; reason?: string }> {
  if (!mailOptions.to) {
    return { success: false, reason: 'No recipient specified' };
  }

  // 1. Try Resend first
  if (await sendViaResend(mailOptions.to, mailOptions.subject, mailOptions.html)) {
    return { success: true };
  }

  // 2. Fall back to SMTP
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER || mailOptions.from || 'booking@bunyodtour.tj';
  const transporter = createTransporter();
  if (!transporter) {
    return { success: false, reason: 'Email service not configured' };
  }

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, reason: error.message };
  }
}

export const sendAdminNotification = async (bookingData: {
  fullName: string;
  email: string;
  preferredDate: string;
  numberOfPeople: number;
  tourTitle: string;
}) => {
  const adminTo = process.env.ADMIN_EMAIL || process.env.SMTP_FROM;
  if (!adminTo) {
    console.log('📧 Admin email not configured - skipping admin notification');
    return { success: false, reason: 'Admin email not configured' };
  }
  
  const mailOptions = {
    to: adminTo,
    subject: `New Booking Request - ${bookingData.tourTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb; margin-bottom: 20px;">New Booking Request</h2>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #1e293b; margin-top: 0;">Tour Details</h3>
          <p><strong>Tour:</strong> ${bookingData.tourTitle}</p>
          <p><strong>Preferred Date:</strong> ${bookingData.preferredDate}</p>
          <p><strong>Number of People:</strong> ${bookingData.numberOfPeople}</p>
        </div>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #1e293b; margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${bookingData.fullName}</p>
          <p><strong>Email:</strong> ${bookingData.email}</p>
        </div>
        
        <div style="padding: 15px; background-color: #dbeafe; border-left: 4px solid #2563eb; margin-top: 20px;">
          <p style="margin: 0; color: #1e40af;">
            <strong>Action Required:</strong> Please review this booking request and contact the customer within 24 hours to confirm availability and arrange payment.
          </p>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
        
        <p style="font-size: 14px; color: #64748b; text-align: center;">
          This is an automated notification from Bunyod-Tour booking system.
        </p>
      </div>
    `
  };

  try {
    const result = await sendMailSmart(mailOptions);
    if (result.success) {
      console.log('📧 Admin notification email sent successfully to:', mailOptions.to);
    } else {
      console.log('📧 Failed to send admin notification email:', result.reason);
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('📧 Failed to send admin notification email:', errorMessage);
    return { success: false, reason: errorMessage };
  }
};

export const sendCustomerConfirmation = async (bookingData: {
  fullName: string;
  email: string;
  preferredDate: string;
  numberOfPeople: number;
  tourTitle: string;
}) => {
  const mailOptions = {
    to: bookingData.email,
    subject: `Booking Request Confirmation - ${bookingData.tourTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin-bottom: 10px;">Bunyod-Tour</h1>
          <p style="color: #64748b; margin: 0;">Discover the Beauty of Central Asia</p>
        </div>
        
        <h2 style="color: #1e293b; margin-bottom: 20px;">Thank You for Your Booking Request!</h2>
        
        <p style="color: #374151; line-height: 1.6;">
          Dear ${bookingData.fullName},
        </p>
        
        <p style="color: #374151; line-height: 1.6;">
          We have received your booking request for our tour and are excited to help you explore the magnificent landscapes and rich culture of Central Asia.
        </p>
        
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1e293b; margin-top: 0;">Your Booking Details</h3>
          <p><strong>Tour:</strong> ${bookingData.tourTitle}</p>
          <p><strong>Preferred Date:</strong> ${bookingData.preferredDate}</p>
          <p><strong>Number of People:</strong> ${bookingData.numberOfPeople}</p>
          <p><strong>Contact Email:</strong> ${bookingData.email}</p>
        </div>
        
        <div style="padding: 15px; background-color: #dcfce7; border-left: 4px solid #16a34a; margin: 20px 0;">
          <p style="margin: 0; color: #15803d;">
            <strong>What's Next?</strong> Our team will review your request and contact you within 24 hours to confirm availability, discuss the itinerary details, and arrange payment.
          </p>
        </div>
        
        <p style="color: #374151; line-height: 1.6;">
          If you have any questions or need to modify your request, please don't hesitate to contact us at ${process.env.SMTP_FROM || 'booking@bunyodtour.tj'}.
        </p>
        
        <p style="color: #374151; line-height: 1.6; margin-top: 30px;">
          Best regards,<br>
          <strong>The Bunyod-Tour Team</strong>
        </p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
        
        <p style="font-size: 14px; color: #64748b; text-align: center;">
          This is an automated confirmation email from Bunyod-Tour.<br>
          Thank you for choosing us for your Central Asia adventure!
        </p>
      </div>
    `
  };

  try {
    const result = await sendMailSmart(mailOptions);
    if (result.success) {
      console.log('📧 Customer confirmation email sent successfully to:', bookingData.email);
    } else {
      console.log('📧 Failed to send customer confirmation email:', result.reason);
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('📧 Failed to send customer confirmation email:', errorMessage);
    return { success: false, reason: errorMessage };
  }
};

export default { sendAdminNotification, sendCustomerConfirmation };
