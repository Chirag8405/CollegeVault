import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter as DialogFooterUI, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LogOut, User, Mail, Phone, Trash2, Lock, Edit3, Moon, Sun } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTheme } from 'next-themes';

const AccountSettings = () => {
  const { user, logout, changePassword, updateProfile, deleteAccount } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [openPassword, setOpenPassword] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isDark = useMemo(() => (theme ?? resolvedTheme) === 'dark', [theme, resolvedTheme]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
  };

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
    toast({ title: 'Theme changed', description: `Switched to ${checked ? 'Dark' : 'Light'} mode.` });
  };

  const onSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: 'Missing fields', description: 'Fill all password fields', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Weak password', description: 'New password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: 'Confirm password must match new password', variant: 'destructive' });
      return;
    }
    setSavingPassword(true);
    const res = await changePassword(currentPassword, newPassword);
    setSavingPassword(false);
    if (res.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOpenPassword(false);
    }
  };

  const onSaveProfile = async () => {
    if (!name.trim()) {
      toast({ title: 'Invalid name', description: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Invalid email', description: 'Enter a valid email address', variant: 'destructive' });
      return;
    }
    if (!/^\+?[\d\s\-\(\)]{10,}$/.test(phone)) {
      toast({ title: 'Invalid phone', description: 'Enter a valid phone number', variant: 'destructive' });
      return;
    }
    setSavingProfile(true);
    const res = await updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() });
    setSavingProfile(false);
    if (res.success) {
      setOpenProfile(false);
      toast({ title: 'Profile updated', description: 'Your profile was saved' });
    }
  };

  const onDeleteAccount = async () => {
    if (confirmText !== user.email && confirmText !== 'DELETE') {
      toast({ title: 'Confirmation required', description: "Type your email or 'DELETE' to confirm", variant: 'destructive' });
      return;
    }
    setDeleting(true);
    const res = await deleteAccount();
    setDeleting(false);
    if (res.success) {
      // logout is handled in context
      toast({ title: 'Account deleted', description: 'Your account and documents were removed' });
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Account Settings
          <User className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Name</Label>
              <div className="text-sm text-muted-foreground break-all">{user.name}</div>
            </div>
            <Dialog open={openProfile} onOpenChange={(o)=>{setOpenProfile(o); if(o){setName(user.name); setEmail(user.email); setPhone(user.phone);} }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Edit3 className="mr-2 h-4 w-4"/>Edit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit profile</DialogTitle>
                  <DialogDescription>Update your name, email, and phone number.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name"/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com"/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="+1234567890"/>
                  </div>
                </div>
                <DialogFooterUI>
                  <Button variant="ghost" onClick={()=>setOpenProfile(false)}>Cancel</Button>
                  <Button onClick={onSaveProfile} disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save changes'}</Button>
                </DialogFooterUI>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Email</Label>
              <div className="text-sm text-muted-foreground break-all">{user.email}</div>
            </div>
            <Button variant="outline" size="sm" onClick={()=>setOpenProfile(true)}><Edit3 className="mr-2 h-4 w-4"/>Edit</Button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Mobile Number</Label>
              <div className="text-sm text-muted-foreground break-all">{user.phone}</div>
            </div>
            <Button variant="outline" size="sm" onClick={()=>setOpenProfile(true)}><Edit3 className="mr-2 h-4 w-4"/>Edit</Button>
          </div>
        </div>

        <hr className="my-2" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDark ? <Moon className="h-4 w-4"/> : <Sun className="h-4 w-4"/>}
            <Label htmlFor="theme-toggle">Dark Mode</Label>
          </div>
          <Switch id="theme-toggle" checked={isDark} onCheckedChange={handleThemeToggle} />
        </div>

        <hr className="my-2" />

        <div className="space-y-3">
          <Dialog open={openPassword} onOpenChange={setOpenPassword}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start"><Lock className="mr-2 h-4 w-4"/>Change Password</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change password</DialogTitle>
                <DialogDescription>Enter your current and new password.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input id="current-password" type="password" value={currentPassword} onChange={(e)=>setCurrentPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input id="new-password" type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <DialogFooterUI>
                <Button variant="ghost" onClick={()=>setOpenPassword(false)}>Cancel</Button>
                <Button onClick={onSavePassword} disabled={savingPassword}>{savingPassword ? 'Saving...' : 'Update password'}</Button>
              </DialogFooterUI>
            </DialogContent>
          </Dialog>

          <Dialog open={openDelete} onOpenChange={(o)=>{setOpenDelete(o); if(!o) setConfirmText('');}}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full justify-center"><Trash2 className="mr-2 h-4 w-4"/>Delete Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete account</DialogTitle>
                <DialogDescription>This action will permanently delete your account and documents. Type your email ({user.email}) or 'DELETE' to confirm.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 pt-2">
                <Label htmlFor="confirm">Confirm</Label>
                <Input id="confirm" value={confirmText} onChange={(e)=>setConfirmText(e.target.value)} placeholder={user.email} />
              </div>
              <DialogFooterUI>
                <Button variant="ghost" onClick={()=>setOpenDelete(false)}>Cancel</Button>
                <Button variant="destructive" onClick={onDeleteAccount} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete account'}</Button>
              </DialogFooterUI>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button variant="outline" className="w-full flex items-center justify-center" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AccountSettings;
