'use client';
import { toast } from 'sonner';

// Account edit dialog - requires EDIT_ACCOUNT permission
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Loader2 } from 'lucide-react';
import { UserWithRoles, hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { AccountWithProjects } from '@/lib/account-service';

interface AccountEditDialogProps {
  account: AccountWithProjects;
  userProfile: UserWithRoles;
  onAccountUpdated?: () => void;
  children?: React.ReactNode;
}

export function AccountEditDialog({ account, userProfile, onAccountUpdated, children }: AccountEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canEditAccount, setCanEditAccount] = useState(false);
  const [formData, setFormData] = useState({
    name: account.name || '',
    description: account.description || '',
    primary_contact_name: account.primary_contact_name || '',
    primary_contact_email: account.primary_contact_email || '',
    status: (account.status || 'active') as 'active' | 'inactive' | 'suspended'
  });

  // Check permissions
  useEffect(() => {
    if (!userProfile) return;
    
    async function checkPermissions() {
      const canEdit = await hasPermission(userProfile, Permission.EDIT_ACCOUNT, { accountId: account.id });
      setCanEditAccount(canEdit);
    }
    
    checkPermissions();
  }, [userProfile, account.id]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: account.name || '',
        description: account.description || '',
        primary_contact_name: account.primary_contact_name || '',
        primary_contact_email: account.primary_contact_email || '',
        status: (account.status || 'active') as 'active' | 'inactive' | 'suspended'
      });
    }
  }, [open, account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canEditAccount) {
      toast.error('You do not have permission to edit this account.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          primary_contact_name: formData.primary_contact_name,
          primary_contact_email: formData.primary_contact_email,
          status: formData.status
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error updating account:', result.error);
        toast.error(result.error || 'Failed to update account. Please try again.');
        return;
      }

      setOpen(false);
      onAccountUpdated?.();
      // Refresh server data without full page reload
      router.refresh();
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error('Failed to update account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!canEditAccount) {
    return null; // Don't render if user doesn't have permission
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>
            Update account information and settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_contact_name">
                Primary Contact Name
              </Label>
              <Input
                id="primary_contact_name"
                value={formData.primary_contact_name}
                onChange={(e) => handleInputChange('primary_contact_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_contact_email">
                Primary Contact Email
              </Label>
              <Input
                id="primary_contact_email"
                type="email"
                value={formData.primary_contact_email}
                onChange={(e) => handleInputChange('primary_contact_email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

