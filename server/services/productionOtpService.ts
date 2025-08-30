import twilio from 'twilio';
import nodemailer, { Transporter } from 'nodemailer';

// Environment validation
const validateEnvironment = () => {
  const requiredEnvVars = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    } else {
      console.warn(`⚠️  Development mode: Missing environment variables: ${missing.join(', ')}`);
      return false;
    }
  }
  return true;
};

// Validate environment on module load
const isConfigured = validateEnvironment();

// Email transporter setup (only if configured)
let emailTransporter: Transporter | null = null;
if (isConfigured && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Twilio client setup (only if configured)
let twilioClient: ReturnType<typeof twilio> | null = null;
if (isConfigured && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

export interface OTPResult {
  success: boolean;
  message: string;
  emailSent?: boolean;
  smsSent?: boolean;
  error?: string;
}

export const sendOTPEmail = async (
  email: string,
  otp: string,
  purpose: string = 'verification'
): Promise<{ success: boolean; message: string }> => {
  if (!emailTransporter) {
    return {
      success: false,
      message: 'Email service not configured'
    };
  }

  try {
    const mailOptions = {
      from: `"College Vault" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Your OTP for ${purpose}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Your OTP Code</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background: white;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">College Vault</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Secure Document Management</p>
            </div>
            
            <div style="padding: 40px 30px;">
              <h2 style="color: #334155; margin: 0 0 20px 0;">Your Security Code</h2>
              
              <p style="color: #64748b; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                You have requested a security code for ${purpose}. Please use the code below:
              </p>
              
              <div style="background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: bold; color: #1e293b; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  ${otp}
                </div>
                <p style="color: #64748b; margin: 15px 0 0 0; font-size: 14px;">
                  This code will expire in 5 minutes
                </p>
              </div>
              
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0;">
                <p style="color: #92400e; margin: 0; font-size: 14px;">
                  <strong>Security Notice:</strong> Never share this code with anyone. College Vault will never ask for your OTP code via phone or email.
                </p>
              </div>
              
              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                If you didn't request this code, please ignore this email and consider changing your password.
              </p>
            </div>
            
            <div style="background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} College Vault. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await emailTransporter.sendMail(mailOptions);
    
    return {
      success: true,
      message: 'OTP sent successfully to your email'
    };
  } catch (error) {
    console.error('Email sending failed:', error);
    return {
      success: false,
      message: 'Failed to send email. Please try again later.'
    };
  }
};

export const sendOTPSMS = async (
  phone: string,
  otp: string,
  purpose: string = 'verification'
): Promise<{ success: boolean; message: string }> => {
  if (!twilioClient) {
    return {
      success: false,
      message: 'SMS service not configured'
    };
  }

  try {
    // Ensure phone number is in E.164 format
    let formattedPhone = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`;
    
    const message = `Your College Vault OTP for ${purpose}: ${otp}. Valid for 5 minutes. Never share this code.`;
    
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });
    
    return {
      success: true,
      message: 'OTP sent successfully to your phone'
    };
  } catch (error) {
    console.error('SMS sending failed:', error);
    return {
      success: false,
      message: 'Failed to send SMS. Please check your phone number.'
    };
  }
};

export const sendOTPToEmailAndPhone = async (
  email: string,
  phone: string,
  otp: string,
  purpose: string = 'verification'
): Promise<OTPResult> => {
  try {
    const [emailResult, smsResult] = await Promise.allSettled([
      sendOTPEmail(email, otp, purpose),
      sendOTPSMS(phone, otp, purpose)
    ]);

    const emailSuccess = emailResult.status === 'fulfilled' && emailResult.value.success;
    const smsSuccess = smsResult.status === 'fulfilled' && smsResult.value.success;

    if (emailSuccess && smsSuccess) {
      return {
        success: true,
        message: 'OTP sent successfully to both email and phone',
        emailSent: true,
        smsSent: true
      };
    } else if (emailSuccess || smsSuccess) {
      const successfulChannel = emailSuccess ? 'email' : 'phone';
      return {
        success: true,
        message: `OTP sent successfully to your ${successfulChannel}. ${!emailSuccess ? 'Email delivery failed.' : 'SMS delivery failed.'}`,
        emailSent: emailSuccess,
        smsSent: smsSuccess
      };
    } else {
      const emailError = emailResult.status === 'rejected' ? emailResult.reason : (emailResult.value?.message || 'Unknown error');
      const smsError = smsResult.status === 'rejected' ? smsResult.reason : (smsResult.value?.message || 'Unknown error');
      
      return {
        success: false,
        message: 'Failed to send OTP to both email and phone. Please try again later.',
        emailSent: false,
        smsSent: false,
        error: `Email: ${emailError}, SMS: ${smsError}`
      };
    }
  } catch (error) {
    console.error('OTP sending failed:', error);
    return {
      success: false,
      message: 'Failed to send OTP. Please try again later.',
      emailSent: false,
      smsSent: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Test email and SMS connectivity
export const testConnectivity = async (): Promise<{
  email: boolean;
  sms: boolean;
  errors: string[];
}> => {
  const errors: string[] = [];
  let emailOk = false;
  let smsOk = false;

  if (emailTransporter) {
    try {
      await emailTransporter.verify();
      emailOk = true;
    } catch (error) {
      errors.push(`Email: ${error instanceof Error ? error.message : 'Connection failed'}`);
    }
  } else {
    errors.push('Email: Service not configured');
  }

  if (twilioClient) {
    try {
      // Test Twilio connection by fetching account info
      await twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      smsOk = true;
    } catch (error) {
      errors.push(`SMS: ${error instanceof Error ? error.message : 'Connection failed'}`);
    }
  } else {
    errors.push('SMS: Service not configured');
  }

  return { email: emailOk, sms: smsOk, errors };
};
