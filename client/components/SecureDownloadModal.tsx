import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Lock, 
  Download, 
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Timer,
  RefreshCw
} from "lucide-react";
import { toast } from '@/hooks/use-toast';

interface SecureDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: {
    id: string;
    name: string;
    type: string;
    semester: string;
    year: string;
  };
}

export default function SecureDownloadModal({ isOpen, onClose, document }: SecureDownloadModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [downloadStarted, setDownloadStarted] = useState(false);

  // Debug logging
  console.log('SecureDownloadModal state:', {
    isOpen,
    passwordVerified,
    verificationError,
    isVerifying,
    downloadStarted,
    verificationSuccess
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('Modal opened, resetting state');
      setPassword('');
      setShowPassword(false);
      setOtp('');
      setIsVerifying(false);
      setVerificationSuccess(false);
      setVerificationError('');
      setPasswordVerified(false);
      setOtpTimer(0);
      setDownloadStarted(false);
    }
  }, [isOpen]);

  const verifyPassword = async () => {
    if (!password) {
      setVerificationError('Please enter your password');
      return;
    }

    setIsVerifying(true);
    setVerificationError('');

    try {
      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('Password verification successful');
        setPasswordVerified(true);
        setOtpTimer(300); // 5 minutes countdown

        // Show success toast
        toast({
          title: "Password Verified",
          description: "OTP has been sent to your registered email and phone number.",
          variant: "default"
        });
      } else {
        console.log('Password verification failed:', result.message);
        setPasswordVerified(false); // Reset password verification state
        const errorMsg = result.message || 'Invalid password';
        setVerificationError(errorMsg);

        // Show error toast
        toast({
          title: "Password Verification Failed",
          description: errorMsg,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Password verification network error:', error);
      setPasswordVerified(false); // Reset password verification state
      const errorMsg = 'Network error. Please try again.';
      setVerificationError(errorMsg);

      toast({
        title: "Connection Error",
        description: "Unable to verify password. Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp) {
      setVerificationError('Please enter the OTP');
      return;
    }

    setIsVerifying(true);
    setVerificationError('');

    try {
      const response = await fetch('/api/auth/verify-download-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ otp })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        setVerificationSuccess(true);

        // Show success toast
        toast({
          title: "Download Started",
          description: "OTP verified successfully. Your download will begin shortly.",
          variant: "default"
        });

        startDownload();
      } else {
        const errorMsg = result.message || 'Invalid OTP. Please try again.';
        setVerificationError(errorMsg);

        // Show error toast
        toast({
          title: "OTP Verification Failed",
          description: errorMsg,
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMsg = 'Network error. Please try again.';
      setVerificationError(errorMsg);

      toast({
        title: "Connection Error",
        description: "Unable to verify OTP. Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const startDownload = () => {
    try {
      setDownloadStarted(true);
      const token = btoa(`${document.id}:${Date.now()}`);
      const link = window.document.createElement('a');
      link.href = `/api/files/${document.id}?token=${encodeURIComponent(token)}`;
      link.setAttribute('download', '');
      link.rel = 'noopener';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);

      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (e) {
      toast({
        title: "Download Failed",
        description: "There was an issue starting your download.",
        variant: "destructive"
      });
      setDownloadStarted(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setShowPassword(false);
    setOtp('');
    setIsVerifying(false);
    setVerificationSuccess(false);
    setVerificationError('');
    setPasswordVerified(false);
    setOtpTimer(0);
    setDownloadStarted(false);
    onClose();
  };

  const resendOtp = async () => {
    // Resend OTP by verifying password again
    await verifyPassword();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (downloadStarted) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-8">
            <Download className="h-16 w-16 text-primary mx-auto mb-4 animate-bounce" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Preparing Download</h3>
            <p className="text-muted-foreground mb-4">
              Your secure download is being prepared. The file will start downloading shortly.
            </p>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">{document.name}</p>
              <p className="text-xs text-muted-foreground">{document.semester} • {document.year}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (verificationSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Verification Successful!</h3>
            <p className="text-muted-foreground">
              Access granted. Your download will begin shortly.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Secure Document Access
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Document Info */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-foreground">{document.name}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {document.semester} • {document.year}
                </p>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-200">
                <Lock className="h-3 w-3 mr-1" />
                Secure
              </Badge>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start space-x-3 p-4 bg-info/10 border border-info/20 rounded-lg">
            <Shield className="h-5 w-5 text-info mt-0.5" />
            <div>
              <p className="text-sm font-medium text-info-foreground">Two-Step Verification Required</p>
              <p className="text-sm text-info-foreground/80 mt-1">
                {!passwordVerified 
                  ? "First verify your password, then enter the OTP sent to your email and phone." 
                  : "Now enter the OTP sent to your registered email and phone number."
                }
              </p>
            </div>
          </div>

          {/* Step 1: Password Verification */}
          {!passwordVerified ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Enter Your Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your login password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isVerifying}
                    onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isVerifying}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button
                onClick={verifyPassword}
                disabled={!password || isVerifying}
                className="w-full"
              >
                {isVerifying ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-background border-t-transparent rounded-full" />
                    Verifying Password...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Verify Password & Send OTP
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* Step 2: OTP Verification */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                <Input
                  id="otp"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={isVerifying}
                  onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
                  className="text-center text-lg font-mono"
                />
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground">
                      OTP sent to email & phone
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPasswordVerified(false);
                        setOtp('');
                        setVerificationError('');
                        setOtpTimer(0);
                      }}
                      className="text-xs"
                    >
                      Change Password
                    </Button>
                  </div>
                  {otpTimer > 0 ? (
                    <div className="flex items-center text-muted-foreground">
                      <Timer className="h-3 w-3 mr-1" />
                      {formatTime(otpTimer)}
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resendOtp}
                      disabled={isVerifying}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Resend OTP
                    </Button>
                  )}
                </div>
                <div className="bg-muted/50 rounded-lg p-3 mt-2">
                  <p className="text-xs text-muted-foreground">
                    <strong>Development Mode:</strong> Check the browser console for the OTP code sent to your email and phone.
                  </p>
                </div>
              </div>
              <Button
                onClick={verifyOtp}
                disabled={!otp || otp.length !== 6 || isVerifying}
                className="w-full"
              >
                {isVerifying ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-background border-t-transparent rounded-full" />
                    Verifying OTP...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verify OTP & Download
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Error Message */}
          {verificationError && (
            <div className="flex items-center space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{verificationError}</p>
            </div>
          )}

          {/* Cancel Button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose} disabled={isVerifying}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
