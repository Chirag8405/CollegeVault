export interface EnvironmentConfig {
  isProduction: boolean;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  isConfigured: boolean;
  neon?: {
    enabled: boolean;
    databaseUrl?: string;
  };
}

export const getEnvironmentConfig = (): EnvironmentConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const requiredEnvVars = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER', 
    'SMTP_PASS',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER'
  ];

  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  const isConfigured = missingEnvVars.length === 0;

  const neonEnabled = !!process.env.NEON_DATABASE_URL || !!process.env.DATABASE_URL;

  return {
    isProduction,
    requiredEnvVars,
    missingEnvVars,
    isConfigured,
    neon: {
      enabled: neonEnabled,
      databaseUrl: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL
    }
  };
};

export const validateProductionEnvironment = (): void => {
  const config = getEnvironmentConfig();
  
  if (config.isProduction && !config.isConfigured) {
    console.error('❌ PRODUCTION DEPLOYMENT ERROR:');
    console.error('Missing required environment variables:', config.missingEnvVars.join(', '));
    console.error('\nPlease configure the following environment variables:');
    console.error('Email (SMTP):');
    console.error('  SMTP_HOST - Your email provider\'s SMTP server');
    console.error('  SMTP_PORT - SMTP port (usually 587 or 465)');
    console.error('  SMTP_USER - Your email address');
    console.error('  SMTP_PASS - Your email password or app password');
    console.error('\nSMS (Twilio):');
    console.error('  TWILIO_ACCOUNT_SID - Your Twilio Account SID');
    console.error('  TWILIO_AUTH_TOKEN - Your Twilio Auth Token');
    console.error('  TWILIO_PHONE_NUMBER - Your Twilio phone number');
    
    throw new Error('Production deployment requires all environment variables to be configured');
  }
  
  if (config.isConfigured) {
    console.log('✅ Environment configuration validated successfully');
  } else {
    console.warn('⚠️  Development mode: Some environment variables are missing');
    console.warn('Missing:', config.missingEnvVars.join(', '));
    console.warn('OTP services may not work properly');
  }

  if (config.neon?.enabled) {
    console.log('✅ Neon database URL detected. The app can be configured to use Neon.');
  } else {
    console.log('ℹ️  NEON_DATABASE_URL not set. Using built-in SQLite.');
  }
};

export const getConfigurationInstructions = (): string => {
  const config = getEnvironmentConfig();
  
  const neonSection = `\n📦 Database (Neon optional):\nNEON_DATABASE_URL=postgres://user:pass@host/db?sslmode=require\n`;

  if (config.isConfigured) {
    return 'All services are configured correctly!' + neonSection;
  }

  return `
🔧 CONFIGURATION REQUIRED

Missing environment variables: ${config.missingEnvVars.join(', ')}

To enable OTP services, set these environment variables:

📧 EMAIL CONFIGURATION (SMTP):
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

📱 SMS CONFIGURATION (Twilio):
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=your-twilio-number
${neonSection}
For detailed setup instructions, visit:
- Gmail: https://support.google.com/accounts/answer/185833
- Twilio: https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account
  `;
};
