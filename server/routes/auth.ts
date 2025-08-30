import { RequestHandler } from "express";
import { LoginRequest, RegisterRequest, AuthResponse, User, VerifyPasswordForDownloadRequest, UpdateProfileRequest, ChangePasswordRequest } from "@shared/api";
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { sendOTPToEmailAndPhone, sendOTPDevelopment } from '../services/otpService';
import { getOTPServiceStatus, getConfigurationInstructions } from '../services/configService';

// Simple file-based persistence (in production, use a proper database)
const USERS_FILE = path.join(process.cwd(), 'users.json');

const loadUsers = (): User[] => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('Could not load users file, starting fresh');
  }

  // Default users if file doesn't exist
  return [
    {
      id: 'test-user-1',
      name: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      password: '$2b$10$rUOPpfTKWpYXa9FV4zVQ9..J5LIxJXJ0JVJgBKJY9QJfJBqfzK9CG', // "password123"
      createdAt: '2024-01-01T00:00:00Z'
    }
  ];
};

const saveUsers = () => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Could not save users file:', error);
  }
};

// In-memory database - replace with actual database in production
export const users: User[] = loadUsers();

// OTP storage for document downloads
const downloadOTPs: { [userId: string]: { code: string; expiresAt: number } } = {};

// Helper function to find user by ID
export const findUserById = (id: string): User | undefined => {
  return users.find(user => user.id === id);
};

// Helper function to find user by email
export const findUserByEmail = (email: string): User | undefined => {
  return users.find(user => user.email.toLowerCase() === email.toLowerCase());
};

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
  // At least 6 characters
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
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

// Verify password
const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const handleLogin: RequestHandler = async (req, res) => {
  try {
    console.log('Login request received:', { email: req.body?.email });

    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

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
    const user = findUserByEmail(email);
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
    console.log('Registration request received:', { email: req.body?.email, name: req.body?.name });

    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

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
    const existingUser = users.find(u =>
      u.email.toLowerCase() === email.toLowerCase() ||
      u.phone === phone.replace(/\D/g, '') // Compare digits only
    );

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        const response: AuthResponse = {
          success: false,
          message: 'An account already exists with this email address'
        };
        return res.status(409).json(response);
      } else {
        const response: AuthResponse = {
          success: false,
          message: 'An account already exists with this phone number'
        };
        return res.status(409).json(response);
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser: User = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    // Store user
    users.push(newUser);
    saveUsers();

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
    const user = findUserById(decoded.userId);
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
    if (email && users.some(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== user.id)) {
      return res.status(409).json({ success: false, message: 'An account already exists with this email address' } as AuthResponse);
    }
    if (phone && users.some(u => u.phone === phone && u.id !== user.id)) {
      return res.status(409).json({ success: false, message: 'An account already exists with this phone number' } as AuthResponse);
    }
    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (phone) user.phone = phone.trim();
    saveUsers();
    const { password: _pw, ...userWithoutPassword } = user;
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
    const user = findUserById(decoded.userId);
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
    user.password = await hashPassword(newPassword);
    saveUsers();
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
    const userIndex = users.findIndex(u => u.id === decoded.userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' } as AuthResponse);
    }
    const user = users[userIndex];
    users.splice(userIndex, 1);
    saveUsers();
    try {
      const { deleteUserDocuments } = require('./documents');
      if (typeof deleteUserDocuments === 'function') deleteUserDocuments(user.id);
    } catch {}
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
    const user = findUserById(decoded.userId);
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

    // Generate OTP for document download
    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    downloadOTPs[user.id] = { code: otp, expiresAt };
    console.log('Generated OTP for document download:', otp);
    console.log('📊 OTP Service Status:', getOTPServiceStatus());

    // Send OTP via email and SMS
    const otpResult = await sendOTPToEmailAndPhone(user.email, user.phone, otp, 'document download');

    // Fallback to console logging if services not configured
    if (!otpResult.success) {
      console.log(getConfigurationInstructions());
      sendOTPDevelopment(user.email, user.phone, otp, 'document download');
    }

    const response: AuthResponse = {
      success: true,
      message: otpResult.success
        ? otpResult.message
        : `Password verified. OTP sent for document download. Check console for development OTP (configure SMTP/Twilio for real sending).`
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
    const user = findUserById(decoded.userId);
    if (!user) {
      const response: AuthResponse = {
        success: false,
        message: 'User not found'
      };
      return res.status(404).json(response);
    }

    // Check OTP
    const storedOTP = downloadOTPs[user.id];
    if (!storedOTP) {
      const response: AuthResponse = {
        success: false,
        message: 'No OTP found. Please verify your password first.'
      };
      return res.status(400).json(response);
    }

    if (Date.now() > storedOTP.expiresAt) {
      delete downloadOTPs[user.id];
      const response: AuthResponse = {
        success: false,
        message: 'OTP expired. Please verify your password again.'
      };
      return res.status(400).json(response);
    }

    if (storedOTP.code !== otp) {
      const response: AuthResponse = {
        success: false,
        message: 'Invalid OTP'
      };
      return res.status(401).json(response);
    }

    // OTP verified, clean up
    delete downloadOTPs[user.id];

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
    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

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

      // Find user
      const user = users.find(u => u.id === decoded.userId);
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
