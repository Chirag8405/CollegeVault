# OTP Configuration Guide

**College Vault** by Chirag Poornamath

This document management system supports **real OTP sending via Email and SMS** for enhanced security.

## 🎯 Current Status

The system is now ready to send real OTPs to users' email addresses and phone numbers. You just need to configure the services.

## 📧 Email Configuration (SMTP)

### Option 1: Gmail (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. **Set Environment Variables**:

```bash
# Using DevServerControl tool (recommended for secrets):
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
```

### Option 2: Other Email Providers

**Outlook/Hotmail:**
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

**Custom SMTP:**
```bash
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587 (or 465 for SSL)
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
```

## 📱 SMS Configuration (Twilio)

1. **Create Twilio Account**: Go to [twilio.com](https://www.twilio.com)
2. **Get Your Credentials**:
   - Account SID
   - Auth Token
   - Phone Number (buy one from Twilio)
3. **Set Environment Variables**:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

## 🔧 How to Set Environment Variables

### Method 1: DevServerControl Tool (Recommended for Secrets)
```javascript
// For sensitive data like passwords and API keys
DevServerControl.set_env_variable(["SMTP_USER", "your-email@gmail.com"])
DevServerControl.set_env_variable(["SMTP_PASS", "your-app-password"])
DevServerControl.set_env_variable(["TWILIO_ACCOUNT_SID", "your-sid"])
DevServerControl.set_env_variable(["TWILIO_AUTH_TOKEN", "your-token"])
```

### Method 2: .env File (For Non-Sensitive Data)
```bash
# Add to .env file
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
TWILIO_PHONE_NUMBER=+1234567890
```

## 🧪 Testing the Configuration

1. **Check Service Status**: The server logs will show the configuration status:
   ```
   📊 OTP Service Status: Both email and SMS services are configured and working.
   ```

2. **Test Email**: Try sending an OTP - you should receive a professional email
3. **Test SMS**: You should receive an SMS with the OTP code

## 🎨 Email Template Features

The system sends beautifully formatted HTML emails with:
- Professional College Vault branding
- Clear OTP code display
- Security instructions
- Expiration time (5 minutes)
- Responsive design

## 🔄 Fallback Behavior

If services aren't configured:
- **Development Mode**: OTPs are logged to console with instructions
- **Partial Config**: Works with just email OR just SMS
- **No Config**: Clear instructions on how to configure

## 🚀 Production Deployment

For production:
1. **Use Environment Variables** (not .env files)
2. **Use Professional Email Service** (SendGrid, Mailgun, etc.)
3. **Use Production Twilio Account** (not trial)
4. **Set NODE_ENV=production**

## 📋 Quick Setup Commands

```bash
# 1. Set Gmail Configuration
npm run env-set SMTP_HOST smtp.gmail.com
npm run env-set SMTP_PORT 587
npm run env-set SMTP_USER your-email@gmail.com
npm run env-set SMTP_PASS your-app-password

# 2. Set Twilio Configuration  
npm run env-set TWILIO_ACCOUNT_SID your-account-sid
npm run env-set TWILIO_AUTH_TOKEN your-auth-token
npm run env-set TWILIO_PHONE_NUMBER +1234567890

# 3. Restart server
npm run dev
```

## 🎯 Benefits

- ✅ **Real Email Delivery**: Professional HTML emails
- ✅ **Real SMS Delivery**: Instant SMS via Twilio
- ✅ **Dual Channel Security**: Both email and SMS for reliability
- ✅ **Graceful Fallback**: Works even with partial configuration
- ✅ **Production Ready**: Scalable email/SMS infrastructure
- ✅ **Beautiful Templates**: Professional branding
- ✅ **Security**: 5-minute expiration, no code reuse

Once configured, users will receive real OTPs via email and SMS, providing enterprise-level security for document access.

---
**Developed by Chirag Poornamath**
