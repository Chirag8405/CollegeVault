import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { handleHealthCheck } from "./routes/demo";
import { handleLogin, handleRegister, handleVerifyToken, handleVerifyPasswordForDownload, handleVerifyDownloadOTP, handleUpdateProfile, handleChangePassword, handleDeleteAccount } from "./routes/productionAuth";
import {
  handleGetDocuments,
  handleUploadDocument,
  handleDeleteDocument,
  handleGetStorageInfo,
  handleGetFile
} from "./routes/productionDocuments";
import { initializeDatabase } from "./database/database";
import { validateProductionEnvironment, getEnvironmentConfig, getConfigurationInstructions } from "./services/environmentService";
import { testConnectivity } from "./services/productionOtpService";

export function createServer() {
  const app = express();

  // Initialize database
  try {
    initializeDatabase();
    console.log('✅ College Vault database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }

  // Validate environment
  try {
    validateProductionEnvironment();
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // File uploads (multer)
  const uploadDir = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const ext = path.extname(file.originalname) || '';
      cb(null, `${unique}${ext}`);
    }
  });
  const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/health", handleHealthCheck);

  // System status endpoint
  app.get("/api/status", async (req, res) => {
    try {
      const envConfig = getEnvironmentConfig();
      const connectivity = await testConnectivity();
      
      res.json({
        success: true,
        status: {
          environment: process.env.NODE_ENV || 'development',
          database: 'connected',
          configuration: {
            isConfigured: envConfig.isConfigured,
            missingVars: envConfig.missingEnvVars
          },
          services: {
            email: connectivity.email,
            sms: connectivity.sms,
            errors: connectivity.errors
          }
        },
        message: envConfig.isConfigured ? 
          'All services operational' : 
          'Some services require configuration'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'System status check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Configuration help endpoint
  app.get("/api/config-help", (req, res) => {
    const envConfig = getEnvironmentConfig();
    const instructions = getConfigurationInstructions();

    res.json({
      success: true,
      configured: envConfig.isConfigured,
      instructions,
      requiredVars: envConfig.requiredEnvVars,
      missingVars: envConfig.missingEnvVars
    });
  });

  // Authentication routes
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/register", handleRegister);
  app.get("/api/auth/verify", handleVerifyToken);
  app.put("/api/auth/profile", handleUpdateProfile);
  app.post("/api/auth/change-password", handleChangePassword);
  app.delete("/api/auth/delete-account", handleDeleteAccount);
  app.post("/api/auth/verify-password", handleVerifyPasswordForDownload);
  app.post("/api/auth/verify-download-otp", handleVerifyDownloadOTP);

  // Document management routes
  app.get("/api/documents", handleGetDocuments);
  app.post("/api/documents", upload.single('file'), handleUploadDocument);
  app.delete("/api/documents/:id", handleDeleteDocument);

  // Storage info route
  app.get("/api/storage", handleGetStorageInfo);

  // Files route
  app.get("/api/files/:id", handleGetFile);

  // Error handling middleware
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Endpoint not found'
    });
  });

  return app;
}
