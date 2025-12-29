'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Workflow, Edit, GitBranch, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  is_active: boolean;
}

interface WorkflowsClientProps {
  canManageWorkflows: boolean;
}

export default function WorkflowsClient({ canManageWorkflows }: WorkflowsClientProps) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<WorkflowTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/workflows/templates?include_inactive=true');
      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates || []);
      } else {
        toast.error(data.error || 'Failed to load workflows');
      }
    } catch (err: unknown) {
      toast.error('Failed to load workflows');
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newWorkflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/workflows/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorkflowName,
          description: newWorkflowDescription || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Workflow template created successfully');
        setCreateDialogOpen(false);
        setNewWorkflowName('');
        setNewWorkflowDescription('');
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to create workflow template');
      }
    } catch (err: unknown) {
      toast.error('Failed to create workflow template');
      console.error('Error creating workflow:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/workflows/templates/${templateToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Workflow template deleted successfully');
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
        fetchTemplates();
      } else {
        toast.error(data.error || 'Failed to delete workflow template');
      }
    } catch (err: unknown) {
      toast.error('Failed to delete workflow template');
      console.error('Error deleting workflow:', err);
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = (template: WorkflowTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Builder</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage workflow templates for projects
          </p>
        </div>
        {canManageWorkflows && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Workflow
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5" />
            Workflow Templates
          </CardTitle>
          <CardDescription>
            Define handoff paths between departments, roles, and approval nodes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Workflow className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No workflow templates yet</p>
              <p className="text-xs mt-1">Click &quot;Create Workflow&quot; to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.is_active ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <GitBranch className="w-3 h-3" />
                      <span>Created {new Date(template.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/admin/workflows/${template.id}/edit`}
                      title="Open visual workflow editor"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    {canManageWorkflows && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmDelete(template)}
                        title="Delete workflow template"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Workflow Template</DialogTitle>
            <DialogDescription>
              Create a new workflow template for project progression
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workflow Name *</Label>
              <Input
                id="name"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="e.g., Standard Project Workflow"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                placeholder="Describe this workflow..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={saving}>
              {saving ? 'Creating...' : 'Create Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{templateToDelete?.name}&quot;?
              This action cannot be undone. All workflow nodes, connections, and associated
              workflow instances will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
