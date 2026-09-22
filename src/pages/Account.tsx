import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Save, Mail, KeyRound, UserRound, Building2, Sparkles, Trash2, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGoBack } from '@/hooks/useGoBack';
import { toast } from 'sonner';

interface ProfileForm {
  display_name: string;
  business_name: string;
  business_type: string;
  country: string;
  city: string;
  address: string;
  contact_phone: string;
  website: string;
  expected_volume: string;
  referral_source: string;
}

const EMPTY: ProfileForm = {
  display_name: '',
  business_name: '',
  business_type: '',
  country: '',
  city: '',
  address: '',
  contact_phone: '',
  website: '',
  expected_volume: '',
  referral_source: '',
};

export default function Account() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, isTenantAdmin, signOut } = useAuth();
  const goBack = useGoBack(isSuperAdmin ? '/super-admin' : '/app');
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) throw error;
      toast.success('Account deleted');
      await signOut();
      navigate('/', { replace: true });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  const [profile, setProfile] = useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [sendingReset, setSendingReset] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setCurrentEmail(user.email || '');
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        toast.error('Failed to load profile');
      } else if (data) {
        setProfile({
          display_name: data.display_name || '',
          business_name: data.business_name || '',
          business_type: data.business_type || '',
          country: data.country || '',
          city: data.city || '',
          address: data.address || '',
          contact_phone: data.contact_phone || '',
          website: data.website || '',
          expected_volume: data.expected_volume || '',
          referral_source: data.referral_source || '',
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const handleProfileSave = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update(profile)
      .eq('user_id', user.id);
    setSavingProfile(false);
    if (error) {
      toast.error('Could not save profile');
    } else {
      toast.success('Profile updated');
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail.trim() || newEmail === currentEmail) {
      toast.error('Enter a different email address');
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: `${window.location.origin}/account` }
    );
    setSavingEmail(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Confirmation links sent to both your old and new email addresses. Email will change once confirmed.');
      setNewEmail('');
    }
  };

  const handleSendPasswordReset = async () => {
    if (!currentEmail) {
      toast.error('No email on file');
      return;
    }
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Verification link sent to ${currentEmail}`);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('The new passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      // Verify the current password before changing it.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (signInErr) {
        toast.error('Your current password is incorrect');
        return;
      }
      let { error } = await supabase.auth.updateUser({
        password: newPassword,
        // @ts-expect-error current_password is accepted by Supabase auth
        current_password: currentPassword,
      });
      if (error) {
        const retry = await supabase.auth.updateUser({ password: newPassword });
        error = retry.error;
      }
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error(e?.message || 'Could not update the password');
    } finally {
      setChangingPassword(false);
    }
  };



  const setField = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile(p => ({ ...p, [k]: e.target.value }));

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Account Settings</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4" /> Personal information
            </CardTitle>
            <CardDescription>Your display name and contact details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input value={profile.display_name} onChange={setField('display_name')} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact phone</Label>
                <Input value={profile.contact_phone} onChange={setField('contact_phone')} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Business information
            </CardTitle>
            <CardDescription>Visible to the Jawabify team to support your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Business name</Label>
                <Input value={profile.business_name} onChange={setField('business_name')} />
              </div>
              <div className="space-y-1.5">
                <Label>Business type</Label>
                <Input value={profile.business_type} onChange={setField('business_type')} />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={profile.country} onChange={setField('country')} />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={profile.city} onChange={setField('city')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input value={profile.address} onChange={setField('address')} />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={profile.website} onChange={setField('website')} placeholder="https://" />
              </div>
              <div className="space-y-1.5">
                <Label>Expected monthly volume</Label>
                <Input value={profile.expected_volume} onChange={setField('expected_volume')} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>How did you hear about us</Label>
                <Input value={profile.referral_source} onChange={setField('referral_source')} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleProfileSave} disabled={savingProfile}>
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email address
            </CardTitle>
            <CardDescription>
              You'll receive a confirmation link at both your current and new email. The change takes effect once confirmed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Current email</Label>
              <Input value={currentEmail} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>New email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleEmailChange} disabled={savingEmail || !newEmail.trim()}>
                {savingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send confirmation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Password
            </CardTitle>
            <CardDescription>
              Change your password here, or get a verification link by email if you forgot it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="acct-current-password">Current password</Label>
                <Input
                  id="acct-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acct-new-password">New password</Label>
                <Input
                  id="acct-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acct-confirm-password">Confirm new password</Label>
                <Input
                  id="acct-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || newPassword.length < 8}
              >
                {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Update password
              </Button>
            </div>
            <div className="border-t pt-4 space-y-1.5">
              <Label>Forgot your password? We'll email {currentEmail || 'you'} a link</Label>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSendPasswordReset} disabled={sendingReset || !currentEmail}>
                {sendingReset ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Send reset link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Replay tutorial */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Product tour
            </CardTitle>
            <CardDescription>
              Replay the interactive walkthrough to rediscover features and shortcuts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigate('/settings?tour=1');
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Replay Settings tour
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!user) return;
                  await supabase
                    .from('profiles')
                    .update({ tour_completed_at: null, tour_step: 0 })
                    .eq('user_id', user.id);
                  sessionStorage.setItem('jawabify_force_tour', '1');
                  navigate(isSuperAdmin ? '/super-admin' : '/app?tour=1');
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Replay app tour
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sign out */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </CardTitle>
            <CardDescription>
              End your session on this device. You can sign back in anytime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  navigate('/', { replace: true });
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger zone — owners/admins only */}
        {isTenantAdmin && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Delete account
            </CardTitle>
            <CardDescription>
              Permanently delete your Jawabify account, workspace, contacts, and conversations. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end">
              <AlertDialog onOpenChange={(o) => !o && setConfirmText('')}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete my account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your Jawabify account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes your login, profile, workspace, and all associated data.
                      Type <strong>DELETE</strong> to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={confirmText !== 'DELETE' || deleting}
                      onClick={(e) => { e.preventDefault(); handleDeleteAccount(); }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
        )}

      </div>
    </div>
  );
}
