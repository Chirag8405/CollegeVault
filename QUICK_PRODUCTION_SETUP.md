# Quick Production Setup

**College Vault** by Chirag Poornamath

## 🚀 Production Ready in 3 Steps

### Step 1: Switch to Production Files
```bash
# Replace development files with production versions
cp server/productionIndex.ts server/index.ts
cp client/components/ProductionSecureDownloadModal.tsx client/components/SecureDownloadModal.tsx
```

### Step 2: Configure Environment Variables
```bash
# Copy environment template
cp .env.production.example .env

# Edit .env with your credentials:
# - Gmail SMTP settings
# - Twilio SMS settings
```

### Step 3: Deploy to Netlify
1. Push code to your repository
2. Connect repository to Netlify
3. Add environment variables in Netlify dashboard
4. Deploy!

## 📧 Quick SMTP Setup (Gmail)
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Generate App Password for Mail
4. Use app password in SMTP_PASS

## 📱 Quick Twilio Setup
1. Sign up at twilio.com
2. Get free trial credits
3. Copy Account SID, Auth Token, Phone Number
4. Add to environment variables

## ✅ Environment Variables Needed
```
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=your-twilio-number
```

That's it! The College Vault will now send real OTPs via email and SMS! 🎉

Check `/api/status` on your deployed site to verify everything is working.

---
**Developed by Chirag Poornamath**
