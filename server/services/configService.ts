export interface ServiceConfig {
  emailConfigured: boolean;
  smsConfigured: boolean;
  isDevelopment: boolean;
}

export const getServiceConfig = (): ServiceConfig => {
  const emailConfigured = !!(
    process.env.SMTP_USER && 
    process.env.SMTP_PASS && 
    process.env.SMTP_HOST
  );
  
  const smsConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID && 
    process.env.TWILIO_AUTH_TOKEN && 
    process.env.TWILIO_PHONE_NUMBER
  );
  
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  return {
    emailConfigured,
    smsConfigured,
    isDevelopment
  };
};

export const getOTPServiceStatus = (): string => {
  const config = getServiceConfig();
  
  if (config.emailConfigured && config.smsConfigured) {
    return 'Both email and SMS services are configured and working.';
  } else if (config.emailConfigured) {
    return 'Email service is configured. SMS service needs Twilio configuration.';
  } else if (config.smsConfigured) {
    return 'SMS service is configured. Email service needs SMTP configuration.';
  } else {
    return 'Neither email nor SMS services are configured. Using development mode (console logging).';
  }
};

export const getConfigurationInstructions = (): string => {
  const config = getServiceConfig();
  let instructions = '';
  
  if (!config.emailConfigured) {
    instructions += '\n📧 Email Configuration:\n';
    instructions += '   Set these environment variables:\n';
    instructions += '   - SMTP_HOST (e.g., smtp.gmail.com)\n';
    instructions += '   - SMTP_PORT (e.g., 587)\n';
    instructions += '   - SMTP_USER (your email address)\n';
    instructions += '   - SMTP_PASS (your app password)\n';
  }
  
  if (!config.smsConfigured) {
    instructions += '\n📱 SMS Configuration:\n';
    instructions += '   Set these environment variables:\n';
    instructions += '   - TWILIO_ACCOUNT_SID\n';
    instructions += '   - TWILIO_AUTH_TOKEN\n';
    instructions += '   - TWILIO_PHONE_NUMBER\n';
  }
  
  if (instructions) {
    instructions = '\n🔧 To enable real OTP sending:' + instructions;
    instructions += '\n\nUse DevServerControl tool or set in .env file\n';
  }
  
  return instructions;
};
