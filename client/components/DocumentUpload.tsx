import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UploadDocumentRequest, DocumentResponse } from '@shared/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  X,
  Shield,
  CheckCircle,
  AlertCircle,
  Award,
  CreditCard,
  BookOpen,
  User
} from "lucide-react";
import { toast } from '@/hooks/use-toast';

interface DocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: () => void; // Changed to just trigger refresh
}

const documentTypes = [
  { value: 'certificate', label: 'Certificate', icon: Award },
  { value: 'fee-receipt', label: 'Fee Receipt', icon: CreditCard },
  { value: 'transcript', label: 'Transcript', icon: BookOpen },
  { value: 'id-card', label: 'ID Card', icon: User },
  { value: 'other', label: 'Other', icon: FileText }
];

const semesters = ['1st Semester', '2nd Semester', '3rd Semester', '4th Semester', '5th Semester', '6th Semester', '7th Semester', '8th Semester'];
const years = ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25'];

export default function DocumentUpload({ isOpen, onClose, onUpload }: DocumentUploadProps) {
  const { token } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [index: number]: number }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Form data
  const [documentType, setDocumentType] = useState('');
  const [semester, setSemester] = useState('');
  const [year, setYear] = useState('');
  const [isSecure, setIsSecure] = useState(true);
  const [customName, setCustomName] = useState('');
  const [description, setDescription] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/') ||
      file.type.includes('document')
    );

    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one file to upload.",
        variant: "destructive"
      });
      return;
    }

    if (!documentType || !semester || !year) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields before uploading.",
        variant: "destructive"
      });
      return;
    }

    if (!token) {
      toast({
        title: "Authentication Error",
        description: "Please log in again to upload documents.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      // Upload files sequentially to avoid conflicts
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(prev => ({ ...prev, [i]: 0 }));

        // Simulate upload progress for visual feedback
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const current = prev[i] || 0;
            if (current < 90) {
              return { ...prev, [i]: current + 10 };
            }
            return prev;
          });
        }, 200);

        try {
          // Use custom name only for the first file, or generate unique names
          const fileName = files.length === 1
            ? (customName || file.name)
            : (customName ? `${customName}_${i + 1}` : file.name);

          const form = new FormData();
          form.append('file', file);
          form.append('name', fileName);
          form.append('type', documentType);
          form.append('semester', semester);
          form.append('year', year);
          form.append('isSecure', String(isSecure));
          form.append('metadata', JSON.stringify({
            description: description || undefined,
            tags: [documentType, semester, year].filter(Boolean)
          }));

          const response = await fetch('/api/documents', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: form
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result: DocumentResponse = await response.json();

          clearInterval(progressInterval);
          setUploadProgress(prev => ({ ...prev, [i]: 100 }));

          if (!result.success) {
            throw new Error(result.message || 'Upload failed');
          }

          // Small delay between uploads to prevent server overload
          if (i < files.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          clearInterval(progressInterval);
          throw error;
        }
      }

      setUploadSuccess(true);

      // Show success toast
      toast({
        title: "Upload Successful!",
        description: `${files.length} document(s) have been uploaded successfully.`,
        variant: "default"
      });

      // Auto close after 2 seconds
      setTimeout(() => {
        handleClose();
        onUpload(); // Trigger refresh in parent component
      }, 2000);

    } catch (error) {
      console.error('Upload failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      setUploadError(errorMsg);

      toast({
        title: "Upload Failed",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setUploadProgress({});
    setIsUploading(false);
    setUploadSuccess(false);
    setUploadError('');
    setDocumentType('');
    setSemester('');
    setYear('');
    setCustomName('');
    setDescription('');
    setIsSecure(true);
    onClose();
  };

  const isFormValid = files.length > 0 && documentType && semester && year;

  if (uploadSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Upload Successful!</h3>
            <p className="text-muted-foreground">
              Your documents have been securely uploaded and are now available in your vault.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Documents
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Area */}
          <div className="space-y-4">
            <Label>Select Files</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragActive 
                  ? 'border-primary bg-primary/10' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {isDragActive ? 'Drop files here' : 'Drag and drop files here'}
                </p>
                <p className="text-sm text-muted-foreground">
                  or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:underline font-medium"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports PDF, DOCX, JPG, PNG files up to 10MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files ({files.length})</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Document Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type *</Label>
              <Select value={documentType} onValueChange={setDocumentType} disabled={isUploading}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose document category" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="semester">Semester *</Label>
              <Select value={semester} onValueChange={setSemester} disabled={isUploading}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose semester" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map(sem => (
                    <SelectItem key={sem} value={sem}>{sem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Academic Year *</Label>
              <Select value={year} onValueChange={setYear} disabled={isUploading}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose academic year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(yr => (
                    <SelectItem key={yr} value={yr}>{yr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customName">Custom Name (Optional)</Label>
              <Input
                id="customName"
                placeholder="Enter document name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Describe your document (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {/* Security Settings */}
          <div className="space-y-4">
            <Label>Security Settings</Label>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-foreground">Secure Download</p>
                  <p className="text-sm text-muted-foreground">
                    Require password or OTP for downloading this document
                  </p>
                </div>
              </div>
              <Switch
                checked={isSecure}
                onCheckedChange={setIsSecure}
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-4">
              <Label>Upload Progress</Label>
              {files.map((file, index) => {
                const progress = uploadProgress[index] || 0;
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">{file.name}</span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!isFormValid || isUploading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-background border-t-transparent rounded-full" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Documents
                </>
              )}
            </Button>
          </div>

          {/* Error Message */}
          {uploadError && (
            <div className="flex items-center space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{uploadError}</p>
            </div>
          )}

          {/* Required Fields Notice */}
          {files.length > 0 && !isFormValid && !uploadError && (
            <div className="flex items-center space-x-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-warning" />
              <p className="text-sm text-warning-foreground">
                Please fill in all required fields to continue.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
