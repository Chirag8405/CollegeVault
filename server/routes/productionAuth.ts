import { RequestHandler } from "express";
import { LoginRequest, RegisterRequest, AuthResponse, User, VerifyPasswordForDownloadRequest, UpdateProfileRequest, ChangePasswordRequest } from "@shared/api";
import * as bcrypt from 'bcrypt';
import { userService, otpService } from '../database/database';
import { sendOTPToEmailAndPhone } from '../services/productionOtpService';
import { validateProductionEnvironment, getEnvironmentConfig } from '../services/environmentService';

// Validate environment on module load
try {
  validateProductionEnvironment();
} catch (error) {
  console.error('Environment validation failed:', error);
  // In production, this should stop the application
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Email validation helper
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone validation helper
const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

// Password validation helper
const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

// Generate random OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Mock JWT token generation (in production, use a proper JWT library)
const generateToken = (user: User): string => {
  return Buffer.from(JSON.stringify({ 
    userId: user.id, 
    email: user.email,
    name: user.name,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  })).toString('base64');
};

// Hash password
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12; // Increased for production
  return bcrypt.hash(password, saltRounds);
};

// Verify password
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const handleLogin: RequestHandler = async (req, res) => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      const response: AuthResponse = {
        success: false,
        message: 'Email and password are required'
      };
      return res.status(400).json(response);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      const response: AuthResponse = {
        success: false,
        message: 'Please enter a valid email address'
      };
      return res.status(400).json(response);
    }

    // Find user by email
    const user = userService.findByEmail(email);
    if (!user) {
      const response: AuthResponse = {
        success: false,
        message: 'Invalid email or password'
      };
      return res.status(401).json(response);
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      const response: AuthResponse = {
        success: false,
        message: 'Invalid email or password'
      };
      return res.status(401).json(response);
    }

    // Generate authentication token
    const token = generateToken(user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    const response: AuthResponse = {
      success: true,
      user: userWithoutPassword as User,
      token,
      message: 'Login successful'
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    const response: AuthResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const handleRegister: RequestHandler = async (req, res) => {
  try {
    const { name, email, phone, password }: RegisterRequest = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
      const response: AuthResponse = {
        success: false,
        message: 'Name, email, phone number, and password are required'
      };
      return res.status(400).json(response);
    }

    // Validate name
    if (name.trim().length < 2) {
      const response: AuthResponse = {
        success: false,
        message: 'Name must be at least 2 characters long'
      };
      return res.status(400).json(response);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      const response: AuthResponse = {
        success: false,
        message: 'Please enter a valid email address'
      };
      return res.status(400).json(response);
    }

    // Validate phone format
    if (!isValidPhone(phone)) {
      const response: AuthResponse = {
        success: false,
        message: 'Please enter a valid phone number'
      };
      return res.status(400).json(response);
    }

    // Validate password
    if (!isValidPassword(password)) {
      const response: AuthResponse = {
        success: false,
        message: 'Password must be at least 6 characters long'
      };
      return res.status(400).json(response);
    }

    // Check if user already exists
    if (userService.exists(email)) {
      const response: AuthResponse = {
        success: false,
        message: 'An account already exists with this email address'
      };
      return res.status(409).json(response);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = userService.create({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
    });

    // Generate authentication token
    const token = generateToken(newUser);

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;

    const response: AuthResponse = {
      success: true,
      user: userWithoutPassword as User,
      token,
      message: 'Account created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    const response: AuthResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const handleUpdateProfile: RequestHandler = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No valid token provided' } as AuthResponse);
    }
    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const user = userService.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid token' } as AuthResponse);
    }
    const { name, email, phone }: UpdateProfileRequest = req.body;
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' } as AuthResponse);
    }
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number' } as AuthResponse);
    }
    if (email && userService.exists(email) && user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(409).json({ success: false, message: 'An account already exists with this email address' } as AuthResponse);
    }
    const updated = userService.update(user.id, {
      ...(name ? { name: name.trim() } : {}),
      ...(email ? { email: email.toLowerCase().trim() } : {}),
      ...(phone ? { phone: phone.trim() } : {}),
    });
    const { password: _pw, ...userWithoutPassword } = updated!;
    return res.json({ success: true, user: userWithoutPassword as User, message: 'Profile updated successfully' } as AuthResponse);
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' } as AuthResponse);
  }
};

export const handleChangePassword: RequestHandler = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No valid token provided' } as AuthResponse);
    }
    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const user = userService.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid token' } as AuthResponse);
    }
    const { currentPassword, newPassword }: ChangePasswordRequest = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' } as AuthResponse);
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' } as AuthResponse);
    }
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' } as AuthResponse);
    }
    userService.update(user.id, { password: await hashPassword(newPassword) });
    return res.json({ success: true, message: 'Password changed successfully' } as AuthResponse);
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' } as AuthResponse);
  }
};

export const handleDeleteAccount: RequestHandler = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No valid token provided' } as AuthResponse);
    }
    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const user = userService.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' } as AuthResponse);
    }
    // Delete user documents first
    const { documentService } = require('../database/database');
    if (documentService && typeof documentService.deleteByUser === 'function') {
      documentService.deleteByUser(user.id);
    }
    userService.delete(user.id);
    return res.json({ success: true, message: 'Account deleted successfully' } as AuthResponse);
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' } as AuthResponse);
  }
};

export const handleVerifyPasswordForDownload: RequestHandler = async (req, res) => {
  try {
    const { password }: VerifyPasswordForDownloadRequest = req.body;

    if (!password) {
      const response: AuthResponse = {
        success: false,
        message: 'Password is required'
      };
      return res.status(400).json(response);
    }

    // Get user from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: AuthResponse = {
        success: false,
        message: 'No valid token provided'
      };
      return res.status(401).json(response);
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      const response: AuthResponse = {
        success: false,
        message: 'Invalid token'
      };
      return res.status(401).json(response);
    }

    // Check expiration
    if (decoded.exp < Date.now()) {
      const response: AuthResponse = {
        success: false,
        message: 'Token expired'
      };
      return res.status(401).json(response);
    }

    // Find user
    const user = userService.findById(decoded.userId);
    if (!user) {
      const response: AuthResponse = {
        success: false,
        message: 'User not found'
      };
      return res.status(404).json(response);
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      const response: AuthResponse = {
        success: false,
        message: 'Invalid password'
      };
      return res.status(401).json(response);
    }

    // Check if environment is configured for OTP
    const envConfig = getEnvironmentConfig();
    if (!envConfig.isConfigured) {
      const response: AuthResponse = {
        success: false,
        message: 'OTP services are not configured. Please contact system administrator.'
      };
      return res.status(503).json(response);
    }

    // Generate OTP for document download
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    // Store OTP session in database
    otpService.create({
      user_id: user.id,
      otp_code: otp,
      purpose: 'document_download',
      expires_at: expiresAt
    });

    // Send OTP via email and SMS
    const otpResult = await sendOTPToEmailAndPhone(user.email, user.phone, otp, 'document download');

    if (!otpResult.success) {
      const response: AuthResponse = {
        success: false,
        message: otpResult.message || 'Failed to send OTP. Please try again later.'
      };
      return res.status(500).json(response);
    }

    const response: AuthResponse = {
      success: true,
      message: otpResult.message
    };

    res.json(response);
  } catch (error) {
    console.error('Password verification error:', error);
    const response: AuthResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const handleVerifyDownloadOTP: RequestHandler = (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      const response: AuthResponse = {
        success: false,
        message: 'OTP is required'
      };
      return res.status(400).json(response);
    }

    // Get user from token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: AuthResponse = {
        success: false,
        message: 'No valid token provided'
      };
      return res.status(401).json(response);
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      const response: AuthResponse = {
        success: false,
        message: 'Invalid token'
      };
      return res.status(401).json(response);
    }

    // Check expiration
    if (decoded.exp < Date.now()) {
      const response: AuthResponse = {
        success: false,
        message: 'Token expired'
      };
      return res.status(401).json(response);
    }

    // Find user
    const user = userService.findById(decoded.userId);
    if (!user) {
      const response: AuthResponse = {
        success: false,
        message: 'User not found'
      };
      return res.status(404).json(response);
    }

    // Find valid OTP session
    const otpSession = otpService.findValidSession(user.id, otp, 'document_download');
    if (!otpSession) {
      const response: AuthResponse = {
        success: false,
        message: 'Invalid or expired OTP. Please verify your password again.'
      };
      return res.status(400).json(response);
    }

    // Mark OTP as used
    otpService.markAsUsed(otpSession.id);

    const response: AuthResponse = {
      success: true,
      message: 'OTP verified successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Download OTP verification error:', error);
    const response: AuthResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const handleVerifyToken: RequestHandler = (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: AuthResponse = {
        success: false,
        message: 'No valid token provided'
      };
      return res.status(401).json(response);
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      
      // Check expiration
      if (decoded.exp < Date.now()) {
        const response: AuthResponse = {
          success: false,
          message: 'Token expired'
        };
        return res.status(401).json(response);
      }

      // Find user in database
      const user = userService.findById(decoded.userId);
      if (!user) {
        const response: AuthResponse = {
          success: false,
          message: 'User not found'
        };
        return res.status(404).json(response);
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;

      const response: AuthResponse = {
        success: true,
        user: userWithoutPassword as User,
        message: 'Token valid'
      };

      res.json(response);
    } catch {
      const response: AuthResponse = {
        success: false,
        message: 'Invalid token'
      };
      res.status(401).json(response);
    }
  } catch (error) {
    console.error('Token verification error:', error);
    const response: AuthResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};
