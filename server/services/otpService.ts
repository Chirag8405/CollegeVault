import * as nodemailer from 'nodemailer';
import twilio from 'twilio';

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Twilio configuration
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Create email transporter (initialized only when needed)
let emailTransporter: nodemailer.Transporter | null = null;

const getEmailTransporter = () => {
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport(emailConfig);
  }
  return emailTransporter;
};

export interface OTPResult {
  success: boolean;
  message: string;
  emailSent?: boolean;
  smsSent?: boolean;
}

export const sendOTPEmail = async (email: string, otp: string, purpose: string = 'login'): Promise<{ success: boolean; message: string }> => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('Email credentials not configured, skipping email send');
      return { success: false, message: 'Email service not configured' };
    }

    const subject = purpose === 'login' 
      ? 'Your College Vault Login OTP'
      : 'Your College Vault Security OTP';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp-box { background: white; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; color: #3b82f6; letter-spacing: 4px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 College Vault</h1>
          </div>
          <div class="content">
            <h2>Your OTP Verification Code</h2>
            <p>Hi there!</p>
            <p>You requested an OTP for ${purpose}. Please use the following code:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This code will expire in 5 minutes</li>
              <li>Don't share this code with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
            
            <div class="footer">
              <p>College Vault - Secure Academic Document Management</p>
              <p>This is an automated message, please do not reply.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"College Vault" <${process.env.SMTP_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent
    };

    await getEmailTransporter().sendMail(mailOptions);
    console.log(`📧 OTP email sent successfully to ${email}`);
    return { success: true, message: 'Email sent successfully' };

  } catch (error) {
    console.error('❌ Email send failed:', error);
    return { success: false, message: 'Failed to send email' };
  }
};

export const sendOTPSMS = async (phone: string, otp: string, purpose: string = 'login'): Promise<{ success: boolean; message: string }> => {
  try {
    if (!twilioClient || !twilioPhoneNumber) {
      console.log('Twilio credentials not configured, skipping SMS send');
      return { success: false, message: 'SMS service not configured' };
    }

    const message = `Your College Vault ${purpose} OTP is: ${otp}. This code expires in 5 minutes. Don't share this code with anyone.`;

    await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phone
    });

    console.log(`📱 OTP SMS sent successfully to ${phone}`);
    return { success: true, message: 'SMS sent successfully' };

  } catch (error) {
    console.error('❌ SMS send failed:', error);
    return { success: false, message: 'Failed to send SMS' };
  }
};

export const sendOTPToEmailAndPhone = async (
  email: string, 
  phone: string, 
  otp: string, 
  purpose: string = 'login'
): Promise<OTPResult> => {
  console.log(`🚀 Sending OTP ${otp} to ${email} and ${phone} for ${purpose}`);

  const [emailResult, smsResult] = await Promise.allSettled([
    sendOTPEmail(email, otp, purpose),
    sendOTPSMS(phone, otp, purpose)
  ]);

  const emailSent = emailResult.status === 'fulfilled' && emailResult.value.success;
  const smsSent = smsResult.status === 'fulfilled' && smsResult.value.success;

  let message = '';
  if (emailSent && smsSent) {
    message = 'OTP sent to both email and phone successfully';
  } else if (emailSent) {
    message = 'OTP sent to email successfully (SMS failed)';
  } else if (smsSent) {
    message = 'OTP sent to phone successfully (Email failed)';
  } else {
    message = 'Failed to send OTP to both email and phone';
  }

  console.log(`📊 OTP Send Result: Email=${emailSent}, SMS=${smsSent}`);

  return {
    success: emailSent || smsSent, // Success if at least one channel works
    message,
    emailSent,
    smsSent
  };
};

// For development - fallback to console if services not configured
export const sendOTPDevelopment = (email: string, phone: string, otp: string, purpose: string = 'login') => {
  console.log('=== DEVELOPMENT OTP (Configure SMTP/Twilio for real sending) ===');
  console.log(`Email: ${email}`);
  console.log(`Phone: ${phone}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`Purpose: ${purpose}`);
  console.log(`Expires: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleString()}`);
  console.log('==============================================================');
};
