# College Vault

**Developed by Chirag Poornamath**

A secure, production-ready document management system designed specifically for college students. Features dual-channel OTP authentication via email and SMS for maximum security.

## Features

### 🔐 Secure Authentication
- Password-based login with bcrypt encryption
- Dual-channel OTP verification (Email + SMS)
- JWT token-based session management

### 📁 Document Management
- Upload and organize college documents
- Categories: Certificates, Fee Receipts, Transcripts, ID Cards
- Semester and year-based organization
- Secure document download with OTP verification

### 🔒 Security Features
- Password verification before document access
- OTP sent to registered email and phone
- Database encryption and secure storage
- Session management and timeout

### 📧 Professional Communication
- HTML email templates with branding
- SMS notifications via Twilio
- Real-time delivery confirmation

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Express.js + Node.js
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT + bcrypt
- **Email**: Nodemailer with SMTP
- **SMS**: Twilio API
- **UI Components**: Radix UI + Lucide React

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your SMTP and Twilio credentials
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Configuration

### Email Setup (SMTP)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### SMS Setup (Twilio)
```bash
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=your-twilio-number
```

## Deployment

Ready for deployment on:
- ✅ Netlify
- ✅ Vercel
- ✅ Heroku
- ✅ Any Node.js hosting provider

See `PRODUCTION_DEPLOYMENT.md` for detailed deployment instructions.

## Project Structure

```
├── client/                 # React frontend
│   ├── components/         # Reusable UI components
│   ├── pages/             # Application pages
│   └── contexts/          # React contexts
├── server/                # Express backend
│   ├── database/          # Database setup and queries
│   ├── routes/           # API route handlers
│   └── services/         # Business logic services
├── shared/               # Shared TypeScript interfaces
└── data/                # SQLite database storage
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-password` - Verify password for secure operations
- `POST /api/auth/verify-download-otp` - Verify OTP for document download

### Documents
- `GET /api/documents` - List user documents
- `POST /api/documents` - Upload new document
- `GET /api/documents/:id/download` - Download document (requires OTP)
- `DELETE /api/documents/:id` - Delete document

### System
- `GET /api/status` - System health check
- `GET /api/config-help` - Configuration assistance

## Security

- 🔐 Password hashing with bcrypt (cost factor 10)
- 🔑 JWT token authentication
- 📱 Dual-channel OTP verification
- 🛡️ SQL injection protection
- 🔒 Environment variable security
- ⏰ OTP expiration (5 minutes)

## License

Private project by Chirag Poornamath. All rights reserved.

## Support

For technical support or questions, contact Chirag Poornamath.

---

**Built with ❤️ by Chirag Poornamath**
