/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Application response types for College Vault
 * Developed by Chirag Poornamath
 */

/**
 * Document types for College Vault
 */
export interface Document {
  id: string;
  name: string;
  type: 'certificate' | 'fee-receipt' | 'transcript' | 'id-card' | 'other';
  semester: string;
  year: string;
  uploadDate: string;
  size: string;
  isSecure: boolean;
  userId: string;
  fileUrl?: string;
  metadata?: {
    tags?: string[];
    description?: string;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  createdAt: string;
}

/**
 * Authentication API types
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface VerifyPasswordForDownloadRequest {
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Document API types
 */
export interface UploadDocumentRequest {
  name: string;
  type: Document['type'];
  semester: string;
  year: string;
  isSecure: boolean;
  metadata?: Document['metadata'];
}

export interface DocumentResponse {
  success: boolean;
  document?: Document;
  documents?: Document[];
  message?: string;
}

export interface GetDocumentsQuery {
  type?: string;
  semester?: string;
  year?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Security API types
 */
export interface VerifyPasswordRequest {
  documentId: string;
  password: string;
}

export interface SendOTPRequest {
  documentId: string;
}

export interface VerifyOTPRequest {
  documentId: string;
  otp: string;
}

export interface SecurityResponse {
  success: boolean;
  downloadUrl?: string;
  otpSent?: boolean;
  expiresAt?: string;
  message?: string;
}

/**
 * Storage info types
 */
export interface StorageInfo {
  used: number; // in bytes
  total: number; // in bytes
  percentage: number;
  documentsCount: number;
}

export interface StorageResponse {
  success: boolean;
  storage?: StorageInfo;
  message?: string;
}

/**
 * General API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
