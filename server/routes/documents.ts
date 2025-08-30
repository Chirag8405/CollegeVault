import { RequestHandler } from "express";
import {
  Document,
  DocumentResponse,
  UploadDocumentRequest,
  GetDocumentsQuery,
  VerifyPasswordRequest,
  SendOTPRequest,
  VerifyOTPRequest,
  SecurityResponse,
  StorageResponse,
  StorageInfo
} from "@shared/api";
import { findUserById } from './auth';
import { sendOTPToEmailAndPhone, sendOTPDevelopment } from '../services/otpService';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

// In-memory database - replace with actual database in production
let documents: Document[] = [];
// Map documentId -> stored file details (dev mode)
const storedFiles: Record<string, { filePath: string; mimeType: string; originalName: string }> = {};

export const deleteUserDocuments = (userId: string) => {
  documents = documents.filter(doc => doc.userId !== userId);
};

// OTP storage for secure downloads
const otps: { [documentId: string]: { code: string; expiresAt: number; contact: string } } = {};

// Removed document passwords - using OTP-only verification

// Generate random OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// File size calculator (mock implementation)
const getFileSizeString = (fileSizeBytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = fileSizeBytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
};

const getUserFromToken = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    if (decoded.exp < Date.now()) {
      return null;
    }

    return decoded.userId;
  } catch {
    return null;
  }
};

export const handleGetDocuments: RequestHandler = (req, res) => {
  try {
    const userId = getUserFromToken(req.headers.authorization);
    if (!userId) {
      const response: DocumentResponse = {
        success: false,
        message: 'Authentication required'
      };
      return res.status(401).json(response);
    }

    const { type, semester, year, search, limit = 50, offset = 0 }: GetDocumentsQuery = req.query as any;

    let filteredDocuments = documents.filter(doc => doc.userId === userId);

    // Apply filters
    if (type && type !== 'all') {
      filteredDocuments = filteredDocuments.filter(doc => doc.type === type);
    }

    if (semester && semester !== 'all') {
      filteredDocuments = filteredDocuments.filter(doc => doc.semester === semester);
    }

    if (year && year !== 'all') {
      filteredDocuments = filteredDocuments.filter(doc => doc.year === year);
    }

    if (search) {
      filteredDocuments = filteredDocuments.filter(doc => 
        doc.name.toLowerCase().includes(search.toLowerCase()) ||
        doc.metadata?.description?.toLowerCase().includes(search.toLowerCase()) ||
        doc.metadata?.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // Apply pagination
    const paginatedDocuments = filteredDocuments.slice(
      parseInt(offset.toString()), 
      parseInt(offset.toString()) + parseInt(limit.toString())
    );

    const response: DocumentResponse = {
      success: true,
      documents: paginatedDocuments,
      message: `Found ${filteredDocuments.length} documents`
    };

    res.json(response);
  } catch (error) {
    console.error('Get documents error:', error);
    const response: DocumentResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const handleUploadDocument: RequestHandler = (req, res) => {
  try {
    const userId = getUserFromToken(req.headers.authorization);
    if (!userId) {
      const response: DocumentResponse = {
        success: false,
        message: 'Authentication required'
      };
      return res.status(401).json(response);
    }

    const anyReq = req as any;
    const uploadedFile: any = anyReq.file;

    const { name, type, semester, year, isSecure, metadata }: any = req.body;

    if (!name || !type || !semester || !year) {
      const response: DocumentResponse = {
        success: false,
        message: 'Missing required fields: name, type, semester, and year are required'
      };
      return res.status(400).json(response);
    }

    // Validate file name
    if (name.trim().length < 3) {
      const response: DocumentResponse = {
        success: false,
        message: 'Document name must be at least 3 characters long'
      };
      return res.status(400).json(response);
    }

    // Check for duplicate document names for this user
    const existingDoc = documents.find(doc =>
      doc.userId === userId &&
      doc.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (existingDoc) {
      const response: DocumentResponse = {
        success: false,
        message: 'A document with this name already exists. Please choose a different name.'
      };
      return res.status(409).json(response);
    }

    // Generate document ID
    const documentId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Determine file details
    let sizeString = '0 B';
    let parsedMetadata: Document['metadata'] = undefined;
    try {
      if (metadata) parsedMetadata = JSON.parse(typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
    } catch {}

    if (uploadedFile) {
      sizeString = getFileSizeString(uploadedFile.size);
      storedFiles[documentId] = {
        filePath: uploadedFile.path,
        mimeType: uploadedFile.mimetype || 'application/octet-stream',
        originalName: uploadedFile.originalname || name || 'download'
      };
      parsedMetadata = {
        ...(parsedMetadata || {}),
        description: parsedMetadata?.description,
        tags: parsedMetadata?.tags,
        mimeType: uploadedFile.mimetype,
        originalName: uploadedFile.originalname
      } as any;
    }

    const newDocument: Document = {
      id: documentId,
      name: name.trim(),
      type,
      semester,
      year,
      uploadDate: new Date().toISOString().split('T')[0],
      size: sizeString,
      isSecure: isSecure === 'true' || isSecure === true,
      userId,
      fileUrl: (uploadedFile && uploadedFile.path) ? uploadedFile.path : `/api/files/${documentId}`,
      metadata: parsedMetadata
    };

    documents.push(newDocument);

    const response: DocumentResponse = {
      success: true,
      document: newDocument,
      message: `Document "${name}" uploaded successfully${isSecure ? '. Password protection enabled.' : ''}`
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Upload document error:', error);
    const response: DocumentResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const handleDeleteDocument: RequestHandler = (req, res) => {
  try {
    const userId = getUserFromToken(req.headers.authorization);
    if (!userId) {
      const response: DocumentResponse = {
        success: false,
        message: 'Authentication required'
      };
      return res.status(401).json(response);
    }

    const { id } = req.params;
    const documentIndex = documents.findIndex(doc => doc.id === id && doc.userId === userId);

    if (documentIndex === -1) {
      const response: DocumentResponse = {
        success: false,
        message: 'Document not found'
      };
      return res.status(404).json(response);
    }

    const deletedDocument = documents[documentIndex];
    documents.splice(documentIndex, 1);

    // Clean up related data
    delete otps[id];

    const response: DocumentResponse = {
      success: true,
      document: deletedDocument,
      message: 'Document deleted successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Delete document error:', error);
    const response: DocumentResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};



export const handleSendOTP: RequestHandler = async (req, res) => {
  try {
    const userId = getUserFromToken(req.headers.authorization);
    if (!userId) {
      const response: SecurityResponse = {
        success: false,
        message: 'Authentication required'
      };
      return res.status(401).json(response);
    }

    const { documentId }: SendOTPRequest = req.body;

    if (!documentId) {
      const response: SecurityResponse = {
        success: false,
        message: 'Document ID is required'
      };
      return res.status(400).json(response);
    }

    const document = documents.find(doc => doc.id === documentId && doc.userId === userId);
    if (!document) {
      const response: SecurityResponse = {
        success: false,
        message: 'Document not found'
      };
      return res.status(404).json(response);
    }

    if (!document.isSecure) {
      const response: SecurityResponse = {
        success: false,
        message: 'This document does not require OTP verification'
      };
      return res.status(400).json(response);
    }

    // Get user info to send OTP to both email and phone
    const user = findUserById(userId);
    if (!user) {
      const response: SecurityResponse = {
        success: false,
        message: 'User not found'
      };
      return res.status(404).json(response);
    }

    // Generate random OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otps[documentId] = { code: otp, expiresAt, contact: user.email };

    // Send OTP via email and SMS
    const otpResult = await sendOTPToEmailAndPhone(
      user.email,
      user.phone,
      otp,
      `document access (${document.name})`
    );

    // Fallback to console logging if services not configured
    if (!otpResult.success) {
      console.log('=== DOCUMENT OTP (DEVELOPMENT) ===');
      console.log(`Document: ${document.name} (${documentId})`);
      sendOTPDevelopment(user.email, user.phone, otp, 'document access');
    }

    const response: SecurityResponse = {
      success: true,
      otpSent: true,
      message: otpResult.success
        ? `${otpResult.message} for document access.`
        : `OTP generated for document access. Check console for development OTP (configure SMTP/Twilio for real sending).`
    };

    res.json(response);
  } catch (error) {
    console.error('Send OTP error:', error);
    const response: SecurityResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const handleVerifyOTP: RequestHandler = (req, res) => {
  try {
    const userId = getUserFromToken(req.headers.authorization);
    if (!userId) {
      const response: SecurityResponse = {
        success: false,
        message: 'Authentication required'
      };
      return res.status(401).json(response);
    }

    const { documentId, otp }: VerifyOTPRequest = req.body;

    const document = documents.find(doc => doc.id === documentId && doc.userId === userId);
    if (!document) {
      const response: SecurityResponse = {
        success: false,
        message: 'Document not found'
      };
      return res.status(404).json(response);
    }

    const storedOtp = otps[documentId];
    if (!storedOtp) {
      const response: SecurityResponse = {
        success: false,
        message: 'No OTP found. Please request a new one.'
      };
      return res.status(400).json(response);
    }

    if (Date.now() > storedOtp.expiresAt) {
      delete otps[documentId];
      const response: SecurityResponse = {
        success: false,
        message: 'OTP expired. Please request a new one.'
      };
      return res.status(400).json(response);
    }

    if (storedOtp.code !== otp) {
      const response: SecurityResponse = {
        success: false,
        message: 'Invalid OTP'
      };
      return res.status(401).json(response);
    }

    // OTP verified, clean up and generate download URL
    delete otps[documentId];
    
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const downloadUrl = `${document.fileUrl}?token=${Buffer.from(`${documentId}:${Date.now()}`).toString('base64')}`;

    const response: SecurityResponse = {
      success: true,
      downloadUrl,
      expiresAt,
      message: 'OTP verified successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Verify OTP error:', error);
    const response: SecurityResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const handleGetStorageInfo: RequestHandler = (req, res) => {
  try {
    const userId = getUserFromToken(req.headers.authorization);
    if (!userId) {
      const response: StorageResponse = {
        success: false,
        message: 'Authentication required'
      };
      return res.status(401).json(response);
    }

    const userDocuments = documents.filter(doc => doc.userId === userId);
    const totalSize = userDocuments.length * 2.5 * 1024 * 1024; // Mock: avg 2.5MB per doc
    const maxSize = 5 * 1024 * 1024 * 1024; // 5GB limit
    const percentage = Math.round((totalSize / maxSize) * 100);

    const storageInfo: StorageInfo = {
      used: totalSize,
      total: maxSize,
      percentage: Math.min(percentage, 100),
      documentsCount: userDocuments.length
    };

    const response: StorageResponse = {
      success: true,
      storage: storageInfo,
      message: 'Storage info retrieved successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Get storage info error:', error);
    const response: StorageResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

// File download handler - streams the actual uploaded file when available
export const handleGetFile: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const doc = documents.find(d => d.id === id);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // For secure documents, require a token parameter (simple check)
    if (doc.isSecure) {
      const token = (req.query.token as string) || '';
      if (!token) {
        return res.status(403).json({ success: false, message: 'Access token required for secure downloads' });
      }
      try {
        const decoded = Buffer.from(token, 'base64').toString();
        const [docId] = decoded.split(':');
        if (docId !== id) {
          return res.status(403).json({ success: false, message: 'Invalid access token' });
        }
      } catch {
        return res.status(403).json({ success: false, message: 'Invalid access token' });
      }
    }


    // Prefer streaming from the stored absolute file path when available
    if (doc.fileUrl && fs.existsSync(doc.fileUrl)) {
      try {
        const orig = (doc.metadata as any)?.originalName || doc.name;
        const mime = (doc.metadata as any)?.mimeType || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename="${orig}"`);
        return fs.createReadStream(doc.fileUrl).pipe(res);
      } catch (e) {
        // fall through to storedFiles
      }
    }

    // Fallback to in-memory storedFiles map (dev mode)
    const stored = storedFiles[id];
    if (stored && stored.filePath && fs.existsSync(stored.filePath)) {
      try {
        const filename = (doc.metadata as any)?.originalName || stored.originalName || doc.name;
        res.setHeader('Content-Type', stored.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        const stream = fs.createReadStream(stored.filePath);
        stream.on('error', () => res.status(500).json({ success: false, message: 'Failed to read file' }));
        return stream.pipe(res);
      } catch (e) {
        // fall through to generated content
      }
    }

    // Last resort: generated placeholder text file
    const safeName = doc.name.replace(/[^a-zA-Z0-9-_\. ]/g, '').trim() || 'document';
    const filename = `${safeName}.txt`;
    const contentLines = [
      'College Vault Export',
      '--------------------------------',
      `Name: ${doc.name}`,
      `Type: ${doc.type}`,
      `Semester: ${doc.semester}`,
      `Year: ${doc.year}`,
      `Uploaded: ${new Date(doc.uploadDate).toLocaleString()}`,
      `Size: ${doc.size}`,
      `Secure: ${doc.isSecure ? 'Yes' : 'No'}`,
      '',
      'This is a generated file representing your document.',
      'In a real deployment, this endpoint would stream the actual file contents.'
    ];
    const fileBuffer = Buffer.from(contentLines.join('\n'), 'utf8');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(fileBuffer);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ success: false, message: 'Failed to download file' });
  }
};
