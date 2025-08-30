import { RequestHandler } from "express";
import fs from 'fs';
import {
  Document,
  DocumentResponse,
  UploadDocumentRequest,
  GetDocumentsQuery,
  StorageResponse,
  StorageInfo
} from "@shared/api";
import { userService, documentService } from '../database/database';

// File size calculator
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

    const filters = {
      type: type && type !== 'all' ? type : undefined,
      semester: semester && semester !== 'all' ? semester : undefined,
      year: year && year !== 'all' ? year : undefined,
      search: search || undefined,
      limit: parseInt(limit.toString()),
      offset: parseInt(offset.toString())
    };

    const documents = documentService.findByUserId(userId, filters);

    const response: DocumentResponse = {
      success: true,
      documents,
      message: `Found ${documents.length} documents`
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
    const userDocs = documentService.findByUserId(userId);
    const existingDoc = userDocs.find(doc => 
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

    let sizeString = '0 B';
    let parsedMetadata: Document['metadata'] = undefined;
    try {
      if (metadata) parsedMetadata = JSON.parse(typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
    } catch {}

    let filePath: string | undefined;
    if (uploadedFile) {
      sizeString = getFileSizeString(uploadedFile.size);
      filePath = uploadedFile.path;
      parsedMetadata = {
        ...(parsedMetadata || {}),
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
      fileUrl: filePath || `/api/files/${documentId}`,
      metadata: parsedMetadata
    };

    const createdDocument = documentService.create(newDocument);

    const response: DocumentResponse = {
      success: true,
      document: createdDocument,
      message: `Document "${name}" uploaded successfully${isSecure ? '. Security protection enabled.' : ''}`
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
    
    // Find document to verify ownership
    const document = documentService.findById(id);
    if (!document || document.userId !== userId) {
      const response: DocumentResponse = {
        success: false,
        message: 'Document not found'
      };
      return res.status(404).json(response);
    }

    // Delete document
    const success = documentService.delete(id, userId);
    if (!success) {
      const response: DocumentResponse = {
        success: false,
        message: 'Failed to delete document'
      };
      return res.status(500).json(response);
    }

    const response: DocumentResponse = {
      success: true,
      document,
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

    const stats = documentService.getUserStorageStats(userId);
    const maxSize = 5 * 1024 * 1024 * 1024; // 5GB limit
    const percentage = Math.round((stats.totalSize / maxSize) * 100);

    const storageInfo: StorageInfo = {
      used: stats.totalSize,
      total: maxSize,
      percentage: Math.min(percentage, 100),
      documentsCount: stats.documentsCount
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

// File download handler for production - streams a generated file
export const handleGetFile: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const doc = documentService.findById(id);

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Require token for secure documents
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

    if (doc.fileUrl && fs.existsSync(doc.fileUrl)) {
      try {
        const orig = (doc.metadata as any)?.originalName || doc.name;
        const mime = (doc.metadata as any)?.mimeType || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename="${orig}"`);
        return fs.createReadStream(doc.fileUrl).pipe(res);
      } catch (e) {
        // fall through
      }
    }

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
    res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
    res.status(200).send(fileBuffer);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ success: false, message: 'Failed to download file' });
  }
};
