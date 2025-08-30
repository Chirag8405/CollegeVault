# Production Deployment Guide

## College Vault
**Developed by Chirag Poornamath**

This guide will help you deploy the secure document management system to production with real OTP delivery via email and SMS.

## 🚀 Production Features

- ✅ **SQLite Database**: Persistent data storage
- ✅ **Real Email OTP**: SMTP integration for email delivery
- ✅ **Real SMS OTP**: Twilio integration for SMS delivery
- ✅ **Production Security**: Enhanced password hashing, environment validation
- ✅ **Error Handling**: Comprehensive error handling and logging
- ✅ **No Development Code**: All console OTP outputs removed

## 📋 Prerequisites

### 1. Email Service (SMTP)
Choose a reliable email service that supports SMTP authentication. Recommended options:

#### Gmail Setup (Recommended)
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Security → 2-Step Verification (enable if not already)
3. Security → App passwords
4. Generate an app password for "Mail"
5. Use this app password (not your regular password)

#### Other Email Providers
- **Outlook**: Use `smtp-mail.outlook.com`, port 587
- **Yahoo**: Use `smtp.mail.yahoo.com`, port 587
- **Custom SMTP**: Contact your hosting provider

### 2. SMS Service (Twilio)
1. Sign up at [Twilio](https://www.twilio.com/try-twilio)
2. Get your free trial credits ($15)
3. Note down your Account SID, Auth Token, and Phone Number

## 🔧 Environment Configuration

### Step 1: Copy Environment Template
```bash
cp .env.production.example .env
```

### Step 2: Configure Environment Variables

Edit `.env` with your credentials:

```env
NODE_ENV=production

# Email Configuration (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youremail@gmail.com
SMTP_PASS=your-app-password

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

## 🌐 Netlify Deployment

### Step 1: Prepare for Deployment

1. **Update server entry point**:
   ```bash
   # Update server/index.ts to use production routes
   cp server/productionIndex.ts server/index.ts
   ```

2. **Update client components**:
   ```bash
   # Update SecureDownloadModal for production
   cp client/components/ProductionSecureDownloadModal.tsx client/components/SecureDownloadModal.tsx
   ```

### Step 2: Netlify Configuration

Create `netlify.toml` (if not already present):

```toml
[build]
  command = "npm run build"
  publish = "dist/spa"

[functions]
  directory = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

### Step 3: Deploy to Netlify

1. **Connect Repository**:
   - Go to [Netlify](https://netlify.com)
   - New site from Git
   - Connect your repository

2. **Set Environment Variables**:
   - Go to Site settings → Environment variables
   - Add all environment variables from your `.env` file:
     - `NODE_ENV` = `production`
     - `SMTP_HOST` = `smtp.gmail.com`
     - `SMTP_PORT` = `587`
     - `SMTP_USER` = `youremail@gmail.com`
     - `SMTP_PASS` = `your-app-password`
     - `TWILIO_ACCOUNT_SID` = `your-account-sid`
     - `TWILIO_AUTH_TOKEN` = `your-auth-token`
     - `TWILIO_PHONE_NUMBER` = `your-twilio-number`

3. **Deploy**:
   - Click "Deploy site"
   - Wait for build to complete

## ✅ Verification

### Step 1: Check System Status
Visit `https://your-site.netlify.app/api/status` to verify:
- Database connection
- Environment configuration
- Email/SMS service connectivity

### Step 2: Test Registration
1. Go to your deployed site
2. Register with a real email and phone number
3. Verify you receive real OTPs

### Step 3: Test Secure Downloads
1. Upload a secure document
2. Try to download it
3. Verify you receive OTP via email and SMS

## 🔒 Security Considerations

### Production Security Features
- **Password Hashing**: bcrypt with 12 salt rounds
- **Environment Validation**: Prevents deployment without configuration
- **Token Expiration**: 24-hour JWT tokens
- **OTP Expiration**: 5-minute OTP codes
- **Input Validation**: Comprehensive input sanitization

### Best Practices
1. **Never commit** `.env` files to version control
2. **Use strong passwords** for email accounts
3. **Enable 2FA** on Twilio account
4. **Monitor** OTP usage to prevent abuse
5. **Regular backup** of SQLite database

## 📊 Monitoring & Maintenance

### System Endpoints
- **Health Check**: `/api/ping`
- **System Status**: `/api/status`
- **Configuration Help**: `/api/config-help`

### Database Maintenance
The SQLite database is automatically managed:
- Location: `data/app.db`
- Auto-cleanup of expired OTP sessions
- Automatic table creation and indexing

### Troubleshooting

#### Email Issues
- Verify SMTP credentials
- Check app password (not regular password)
- Ensure 2FA is enabled for Gmail

#### SMS Issues
- Verify Twilio credentials
- Check phone number format (+1234567890)
- Ensure trial credits are available

#### Database Issues
- Check file permissions in `data/` directory
- Verify SQLite database file creation

## 🎯 Production Checklist

- [ ] Environment variables configured
- [ ] Email service tested
- [ ] SMS service tested
- [ ] Site deployed to Netlify
- [ ] Registration flow tested
- [ ] Login flow tested
- [ ] Secure download tested
- [ ] System status verified
- [ ] Production domain configured

## 📞 Support

If you encounter issues:

1. Check `/api/status` endpoint for service status
2. Review environment variables
3. Verify SMTP/Twilio credentials
4. Check Netlify function logs

Your College Vault is now production-ready with real OTP delivery! 🎉
