import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Document, DocumentResponse, StorageResponse } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Search,
  Filter,
  Download,
  FileText,
  GraduationCap,
  Calendar,
  User,
  Shield,
  Settings,
  MoreVertical,
  Eye,
  Trash2,
  Lock,
  Folder,
  BookOpen,
  Award,
  CreditCard,
  LogOut,
  RefreshCw
} from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import SecureDownloadModal from "@/components/SecureDownloadModal";
import AccountSettings from "@/components/AccountSettings";
import { toast } from '@/hooks/use-toast';

const documentTypes = [
  { value: 'certificate', label: 'Certificates', icon: Award, color: 'bg-yellow-100 text-yellow-800' },
  { value: 'fee-receipt', label: 'Fee Receipts', icon: CreditCard, color: 'bg-green-100 text-green-800' },
  { value: 'transcript', label: 'Transcripts', icon: BookOpen, color: 'bg-blue-100 text-blue-800' },
  { value: 'id-card', label: 'ID Cards', icon: User, color: 'bg-purple-100 text-purple-800' },
  { value: 'other', label: 'Other', icon: FileText, color: 'bg-gray-100 text-gray-800' }
];

const semesters = ['1st Semester', '2nd Semester', '3rd Semester', '4th Semester', '5th Semester', '6th Semester', '7th Semester', '8th Semester'];
const years = ['2020-21', '2021-22', '2022-23', '2023-24', '2024-25'];

export default function CollegeDocumentVault() {
  const { user, token, logout } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  // Load documents and storage info on component mount
  useEffect(() => {
    loadDocuments();
    loadStorageInfo();
  }, [token]);

  const loadDocuments = async () => {
    if (!token) return;

    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (selectedType !== 'all') params.append('type', selectedType);
      if (selectedSemester !== 'all') params.append('semester', selectedSemester);
      if (selectedYear !== 'all') params.append('year', selectedYear);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/documents?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: DocumentResponse = await response.json();

      if (result.success && result.documents) {
        setDocuments(result.documents);
      } else {
        setError(result.message || 'Failed to load documents');
      }
    } catch (err) {
      setError('Failed to load documents. Please try again.');
      console.error('Load documents error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStorageInfo = async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/storage', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: StorageResponse = await response.json();

      if (result.success && result.storage) {
        setStorageUsed(result.storage.percentage);
      }
    } catch (err) {
      console.error('Load storage info error:', err);
      toast({
        title: "Storage Info Unavailable",
        description: "Unable to load storage information.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: DocumentResponse = await response.json();

      if (result.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        loadStorageInfo(); // Refresh storage info

        // Show success toast
        toast({
          title: "Document Deleted",
          description: "The document has been permanently deleted from your vault.",
          variant: "default"
        });
      } else {
        const errorMsg = result.message || 'Failed to delete document';
        setError(errorMsg);

        toast({
          title: "Delete Failed",
          description: errorMsg,
          variant: "destructive"
        });
      }
    } catch (err) {
      const errorMsg = 'Failed to delete document. Please try again.';
      setError(errorMsg);
      console.error('Delete document error:', err);

      toast({
        title: "Delete Error",
        description: "Network error occurred while deleting document.",
        variant: "destructive"
      });
    }
  };

  // Reload documents when filters change
  useEffect(() => {
    if (token) {
      loadDocuments();
    }
  }, [selectedType, selectedSemester, selectedYear, searchTerm, token]);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || doc.type === selectedType;
    const matchesSemester = selectedSemester === 'all' || doc.semester === selectedSemester;
    const matchesYear = selectedYear === 'all' || doc.year === selectedYear;

    return matchesSearch && matchesType && matchesSemester && matchesYear;
  });

  const getTypeIcon = (type: string) => {
    const docType = documentTypes.find(dt => dt.value === type);
    const IconComponent = docType?.icon || FileText;
    return <IconComponent className="h-5 w-5" />;
  };

  const getTypeColor = (type: string) => {
    return documentTypes.find(dt => dt.value === type)?.color || 'bg-gray-100 text-gray-800';
  };

  const handleDownload = (document: Document) => {
    if (document.isSecure) {
      setSelectedDocument(document);
      setShowDownloadModal(true);
    } else {
      // Direct download for non-secure documents via API
      window.open(`/api/files/${document.id}`, '_blank');
    }
  };

  const stats = [
    {
      title: 'Total Documents',
      value: documents.length.toString(),
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      title: 'Secure Documents',
      value: documents.filter(d => d.isSecure).length.toString(),
      icon: Shield,
      color: 'text-green-600'
    },
    {
      title: 'Storage Used',
      value: `${storageUsed}%`,
      icon: Folder,
      color: 'text-orange-600'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary rounded-lg p-2">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">College Vault</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome, {user?.email}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDocuments}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => setIsUploadModalOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    Account
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsAccountOpen(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <Dialog open={isAccountOpen} onOpenChange={setIsAccountOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Account Settings</DialogTitle>
          </DialogHeader>
          <AccountSettings />
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center p-6">
                <div className={`p-2 rounded-lg bg-muted mr-4`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Storage Usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Storage Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Used space</span>
                <span className="font-medium">{storageUsed}% of 5 GB</span>
              </div>
              <Progress value={storageUsed} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search & Filter Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search your documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[120px]">
                      <Filter className="h-4 w-4 mr-2" />
                      {selectedType === 'all' ? 'All Types' : documentTypes.find(t => t.value === selectedType)?.label}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setSelectedType('all')}>All Types</DropdownMenuItem>
                    {documentTypes.map(type => (
                      <DropdownMenuItem key={type.value} onClick={() => setSelectedType(type.value)}>
                        {type.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[120px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      {selectedSemester === 'all' ? 'All Semesters' : selectedSemester}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setSelectedSemester('all')}>All Semesters</DropdownMenuItem>
                    {semesters.map(semester => (
                      <DropdownMenuItem key={semester} onClick={() => setSelectedSemester(semester)}>
                        {semester}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[120px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      {selectedYear === 'all' ? 'All Years' : selectedYear}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setSelectedYear('all')}>All Years</DropdownMenuItem>
                    {years.map(year => (
                      <DropdownMenuItem key={year} onClick={() => setSelectedYear(year)}>
                        {year}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>My Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                <p className="text-destructive text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadDocuments}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No documents found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || selectedType !== 'all' || selectedSemester !== 'all' || selectedYear !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Upload your first document to get started'
                  }
                </p>
                {!searchTerm && selectedType === 'all' && selectedSemester === 'all' && selectedYear === 'all' && (
                  <Button onClick={() => setIsUploadModalOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-lg bg-muted">
                        {getTypeIcon(document.type)}
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{document.name}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="secondary" className={getTypeColor(document.type)}>
                            {documentTypes.find(t => t.value === document.type)?.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{document.semester}</span>
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">{document.year}</span>
                          {document.isSecure && (
                            <>
                              <span className="text-sm text-muted-foreground">•</span>
                              <Badge variant="outline" className="text-green-600 border-green-200">
                                <Shield className="h-3 w-3 mr-1" />
                                Secure
                              </Badge>
                            </>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Uploaded on {new Date(document.uploadDate).toLocaleDateString()} • {document.size}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(document)}
                      >
                        {document.isSecure ? <Lock className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                        Download
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteDocument(document.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <DocumentUpload
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={() => {
          setIsUploadModalOpen(false);
          loadDocuments(); // Refresh document list
          loadStorageInfo(); // Refresh storage info
        }}
      />

      {selectedDocument && (
        <SecureDownloadModal
          isOpen={showDownloadModal}
          onClose={() => {
            setShowDownloadModal(false);
            setSelectedDocument(null);
          }}
          document={selectedDocument}
        />
      )}
    </div>
  );
}
