# Netlify DevOps Deployment Guide with Docker

**College Vault** - Developed by Chirag Poornamath

This comprehensive guide covers deploying the College Vault to Netlify using modern DevOps practices, Docker containerization, and automated CI/CD pipelines.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Configuration](#docker-configuration)
3. [Netlify Setup](#netlify-setup)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Environment Management](#environment-management)
6. [Monitoring & Logging](#monitoring--logging)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools & Services

```bash
# Development Tools
- Docker Desktop (latest version)
- Git (for version control)
- Node.js 18+ (for local development)
- Netlify CLI (for deployment management)

# Cloud Services
- Netlify account (Pro plan recommended for production)
- GitHub/GitLab account (for CI/CD)
- Gmail account (for SMTP)
- Twilio account (for SMS)
- Docker Hub account (for container registry)
```

### Service Accounts Setup

1. **Netlify Account**: Sign up at [netlify.com](https://netlify.com)
2. **GitHub Repository**: Create a new repository for your project
3. **Docker Hub**: Create account at [hub.docker.com](https://hub.docker.com)
4. **Twilio**: Sign up at [twilio.com](https://twilio.com) for SMS services

## Docker Configuration

### 1. Create Multi-Stage Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Development dependencies
FROM base AS dev-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .

# Build both client and server
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules

# Create data directory for SQLite
RUN mkdir -p /app/data
RUN chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 8080

CMD ["node", "dist/server/node-build.mjs"]
```

### 2. Docker Compose for Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      target: runner
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}
      - TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}
      - TWILIO_PHONE_NUMBER=${TWILIO_PHONE_NUMBER}
    volumes:
      - app_data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  app_data:
    driver: local
```

### 3. Docker Ignore Configuration

```bash
# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.env.development
.env.test
coverage
.nyc_output
.cache
dist
.vscode
.idea
*.log
*.md
!PRODUCTION_DEPLOYMENT.md
.DS_Store
Thumbs.db
```

## Netlify Setup

### 1. Netlify Configuration File

```toml
# netlify.toml
[build]
  base = "."
  publish = "dist/spa"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"
  NPM_VERSION = "9"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

# Headers for security
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"

[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type, Authorization"

# Environment-specific settings
[context.production]
  command = "npm run build"
  environment = { NODE_ENV = "production" }

[context.deploy-preview]
  command = "npm run build"
  environment = { NODE_ENV = "staging" }

[context.branch-deploy]
  command = "npm run build"
  environment = { NODE_ENV = "development" }
```

### 2. Netlify Functions Setup

```typescript
// netlify/functions/api.ts
import { Handler } from '@netlify/functions';
import serverless from 'serverless-http';
import express from 'express';
import cors from 'cors';
import { createServer } from '../../server/productionIndex';

const app = express();

// CORS configuration for Netlify
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Initialize the server
const server = createServer();
app.use('/.netlify/functions/api', server);

// Export the handler
export const handler: Handler = serverless(app, {
  binary: false
});
```

## CI/CD Pipeline

### 1. GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Netlify with Docker

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  DOCKER_REGISTRY: 'docker.io'
  IMAGE_NAME: 'chiragpoornamath/college-document-vault'

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run type checking
      run: npm run typecheck
      
    - name: Run tests
      run: npm test
      
    - name: Run security audit
      run: npm audit --audit-level=high
      
    - name: Check format
      run: npm run format.fix --check

  build-docker:
    needs: test
    runs-on: ubuntu-latest
    
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
      
    - name: Login to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
        
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
          type=raw,value=latest,enable={{is_default_branch}}
          
    - name: Build and push Docker image
      id: build
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64,linux/arm64

  security-scan:
    needs: build-docker
    runs-on: ubuntu-latest
    
    steps:
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ needs.build-docker.outputs.image-tag }}
        format: 'sarif'
        output: 'trivy-results.sarif'
        
    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: 'trivy-results.sarif'

  deploy-staging:
    if: github.event_name == 'pull_request'
    needs: [test, build-docker]
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
        
    - name: Install Netlify CLI
      run: npm install -g netlify-cli@latest
      
    - name: Build application
      run: npm ci && npm run build
      env:
        NODE_ENV: staging
        
    - name: Deploy to Netlify (Preview)
      run: |
        netlify deploy \
          --dir=dist/spa \
          --functions=netlify/functions \
          --site=${{ secrets.NETLIFY_SITE_ID }} \
          --auth=${{ secrets.NETLIFY_AUTH_TOKEN }} \
          --message="Deploy preview for PR #${{ github.event.number }}"

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: [test, build-docker, security-scan]
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
        
    - name: Install Netlify CLI
      run: npm install -g netlify-cli@latest
      
    - name: Build application
      run: npm ci && npm run build
      env:
        NODE_ENV: production
        
    - name: Deploy to Netlify (Production)
      run: |
        netlify deploy \
          --prod \
          --dir=dist/spa \
          --functions=netlify/functions \
          --site=${{ secrets.NETLIFY_SITE_ID }} \
          --auth=${{ secrets.NETLIFY_AUTH_TOKEN }} \
          --message="Production deployment ${{ github.sha }}"
          
    - name: Health Check
      run: |
        sleep 30
        curl -f ${{ secrets.PRODUCTION_URL }}/api/health || exit 1
        
    - name: Notify deployment success
      uses: 8398a7/action-slack@v3
      with:
        status: success
        text: "🚀 College Vault deployed successfully to production!"
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 2. GitLab CI Configuration (Alternative)

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - security
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"
  IMAGE_TAG: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  LATEST_TAG: $CI_REGISTRY_IMAGE:latest

before_script:
  - docker info

test:
  stage: test
  image: node:18-alpine
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npm run typecheck
    - npm test
    - npm audit --audit-level=high
  only:
    - merge_requests
    - main

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build --cache-from $LATEST_TAG -t $IMAGE_TAG -t $LATEST_TAG .
    - docker push $IMAGE_TAG
    - docker push $LATEST_TAG
  only:
    - main

security_scan:
  stage: security
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image $IMAGE_TAG
  allow_failure: true
  only:
    - main

deploy_production:
  stage: deploy
  image: node:18-alpine
  script:
    - npm install -g netlify-cli
    - npm ci
    - npm run build
    - netlify deploy --prod --dir=dist/spa --functions=netlify/functions
  environment:
    name: production
    url: $PRODUCTION_URL
  only:
    - main
```

## Environment Management

### 1. Environment Variables Configuration

```bash
# .env.production
# Production Environment Configuration
NODE_ENV=production

# Application Settings
APP_NAME="College Vault"
APP_VERSION="1.0.0"
APP_URL=https://your-app.netlify.app

# Database Configuration
DATABASE_URL=file:./data/app.db
DATABASE_BACKUP_ENABLED=true

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-min-32-chars
JWT_EXPIRY=24h
SESSION_TIMEOUT=1800000

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-app-email@gmail.com
SMTP_PASS=your-16-character-app-password
FROM_EMAIL=noreply@your-domain.com
FROM_NAME="College Vault"

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Security Settings
BCRYPT_ROUNDS=12
OTP_LENGTH=6
OTP_EXPIRY_MINUTES=5
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900000

# File Upload Settings
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,doc,docx,png,jpg,jpeg,txt
UPLOAD_PATH=./uploads
VIRUS_SCAN_ENABLED=true

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
RATE_LIMIT_SKIP_SUCCESS=false

# Monitoring & Logging
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_REQUEST_LOGGING=true
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# External Services
BACKUP_SERVICE_URL=https://backup.service.com
MONITORING_WEBHOOK=https://monitoring.service.com/webhook
ANALYTICS_KEY=your-analytics-key

# Feature Flags
FEATURE_EMAIL_VERIFICATION=true
FEATURE_SMS_VERIFICATION=true
FEATURE_DOCUMENT_ENCRYPTION=true
FEATURE_AUDIT_LOGGING=true
```

### 2. Netlify Environment Setup Script

```bash
#!/bin/bash
# scripts/setup-netlify-env.sh

echo "🔧 Setting up Netlify environment variables..."

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI not found. Installing..."
    npm install -g netlify-cli
fi

# Login to Netlify (if not already logged in)
netlify status || netlify login

# Set production environment variables
echo "📝 Setting production environment variables..."

netlify env:set NODE_ENV "production"
netlify env:set APP_NAME "College Vault"
netlify env:set APP_VERSION "1.0.0"

# Email configuration
read -p "Enter SMTP Host (e.g., smtp.gmail.com): " SMTP_HOST
netlify env:set SMTP_HOST "$SMTP_HOST"

read -p "Enter SMTP Port (587 for Gmail): " SMTP_PORT
netlify env:set SMTP_PORT "$SMTP_PORT"

read -p "Enter SMTP User (your email): " SMTP_USER
netlify env:set SMTP_USER "$SMTP_USER"

read -s -p "Enter SMTP Password (app password): " SMTP_PASS
echo
netlify env:set SMTP_PASS "$SMTP_PASS"

# Twilio configuration
read -p "Enter Twilio Account SID: " TWILIO_ACCOUNT_SID
netlify env:set TWILIO_ACCOUNT_SID "$TWILIO_ACCOUNT_SID"

read -s -p "Enter Twilio Auth Token: " TWILIO_AUTH_TOKEN
echo
netlify env:set TWILIO_AUTH_TOKEN "$TWILIO_AUTH_TOKEN"

read -p "Enter Twilio Phone Number (e.g., +1234567890): " TWILIO_PHONE_NUMBER
netlify env:set TWILIO_PHONE_NUMBER "$TWILIO_PHONE_NUMBER"

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 48)
netlify env:set JWT_SECRET "$JWT_SECRET"

echo "✅ Environment variables configured successfully!"
echo "🚀 Your app is ready for deployment!"
```

## Monitoring & Logging

### 1. Application Performance Monitoring

```typescript
// server/middleware/monitoring.ts
import { Request, Response, NextFunction } from 'express';

interface MetricsData {
  requests: number;
  errors: number;
  responseTime: number[];
  activeUsers: Set<string>;
}

const metrics: MetricsData = {
  requests: 0,
  errors: 0,
  responseTime: [],
  activeUsers: new Set()
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Track request
  metrics.requests++;
  
  // Track user activity
  const userId = req.headers.authorization;
  if (userId) {
    metrics.activeUsers.add(userId);
  }
  
  // Monitor response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    metrics.responseTime.push(duration);
    
    // Track errors
    if (res.statusCode >= 400) {
      metrics.errors++;
    }
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  
  next();
};

export const getMetrics = () => ({
  ...metrics,
  averageResponseTime: metrics.responseTime.length > 0 
    ? metrics.responseTime.reduce((a, b) => a + b, 0) / metrics.responseTime.length 
    : 0,
  activeUsersCount: metrics.activeUsers.size,
  errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0
});
```

### 2. Health Check Endpoint

```typescript
// server/routes/health.ts
import { RequestHandler } from 'express';
import { getMetrics } from '../middleware/monitoring';
import { testConnectivity } from '../services/productionOtpService';

export const handleHealthCheck: RequestHandler = async (req, res) => {
  try {
    const metrics = getMetrics();
    const connectivity = await testConnectivity();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV,
      database: {
        status: 'connected',
        type: 'SQLite'
      },
      services: {
        email: connectivity.email,
        sms: connectivity.sms
      },
      metrics: {
        requests: metrics.requests,
        errors: metrics.errors,
        errorRate: metrics.errorRate,
        averageResponseTime: metrics.averageResponseTime,
        activeUsers: metrics.activeUsersCount
      },
      resources: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
    
    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
};
```

### 3. Structured Logging

```typescript
// server/utils/logger.ts
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
  userId?: string;
  requestId?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logFile: string;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.logFile = path.join(process.cwd(), 'logs', 'app.log');
    this.ensureLogDirectory();
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    return LogLevel[level as keyof typeof LogLevel] || LogLevel.INFO;
  }

  private ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private writeLog(entry: LogEntry) {
    const logLine = JSON.stringify(entry) + '\n';
    
    // Console output
    console.log(logLine);
    
    // File output (in production)
    if (process.env.NODE_ENV === 'production') {
      fs.appendFileSync(this.logFile, logLine);
    }
  }

  error(message: string, meta?: any, userId?: string, requestId?: string) {
    if (this.logLevel >= LogLevel.ERROR) {
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message,
        meta,
        userId,
        requestId
      });
    }
  }

  warn(message: string, meta?: any, userId?: string, requestId?: string) {
    if (this.logLevel >= LogLevel.WARN) {
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message,
        meta,
        userId,
        requestId
      });
    }
  }

  info(message: string, meta?: any, userId?: string, requestId?: string) {
    if (this.logLevel >= LogLevel.INFO) {
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message,
        meta,
        userId,
        requestId
      });
    }
  }

  debug(message: string, meta?: any, userId?: string, requestId?: string) {
    if (this.logLevel >= LogLevel.DEBUG) {
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        meta,
        userId,
        requestId
      });
    }
  }
}

export const logger = new Logger();
```

## Security Best Practices

### 1. Security Headers Configuration

```typescript
// server/middleware/security.ts
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// Rate limiting
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API rate limiting (stricter)
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skip: (req) => req.ip === '127.0.0.1', // Skip localhost
  message: {
    error: 'API rate limit exceeded',
    retryAfter: 15 * 60 * 1000
  }
});

// Security headers
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'"
  ].join('; '));
  
  // Other security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Input sanitization
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };
  
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  
  next();
};
```

### 2. Vulnerability Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly scan
  workflow_dispatch:

jobs:
  dependency-check:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Run Snyk to check for vulnerabilities
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high

  code-quality:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: SonarCloud Scan
      uses: SonarSource/sonarcloud-github-action@master
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

## Troubleshooting

### Common Issues & Solutions

#### 1. Build Failures

```bash
# Check Node.js version
node --version  # Should be 18+

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript compilation
npm run typecheck

# Verify environment variables
netlify env:list
```

#### 2. Database Issues

```bash
# Check SQLite database
ls -la data/
sqlite3 data/app.db ".tables"

# Reset database (CAUTION: This deletes all data)
rm data/app.db
npm run start  # Will recreate with default user
```

#### 3. Email/SMS Service Issues

```bash
# Test email configuration
curl -X POST http://localhost:8080/api/auth/verify-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"password":"your-password"}'

# Check service status
curl http://localhost:8080/api/status
```

#### 4. Netlify Function Issues

```bash
# Test functions locally
netlify dev

# Check function logs
netlify functions:list
netlify logs
```

### Performance Optimization

#### 1. Bundle Analysis

```bash
# Analyze bundle size
npm install -g webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/spa/static/js/*.js
```

#### 2. Database Optimization

```sql
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_sessions_user_id ON otp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_sessions_expires_at ON otp_sessions(expires_at);
```

#### 3. Caching Strategy

```typescript
// server/middleware/cache.ts
import { Request, Response, NextFunction } from 'express';

export const cacheControl = (maxAge: number = 3600) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    next();
  };
};

// Usage
app.use('/api/health', cacheControl(60)); // Cache health checks for 1 minute
app.use('/static', cacheControl(86400)); // Cache static assets for 24 hours
```

---

## Summary

This comprehensive guide covers:

✅ **Docker containerization** with multi-stage builds and security  
✅ **Netlify deployment** with Functions and environment management  
✅ **CI/CD pipelines** with GitHub Actions and GitLab CI  
✅ **Security best practices** with headers, rate limiting, and vulnerability scanning  
✅ **Monitoring and logging** with structured logging and health checks  
✅ **Performance optimization** with caching and database indexing  
✅ **Troubleshooting guide** for common deployment issues  

**Developed by Chirag Poornamath**

For additional support or questions about this deployment guide, contact the developer.
