import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, Loader2, KeyRound, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTeam, type TeamMember } from '@/hooks/useTeam';

function roleLabel(role: string) {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Employee';
}

export function TeamManager() {
  const { members, loading, working, addMember, setPassword, setRole, setActive, removeMember } = useTeam();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPasswordValue] = useState('');
  const [role, setRoleValue] = useState<'admin' | 'employee'>('employee');
  const [pwTarget, setPwTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const handleAdd = async () => {
    try {
      await addMember({ display_name: name.trim(), email: email.trim(), password, role });
      toast.success(`${name.trim()} can now sign in with their email and password`);
      setAddOpen(false);
      setName(''); setEmail(''); setPasswordValue(''); setRoleValue('employee');
    } catch (e) {
      toast.error((e as Error).message || 'Could not create the employee login');
    }
  };

  const handleSetPassword = async () => {
    if (!pwTarget) return;
    try {
      await setPassword(pwTarget.id, newPassword);
      toast.success('Password updated');
      setPwTarget(null);
      setNewPassword('');
    } catch (e) {
      toast.error((e as Error).message || 'Could not update the password');
    }
  };

  return (
    <Card data-tour="team">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Team
        </CardTitle>
        <CardDescription>
          Create logins for your employees. They sign in with their own email and work inside this account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" /> Add employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add an employee</DialogTitle>
              <DialogDescription>
                They will sign in at the normal login page with the email and password you set here.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="team-name">Full name</Label>
                <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sara Khoury" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="team-email">Email</Label>
                <Input id="team-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sara@yourbusiness.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="team-password">Temporary password</Label>
                <Input id="team-password" type="text" autoComplete="new-password" value={password} onChange={(e) => setPasswordValue(e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div className="space-y-1.5">
                <Label>Access level</Label>
                <Select value={role} onValueChange={(v) => setRoleValue(v as 'admin' | 'employee')}>
                  <SelectTrigger className="text-left text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee — everything except team and billing</SelectItem>
                    <SelectItem value="admin">Admin — full access, can manage team and billing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button className="w-full sm:w-auto" onClick={handleAdd} disabled={working || !name.trim() || !email.trim() || password.length < 8}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create login'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="text-xs text-muted-foreground">Loading team…</div>
        ) : (
          <div className="rounded-md border divide-y">
            {members.map((m) => (
              <div key={m.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{m.display_name || m.email || 'Team member'}</span>
                    <Badge variant={m.role === 'employee' ? 'secondary' : 'default'} className="shrink-0">{roleLabel(m.role)}</Badge>
                    {!m.is_active && <Badge variant="outline" className="shrink-0 text-destructive">Disabled</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setPwTarget(m); setNewPassword(''); }}>
                    <KeyRound className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Password</span>
                  </Button>
                  {m.role !== 'owner' && (
                    <>
                      <Select value={m.role} onValueChange={(v) => setRole(m.id, v as 'admin' | 'employee').catch((e) => toast.error((e as Error).message))}>
                        <SelectTrigger className="h-8 w-[100px] text-xs sm:w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-2 sm:px-3"
                        onClick={() => setActive(m.id, !m.is_active).catch((e) => toast.error((e as Error).message))}
                      >
                        {m.is_active ? <span className="hidden sm:inline">Disable</span> : <span className="hidden sm:inline">Enable</span>}
                        <span className="sm:hidden">{m.is_active ? 'Off' : 'On'}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive px-2 sm:px-3"
                        onClick={() => {
                          if (!window.confirm(`Remove ${m.display_name || m.email}? Their login will stop working.`)) return;
                          removeMember(m.id)
                            .then(() => toast.success('Team member removed'))
                            .catch((e) => toast.error((e as Error).message));
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">No team members yet.</div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={!!pwTarget} onOpenChange={(o) => { if (!o) setPwTarget(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set a new password</DialogTitle>
            <DialogDescription>{pwTarget?.display_name || pwTarget?.email}</DialogDescription>
          </DialogHeader>
          <Input
            type="text"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setPwTarget(null)}>Cancel</Button>
            <Button className="w-full sm:w-auto" onClick={handleSetPassword} disabled={working || newPassword.length < 8}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
