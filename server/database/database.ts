import BetterSqlite3 from 'better-sqlite3';
import { User, Document } from '@shared/api';
import * as fs from 'fs';
import * as path from 'path';

// Database connection
let db: InstanceType<typeof BetterSqlite3>;

export interface DatabaseUser extends User {
  password: string;
}

export interface DatabaseDocument {
  id: string;
  user_id: string;
  name: string;
  type: string;
  semester: string;
  year: string;
  upload_date: string;
  size: string;
  is_secure: number;
  file_url: string | null;
  metadata?: string | null;
}

export interface OTPSession {
  id: string;
  user_id: string;
  otp_code: string;
  purpose: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

export const initializeDatabase = () => {
  try {
    // Create database directory if it doesn't exist
    const dbDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    const dbPath = path.join(dbDir, 'app.db');
    db = new BetterSqlite3(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    
    console.log('✅ College Vault database schema ready');
    
    // Create default admin user if no users exist
    createDefaultUser();
    
    return db;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

const createDefaultUser = () => {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    
    if (userCount.count === 0) {
      // Create default admin user
      const defaultUser = {
        id: 'chirag-admin-001',
        name: 'Chirag Poornamath',
        email: 'chiragpoornamath@collegedocvault.com',
        phone: '+918104073821',
        password: '$2b$10$Zr0lbs80oSwKxej0YwvTnu.VHiNTgt8mstYmNeiBZ4WGYbCVWuQ16', // SecurePass2024!
      };
      
      const stmt = db.prepare(`
        INSERT INTO users (id, name, email, phone, password)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(defaultUser.id, defaultUser.name, defaultUser.email, defaultUser.phone, defaultUser.password);
      console.log('✅ Admin user (Chirag Poornamath) created');
    }
  } catch (error) {
    console.error('❌ Failed to create default user:', error);
  }
};

// User operations
export const userService = {
  findById: (id: string): DatabaseUser | undefined => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as DatabaseUser | undefined;
  },

  findByEmail: (email: string): DatabaseUser | undefined => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE');
    return stmt.get(email) as DatabaseUser | undefined;
  },

  create: (user: Omit<DatabaseUser, 'created_at' | 'updated_at' | 'createdAt'>): DatabaseUser => {
    const stmt = db.prepare(`
      INSERT INTO users (id, name, email, phone, password)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(user.id, user.name, user.email, user.phone, user.password);
    
    return userService.findById(user.id)!;
  },

  update: (id: string, updates: Partial<DatabaseUser>): DatabaseUser | undefined => {
    const allowedFields = ['name', 'email', 'phone', 'password'];
    const setClause = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map(key => `${key} = ?`)
      .join(', ');
    
    if (setClause) {
      const values = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .map(key => updates[key as keyof DatabaseUser]);
      
      const stmt = db.prepare(`
        UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(...values, id);
    }
    
    return userService.findById(id);
  },

  delete: (id: string): boolean => {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  exists: (email: string): boolean => {
    const stmt = db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE');
    return !!stmt.get(email);
  }
};

// Document operations
export const documentService = {
  findById: (id: string): Document | undefined => {
    const stmt = db.prepare('SELECT * FROM documents WHERE id = ?');
    const row = stmt.get(id) as DatabaseDocument | undefined;
    
    if (!row) return undefined;
    
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type as any,
      semester: row.semester,
      year: row.year,
      uploadDate: row.upload_date,
      size: row.size,
      isSecure: !!row.is_secure,
      fileUrl: row.file_url || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  },

  findByUserId: (userId: string, filters?: {
    type?: string;
    semester?: string;
    year?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Document[] => {
    let query = 'SELECT * FROM documents WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (filters?.type && filters.type !== 'all') {
      query += ' AND type = ?';
      params.push(filters.type);
    }
    
    if (filters?.semester && filters.semester !== 'all') {
      query += ' AND semester = ?';
      params.push(filters.semester);
    }
    
    if (filters?.year && filters.year !== 'all') {
      query += ' AND year = ?';
      params.push(filters.year);
    }
    
    if (filters?.search) {
      query += ' AND (name LIKE ? OR metadata LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }
    
    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as DatabaseDocument[];
    
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type as any,
      semester: row.semester,
      year: row.year,
      uploadDate: row.upload_date,
      size: row.size,
      isSecure: !!row.is_secure,
      fileUrl: row.file_url || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  },

  create: (document: Omit<Document, 'created_at'>): Document => {
    const stmt = db.prepare(`
      INSERT INTO documents (id, user_id, name, type, semester, year, upload_date, size, is_secure, file_url, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      document.id,
      document.userId,
      document.name,
      document.type,
      document.semester,
      document.year,
      document.uploadDate,
      document.size,
      document.isSecure ? 1 : 0,
      document.fileUrl || null,
      document.metadata ? JSON.stringify(document.metadata) : null
    );
    
    return documentService.findById(document.id)!;
  },

  delete: (id: string, userId: string): boolean => {
    const stmt = db.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  deleteByUser: (userId: string): number => {
    const stmt = db.prepare('DELETE FROM documents WHERE user_id = ?');
    const result = stmt.run(userId);
    return result.changes;
  },

  getUserStorageStats: (userId: string): { documentsCount: number; totalSize: number } => {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(
        CASE 
          WHEN size LIKE '%KB%' THEN CAST(REPLACE(size, ' KB', '') AS REAL) * 1024
          WHEN size LIKE '%MB%' THEN CAST(REPLACE(size, ' MB', '') AS REAL) * 1024 * 1024
          WHEN size LIKE '%GB%' THEN CAST(REPLACE(size, ' GB', '') AS REAL) * 1024 * 1024 * 1024
          ELSE 0
        END
      ), 0) as total_size
      FROM documents WHERE user_id = ?
    `);
    
    const result = stmt.get(userId) as { count: number; total_size: number };
    
    return {
      documentsCount: result.count,
      totalSize: result.total_size
    };
  }
};

// OTP operations
export const otpService = {
  create: (session: Omit<OTPSession, 'id' | 'used' | 'created_at'>): string => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    const stmt = db.prepare(`
      INSERT INTO otp_sessions (id, user_id, otp_code, purpose, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, session.user_id, session.otp_code, session.purpose, session.expires_at);
    
    return id;
  },

  findValidSession: (userId: string, otpCode: string, purpose: string): OTPSession | undefined => {
    const stmt = db.prepare(`
      SELECT * FROM otp_sessions 
      WHERE user_id = ? AND otp_code = ? AND purpose = ? AND used = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    return stmt.get(userId, otpCode, purpose) as OTPSession | undefined;
  },

  markAsUsed: (id: string): boolean => {
    const stmt = db.prepare('UPDATE otp_sessions SET used = 1 WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  cleanup: (): number => {
    // Remove expired and used OTP sessions
    const stmt = db.prepare(`
      DELETE FROM otp_sessions 
      WHERE used = 1 OR expires_at < datetime('now')
    `);
    
    const result = stmt.run();
    return result.changes;
  },

  deleteUserSessions: (userId: string, purpose?: string): number => {
    let query = 'DELETE FROM otp_sessions WHERE user_id = ?';
    const params: any[] = [userId];
    
    if (purpose) {
      query += ' AND purpose = ?';
      params.push(purpose);
    }
    
    const stmt = db.prepare(query);
    const result = stmt.run(...params);
    return result.changes;
  }
};

// Cleanup function for expired sessions
export const cleanupExpiredSessions = () => {
  const cleaned = otpService.cleanup();
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired OTP sessions`);
  }
};

// Auto cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

export const getDatabase = () => db;
