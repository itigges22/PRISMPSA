'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  Save,
  X as XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'multiselect' | 'file' | 'textarea' | 'email' | 'checkbox';

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  conditional?: {
    show_if: string;
    equals: unknown;
  };
}

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  is_active: boolean;
  fields: FormField[];
  created_at: string;
  updated_at: string;
}

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'text', label: 'Short Text', icon: '📝' },
  { value: 'textarea', label: 'Long Text', icon: '📄' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'date', label: 'Date', icon: '📅' },
  { value: 'dropdown', label: 'Dropdown', icon: '▼' },
  { value: 'multiselect', label: 'Multi-Select', icon: '☑' },
  { value: 'checkbox', label: 'Checkbox', icon: '✓' },
  { value: 'file', label: 'File Upload', icon: '📎' },
];

export default function FormsPage() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<FormTemplate | null>(null);

  // Form editor state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/forms/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else {
        toast.error('Failed to load form templates');
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Error loading form templates');
    } finally {
      setLoading(false);
    }
  };

  const openNewFormEditor = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFields([]);
    setSelectedFieldIndex(null);
    setEditorOpen(true);
  };

  const openEditFormEditor = (template: FormTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description ?? '');
    setFields(template.fields);
    setSelectedFieldIndex(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFields([]);
    setSelectedFieldIndex(null);
  };

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: uuidv4(),
      type,
      label: `New ${type} field`,
      required: false,
      placeholder: '',
      options: type === 'dropdown' || type === 'multiselect' ? ['Option 1', 'Option 2'] : undefined,
    };
    setFields([...fields, newField]);
    setSelectedFieldIndex(fields.length);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
    if (selectedFieldIndex === index) {
      setSelectedFieldIndex(null);
    } else if (selectedFieldIndex !== null && selectedFieldIndex > index) {
      setSelectedFieldIndex(selectedFieldIndex - 1);
    }
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    setFields(newFields);
    if (selectedFieldIndex === index) {
      setSelectedFieldIndex(index - 1);
    } else if (selectedFieldIndex === index - 1) {
      setSelectedFieldIndex(index);
    }
  };

  const moveFieldDown = (index: number) => {
    if (index === fields.length - 1) return;
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    setFields(newFields);
    if (selectedFieldIndex === index) {
      setSelectedFieldIndex(index + 1);
    } else if (selectedFieldIndex === index + 1) {
      setSelectedFieldIndex(index);
    }
  };

  const saveForm = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a form name');
      return;
    }

    if (fields.length === 0) {
      toast.error('Please add at least one field');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        // Update existing template
        const response = await fetch(`/api/admin/forms/templates/${editingTemplate.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            description: formDescription || null,
            fields,
          }),
        });

        if (response.ok) {
          toast.success('Form template updated successfully');
          await loadTemplates();
          closeEditor();
        } else {
          const data = await response.json();
          toast.error(data.error || 'Failed to update form template');
        }
      } else {
        // Create new template
        const response = await fetch('/api/admin/forms/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            description: formDescription || null,
            fields,
          }),
        });

        if (response.ok) {
          toast.success('Form template created successfully');
          await loadTemplates();
          closeEditor();
        } else {
          const data = await response.json();
          toast.error(data.error || 'Failed to create form template');
        }
      }
    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Error saving form template');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTemplate = (template: FormTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const deleteTemplate = async () => {
    if (!templateToDelete) return;

    try {
      const response = await fetch(`/api/admin/forms/templates/${templateToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Form template deleted successfully');
        await loadTemplates();
        setDeleteDialogOpen(false);
        setTemplateToDelete(null);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete form template');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Error deleting form template');
    }
  };

  const selectedField = selectedFieldIndex !== null ? fields[selectedFieldIndex] : null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Form Builder</h1>
          <p className="text-muted-foreground mt-2">
            Create dynamic forms with custom fields and conditional logic
          </p>
        </div>
        <Button onClick={openNewFormEditor}>
          <Plus className="w-4 h-4 mr-2" />
          Create Form
        </Button>
      </div>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Form Templates
          </CardTitle>
          <CardDescription>
            Manage form templates that can be attached to workflow nodes
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
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No form templates yet</p>
              <p className="text-xs mt-1">Click &quot;Create Form&quot; to get started</p>
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
                      <Badge variant="outline">{template.fields.length} fields</Badge>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.fields.slice(0, 5).map((field) => (
                        <Badge key={field.id} variant="secondary" className="text-xs">
                          {FIELD_TYPES.find(t => t.value === field.type)?.icon} {field.label}
                        </Badge>
                      ))}
                      {template.fields.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{template.fields.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { openEditFormEditor(template); }}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { confirmDeleteTemplate(template); }}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="!max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Form Template' : 'Create New Form Template'}
            </DialogTitle>
            <DialogDescription>
              Design your form by adding fields and configuring their properties
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Form Info & Fields */}
              <div className="lg:col-span-2 space-y-6">
                {/* Form Info */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="formName">Form Name *</Label>
                    <Input
                      id="formName"
                      value={formName}
                      onChange={(e) => { setFormName(e.target.value); }}
                      placeholder="e.g., Client Onboarding Form"
                    />
                  </div>
                  <div>
                    <Label htmlFor="formDescription">Description</Label>
                    <Textarea
                      id="formDescription"
                      value={formDescription}
                      onChange={(e) => { setFormDescription(e.target.value); }}
                      placeholder="Brief description of this form"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Field Palette */}
                <div>
                  <Label className="mb-2 block">Add Field</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {FIELD_TYPES.map((fieldType) => (
                      <Button
                        key={fieldType.value}
                        variant="outline"
                        size="sm"
                        onClick={() => { addField(fieldType.value); }}
                        className="justify-start"
                      >
                        <span className="mr-2">{fieldType.icon}</span>
                        {fieldType.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Fields List */}
                <div>
                  <Label className="mb-2 block">Form Fields ({fields.length})</Label>
                  {fields.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No fields added yet</p>
                      <p className="text-xs mt-1">Add fields using the buttons above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedFieldIndex === index
                              ? 'bg-blue-50 border-blue-300'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => { setSelectedFieldIndex(index); }}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span>{FIELD_TYPES.find(t => t.value === field.type)?.icon}</span>
                              <span className="font-medium">{field.label}</span>
                              {field.required && (
                                <Badge variant="destructive" className="text-xs">Required</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {FIELD_TYPES.find(t => t.value === field.type)?.label}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveFieldUp(index);
                              }}
                              disabled={index === 0}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveFieldDown(index);
                              }}
                              disabled={index === fields.length - 1}
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeField(index);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Field Configuration */}
              <div className="lg:col-span-1">
                <div className="sticky top-0">
                  <Label className="mb-2 block">Field Configuration</Label>
                  {selectedField === null ? (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center text-gray-400">
                      <ChevronRight className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a field to configure</p>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="pt-6 space-y-4">
                        <div>
                          <Label>Field Label *</Label>
                          <Input
                            value={selectedField.label}
                            onChange={(e) =>
                              { updateField(selectedFieldIndex!, { label: e.target.value }); }
                            }
                          />
                        </div>

                        <div>
                          <Label>Placeholder</Label>
                          <Input
                            value={selectedField.placeholder ?? ''}
                            onChange={(e) =>
                              { updateField(selectedFieldIndex!, { placeholder: e.target.value }); }
                            }
                            placeholder="Hint text for user"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label>Required Field</Label>
                          <Switch
                            checked={selectedField.required}
                            onCheckedChange={(checked) =>
                              updateField(selectedFieldIndex!, { required: checked })
                            }
                          />
                        </div>

                        {/* Options for dropdown/multiselect */}
                        {(selectedField.type === 'dropdown' || selectedField.type === 'multiselect') && (
                          <div>
                            <Label>Options (one per line)</Label>
                            <Textarea
                              value={(selectedField.options ?? []).join('\n')}
                              onChange={(e) =>
                                updateField(selectedFieldIndex!, {
                                  options: e.target.value.split('\n').filter(o => o.trim()),
                                })
                              }
                              rows={4}
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                            />
                          </div>
                        )}

                        {/* Validation for number fields */}
                        {selectedField.type === 'number' && (
                          <>
                            <div>
                              <Label>Minimum Value</Label>
                              <Input
                                type="number"
                                value={selectedField.validation?.min ?? ''}
                                onChange={(e) =>
                                  updateField(selectedFieldIndex!, {
                                    validation: {
                                      ...selectedField.validation,
                                      min: e.target.value ? Number(e.target.value) : undefined,
                                    },
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label>Maximum Value</Label>
                              <Input
                                type="number"
                                value={selectedField.validation?.max ?? ''}
                                onChange={(e) =>
                                  updateField(selectedFieldIndex!, {
                                    validation: {
                                      ...selectedField.validation,
                                      max: e.target.value ? Number(e.target.value) : undefined,
                                    },
                                  })
                                }
                              />
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              <XIcon className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={saveForm} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : editingTemplate ? 'Update Form' : 'Create Form'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{templateToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTemplate} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
