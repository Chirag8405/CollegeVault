import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { handleHealthCheck } from "./routes/demo";
import { handleLogin, handleRegister, handleVerifyToken, handleVerifyPasswordForDownload, handleVerifyDownloadOTP, handleUpdateProfile, handleChangePassword, handleDeleteAccount } from "./routes/auth";
import { handleDebugTest, handleDebugAuth } from "./routes/debug";
import {
  handleGetDocuments,
  handleUploadDocument,
  handleDeleteDocument,
  handleSendOTP,
  handleVerifyOTP,
  handleGetStorageInfo,
  handleGetFile
} from "./routes/documents";

export function createServer() {
  const app = express();

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

  // Debug routes (only in development)
  if (process.env.NODE_ENV !== 'production') {
    app.get("/api/debug/test", handleDebugTest);
    app.post("/api/debug/auth", handleDebugAuth);
  }

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

  // Security routes
  app.post("/api/security/send-otp", handleSendOTP);
  app.post("/api/security/verify-otp", handleVerifyOTP);

  // Storage info route
  app.get("/api/storage", handleGetStorageInfo);

  // Files route
  app.get("/api/files/:id", handleGetFile);

  // OTP service status endpoint
  app.get("/api/otp-status", (req, res) => {
    const { getServiceConfig, getOTPServiceStatus, getConfigurationInstructions } = require("./services/configService");
    const config = getServiceConfig();
    const status = getOTPServiceStatus();
    const instructions = getConfigurationInstructions();

    res.json({
      success: true,
      config,
      status,
      instructions: instructions || "All services configured!",
      message: "OTP service status retrieved successfully"
    });
  });

  return app;
}
