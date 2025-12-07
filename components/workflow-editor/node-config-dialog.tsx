'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowNodeData, WorkflowNodeType } from './workflow-node';
import { InlineFormBuilder, FormField } from '@/components/inline-form-builder';
import { Plus, Trash2, AlertTriangle, Info } from 'lucide-react';
import { Node, Edge } from '@xyflow/react';

interface ConditionBranch {
  id: string;
  label: string;
  value: string;
  value2?: string; // For "between" conditions
  conditionType: string; // 'equals', 'contains', 'greater_than', etc.
  color: string;
}

// Condition types available for each field type
const CONDITION_TYPES_BY_FIELD: Record<string, { value: string; label: string; needsValue: boolean; needsValue2?: boolean }[]> = {
  text: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'contains', label: 'Contains', needsValue: true },
    { value: 'starts_with', label: 'Starts with', needsValue: true },
    { value: 'ends_with', label: 'Ends with', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  ],
  textarea: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'contains', label: 'Contains', needsValue: true },
    { value: 'starts_with', label: 'Starts with', needsValue: true },
    { value: 'ends_with', label: 'Ends with', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  ],
  email: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'contains', label: 'Contains', needsValue: true },
    { value: 'ends_with', label: 'Domain ends with', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  ],
  url: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'contains', label: 'Contains', needsValue: true },
    { value: 'starts_with', label: 'Starts with', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  ],
  number: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'greater_than', label: 'Greater than', needsValue: true },
    { value: 'less_than', label: 'Less than', needsValue: true },
    { value: 'greater_or_equal', label: 'Greater than or equal', needsValue: true },
    { value: 'less_or_equal', label: 'Less than or equal', needsValue: true },
    { value: 'between', label: 'Between', needsValue: true, needsValue2: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  ],
  date: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'before', label: 'Before', needsValue: true },
    { value: 'after', label: 'After', needsValue: true },
    { value: 'between', label: 'Between', needsValue: true, needsValue2: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  ],
  dropdown: [
    { value: 'equals', label: 'Equals', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  ],
  multiselect: [
    { value: 'contains', label: 'Contains', needsValue: true },
    { value: 'is_empty', label: 'Is empty', needsValue: false },
    { value: 'is_not_empty', label: 'Is not empty', needsValue: false },
  ],
  checkbox: [
    { value: 'is_checked', label: 'Is checked (Yes)', needsValue: false },
    { value: 'is_not_checked', label: 'Is not checked (No)', needsValue: false },
  ],
};

// Generate a human-readable label for a branch condition
function generateBranchLabel(fieldLabel: string, conditionType: string, value?: string, value2?: string): string {
  const conditionLabels: Record<string, string> = {
    equals: `${fieldLabel} = "${value}"`,
    contains: `${fieldLabel} contains "${value}"`,
    starts_with: `${fieldLabel} starts with "${value}"`,
    ends_with: `${fieldLabel} ends with "${value}"`,
    is_empty: `${fieldLabel} is empty`,
    is_not_empty: `${fieldLabel} has value`,
    greater_than: `${fieldLabel} > ${value}`,
    less_than: `${fieldLabel} < ${value}`,
    greater_or_equal: `${fieldLabel} >= ${value}`,
    less_or_equal: `${fieldLabel} <= ${value}`,
    between: `${fieldLabel} ${value}-${value2}`,
    before: `${fieldLabel} before ${value}`,
    after: `${fieldLabel} after ${value}`,
    is_checked: `${fieldLabel} = Yes`,
    is_not_checked: `${fieldLabel} = No`,
  };
  return conditionLabels[conditionType] || `${fieldLabel} ${conditionType} ${value || ''}`;
}

interface Department {
  id: string;
  name: string;
}

interface Role {
  id: string;
  name: string;
  department_id: string;
}

interface NodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeData: WorkflowNodeData | null;
  nodeId?: string;
  allNodes?: Node<WorkflowNodeData>[];
  allEdges?: Edge[];
  onSave: (data: WorkflowNodeData, clearOutgoingEdges?: boolean) => void;
  departments: Department[];
  roles: Role[];
}

export function NodeConfigDialog({
  open,
  onOpenChange,
  nodeData,
  nodeId,
  allNodes = [],
  allEdges = [],
  onSave,
  departments,
  roles,
}: NodeConfigDialogProps) {
  const [label, setLabel] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedApproverRole, setSelectedApproverRole] = useState('');
  const [selectedFormTemplate, setSelectedFormTemplate] = useState('');
  const [allowAttachments, setAllowAttachments] = useState(false);
  const [conditionType, setConditionType] = useState<'form_value'>('form_value');
  const [conditionBranches, setConditionBranches] = useState<ConditionBranch[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isDraftForm, setIsDraftForm] = useState(false);
  const [selectedFormField, setSelectedFormField] = useState<string>('');
  const [previousConditionType, setPreviousConditionType] = useState<'form_value' | null>(null);

  // Find the source node connected TO this conditional node
  const sourceNodeInfo = useMemo(() => {
    if (nodeData?.type !== 'conditional' || !nodeId) return null;

    // Debug logging
    console.log('[NodeConfigDialog] Looking for incoming edge to conditional node:', nodeId);
    console.log('[NodeConfigDialog] Available edges:', allEdges.map(e => ({ source: e.source, target: e.target })));
    console.log('[NodeConfigDialog] Available nodes:', allNodes.map(n => ({ id: n.id, type: n.data.type })));

    // Find incoming edge to this node
    const incomingEdge = allEdges.find(e => e.target === nodeId);
    console.log('[NodeConfigDialog] Found incoming edge:', incomingEdge);
    if (!incomingEdge) return { type: 'none' as const, node: null };

    // Find the source node
    const sourceNode = allNodes.find(n => n.id === incomingEdge.source);
    console.log('[NodeConfigDialog] Found source node:', sourceNode?.data.type);
    if (!sourceNode) return { type: 'none' as const, node: null };

    return { type: sourceNode.data.type, node: sourceNode };
  }, [nodeData?.type, nodeId, allEdges, allNodes]);

  // Get ALL form fields from source form node (for form_value conditionals)
  const sourceFormFields = useMemo(() => {
    if (sourceNodeInfo?.type !== 'form' || !sourceNodeInfo.node) return [];

    const formConfig = sourceNodeInfo.node.data.config;
    if (!formConfig?.formFields) return [];

    return formConfig.formFields;
  }, [sourceNodeInfo]);

  // Get the currently selected field's details
  const selectedField = useMemo(() => {
    if (!selectedFormField || sourceFormFields.length === 0) return null;
    return sourceFormFields.find((f: FormField) => f.id === selectedFormField) || null;
  }, [selectedFormField, sourceFormFields]);

  // Get condition types for the selected field
  const availableConditionTypes = useMemo(() => {
    if (!selectedField) return [];
    return CONDITION_TYPES_BY_FIELD[selectedField.type] || [];
  }, [selectedField]);

  // State for the "Add Branch" form
  const [newBranchCondition, setNewBranchCondition] = useState<string>('');
  const [newBranchValue, setNewBranchValue] = useState<string>('');
  const [newBranchValue2, setNewBranchValue2] = useState<string>('');

  // Reset new branch form when field changes
  useEffect(() => {
    setNewBranchCondition('');
    setNewBranchValue('');
    setNewBranchValue2('');
  }, [selectedFormField]);

  // Get the selected condition type details
  const selectedConditionType = useMemo(() => {
    return availableConditionTypes.find(c => c.value === newBranchCondition) || null;
  }, [availableConditionTypes, newBranchCondition]);

  // Maximum number of branches allowed
  const MAX_BRANCHES = 5;

  // Add a new branch with the configured condition
  const addBranch = () => {
    if (!selectedField || !newBranchCondition) return;
    if (conditionBranches.length >= MAX_BRANCHES) return;

    const conditionTypeInfo = availableConditionTypes.find(c => c.value === newBranchCondition);
    if (!conditionTypeInfo) return;

    // Validate required values
    if (conditionTypeInfo.needsValue && !newBranchValue) return;
    if (conditionTypeInfo.needsValue2 && !newBranchValue2) return;

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    const label = generateBranchLabel(
      selectedField.label,
      newBranchCondition,
      newBranchValue || undefined,
      newBranchValue2 || undefined
    );

    const newBranch: ConditionBranch = {
      id: `branch-${Date.now()}`,
      label,
      value: newBranchValue,
      value2: newBranchValue2 || undefined,
      conditionType: newBranchCondition,
      color: colors[conditionBranches.length % colors.length],
    };

    setConditionBranches([...conditionBranches, newBranch]);

    // Reset the form
    setNewBranchCondition('');
    setNewBranchValue('');
    setNewBranchValue2('');
  };

  useEffect(() => {
    if (nodeData) {
      setLabel(nodeData.label);
      setSelectedDepartment(nodeData.config?.departmentId || '');
      setSelectedRole(nodeData.config?.roleId || '');
      setSelectedApproverRole(nodeData.config?.approverRoleId || '');
      setSelectedFormTemplate(nodeData.config?.formTemplateId || '');
      setAllowAttachments(nodeData.config?.allowAttachments || false);
      setFormFields(nodeData.config?.formFields || []);
      setFormName(nodeData.config?.formName || '');
      setFormDescription(nodeData.config?.formDescription || '');
      setIsDraftForm(nodeData.config?.isDraftForm || false);
      setSelectedFormField(nodeData.config?.sourceFormFieldId || '');

      // For conditional nodes, always use form_value type (approval nodes have built-in branching)
      if (nodeData.type === 'conditional') {
        setConditionType('form_value');
        setPreviousConditionType('form_value');
        // Cast conditions - they may be stored without full type info
        setConditionBranches((nodeData.config?.conditions as ConditionBranch[]) || []);
      }
    }
  }, [nodeData, sourceNodeInfo]);

  const handleSave = () => {
    if (!nodeData) return;

    const config: WorkflowNodeData['config'] = {};

    if (nodeData.type === 'department' && selectedDepartment) {
      const dept = departments.find((d) => d.id === selectedDepartment);
      config.departmentId = selectedDepartment;
      config.departmentName = dept?.name;
    }

    if (nodeData.type === 'role' && selectedRole) {
      const role = roles.find((r) => r.id === selectedRole);
      config.roleId = selectedRole;
      config.roleName = role?.name;
    }

    if (nodeData.type === 'approval') {
      if (selectedApproverRole) {
        const role = roles.find((r) => r.id === selectedApproverRole);
        config.approverRoleId = selectedApproverRole;
        config.approverRoleName = role?.name;
      }
      // Note: requiredApprovals, allowFeedback, allowSendBack removed
      // Approval/Reject paths are always available via edge connections
    }

    if (nodeData.type === 'form') {
      config.formFields = formFields;
      config.formName = formName;
      config.formDescription = formDescription;
      config.isDraftForm = isDraftForm;
    }

    if (nodeData.type === 'conditional') {
      config.conditionType = conditionType;
      if (conditionType === 'form_value') {
        config.conditions = conditionBranches;
        config.sourceFormFieldId = selectedFormField;
        // Store reference to source form node for runtime
        if (sourceNodeInfo?.node) {
          config.sourceFormNodeId = sourceNodeInfo.node.id;
        }
      }
    }

    // Check if condition type changed - if so, we need to clear outgoing edges
    const shouldClearOutgoingEdges = nodeData.type === 'conditional' &&
      previousConditionType !== null &&
      previousConditionType !== conditionType;

    onSave({
      ...nodeData,
      label,
      config,
    }, shouldClearOutgoingEdges);

    onOpenChange(false);
  };

  if (!nodeData) return null;

  const filteredRoles = selectedDepartment && selectedDepartment !== "all"
    ? roles.filter((r) => r.department_id === selectedDepartment)
    : roles;

  // Debug logging
  console.log('NodeConfigDialog - departments:', departments.length, departments);
  console.log('NodeConfigDialog - roles:', roles.length, roles);
  console.log('NodeConfigDialog - nodeData:', nodeData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {nodeData.type} Node</DialogTitle>
          <DialogDescription>
            Set up the properties for this workflow node
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="label">Label *</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter node label"
            />
          </div>

          {/* Legacy Department Node (deprecated - show warning) */}
          {nodeData.type === 'department' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800">Department nodes are deprecated</p>
              <p className="text-xs text-amber-700 mt-1">
                Please use Role nodes instead. Roles automatically include department assignment.
              </p>
            </div>
          )}

          {/* Role Selection */}
          {nodeData.type === 'role' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dept-filter">Department (optional filter)</Label>
                <Select value={selectedDepartment || "all"} onValueChange={(value) => setSelectedDepartment(value === "all" ? "" : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Approval Configuration */}
          {nodeData.type === 'approval' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="approver">Approver Role *</Label>
                <Select value={selectedApproverRole} onValueChange={setSelectedApproverRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approver role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> Approval nodes have two automatic outputs:
                  <span className="text-green-700 font-medium"> Approved</span> (continues forward) and
                  <span className="text-red-700 font-medium"> Rejected</span> (can loop back to previous steps).
                </p>
              </div>
            </>
          )}

          {/* Form Configuration */}
          {nodeData.type === 'form' && (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="fields">Form Fields</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="form-name">Form Name</Label>
                  <Input
                    id="form-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Client Briefing Form"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="form-description">Description (optional)</Label>
                  <Input
                    id="form-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe the purpose of this form"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="is-draft"
                    checked={isDraftForm}
                    onCheckedChange={(checked) => setIsDraftForm(checked as boolean)}
                  />
                  <Label htmlFor="is-draft" className="text-sm font-normal cursor-pointer">
                    Save as draft (form not active)
                  </Label>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> Forms are scoped to this workflow node. Use them to collect data from
                    departments or send briefings between teams.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="fields" className="mt-4 max-h-[400px] overflow-y-auto">
                <InlineFormBuilder
                  fields={formFields}
                  onChange={setFormFields}
                />
              </TabsContent>
            </Tabs>
          )}

          {/* Conditional Configuration */}
          {nodeData.type === 'conditional' && (
            <>
              {/* Warning if no connection or not connected to form */}
              {(sourceNodeInfo?.type === 'none' || (sourceNodeInfo && sourceNodeInfo.type !== 'form')) && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">
                        {sourceNodeInfo?.type === 'none' ? 'No incoming connection' : 'Connect to a Form node'}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        Conditional nodes are used to branch based on form field values.
                        Connect this node to a <strong>Form</strong> node first.
                      </p>
                      <p className="text-xs text-amber-600 mt-2">
                        <strong>Tip:</strong> For approval-based branching, use the Approval node directly -
                        it has built-in Approved/Rejected outputs.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Source detected - Form node */}
              {sourceNodeInfo?.type === 'form' && (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-blue-800">
                          <strong>Source: Form Node</strong> ({sourceNodeInfo.node?.data.label || sourceNodeInfo.node?.data.config?.formName || 'Unnamed Form'})
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          Select a form field to branch on. Only dropdown/multiselect fields can be used for routing.
                        </p>
                      </div>
                    </div>
                  </div>

                  {sourceFormFields.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">No form fields found</p>
                          <p className="text-xs text-amber-700 mt-1">
                            The source form doesn't have any fields.
                            Add fields to the form to enable conditional branching.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Step 1: Select Field */}
                      <div className="space-y-2">
                        <Label htmlFor="form-field">Branch on Field *</Label>
                        <Select
                          value={selectedFormField}
                          onValueChange={(value) => {
                            setSelectedFormField(value);
                            // Clear branches when switching fields
                            setConditionBranches([]);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a form field" />
                          </SelectTrigger>
                          <SelectContent>
                            {sourceFormFields.map((field: FormField) => (
                              <SelectItem key={field.id} value={field.id}>
                                {field.label} ({field.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedFormField && selectedField && (
                        <div className="space-y-4">
                          {/* Add Branch Builder */}
                          <div className="p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50/50 space-y-3">
                            <Label className="text-xs font-medium text-gray-700">Add New Branch</Label>

                            {/* Condition Type */}
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={newBranchCondition}
                                onValueChange={(value) => {
                                  setNewBranchCondition(value);
                                  setNewBranchValue('');
                                  setNewBranchValue2('');
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Condition..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableConditionTypes.map((cond) => (
                                    <SelectItem key={cond.value} value={cond.value}>
                                      {cond.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Value Input - depends on field type and condition */}
                              {selectedConditionType?.needsValue && (
                                <>
                                  {/* Dropdown/Multiselect: show options */}
                                  {(selectedField.type === 'dropdown' || selectedField.type === 'multiselect') && selectedField.options ? (
                                    <Select value={newBranchValue} onValueChange={setNewBranchValue}>
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue placeholder="Select value..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {selectedField.options.map((opt: string) => (
                                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : selectedField.type === 'number' ? (
                                    <Input
                                      type="number"
                                      value={newBranchValue}
                                      onChange={(e) => setNewBranchValue(e.target.value)}
                                      placeholder="Value..."
                                      className="h-8 text-sm"
                                    />
                                  ) : selectedField.type === 'date' ? (
                                    <Input
                                      type="date"
                                      value={newBranchValue}
                                      onChange={(e) => setNewBranchValue(e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  ) : (
                                    <Input
                                      type="text"
                                      value={newBranchValue}
                                      onChange={(e) => setNewBranchValue(e.target.value)}
                                      placeholder="Value..."
                                      className="h-8 text-sm"
                                    />
                                  )}
                                </>
                              )}
                            </div>

                            {/* Second value for "between" conditions */}
                            {selectedConditionType?.needsValue2 && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">and</span>
                                {selectedField.type === 'number' ? (
                                  <Input
                                    type="number"
                                    value={newBranchValue2}
                                    onChange={(e) => setNewBranchValue2(e.target.value)}
                                    placeholder="Max value..."
                                    className="h-8 text-sm flex-1"
                                  />
                                ) : selectedField.type === 'date' ? (
                                  <Input
                                    type="date"
                                    value={newBranchValue2}
                                    onChange={(e) => setNewBranchValue2(e.target.value)}
                                    className="h-8 text-sm flex-1"
                                  />
                                ) : (
                                  <Input
                                    type="text"
                                    value={newBranchValue2}
                                    onChange={(e) => setNewBranchValue2(e.target.value)}
                                    placeholder="Max value..."
                                    className="h-8 text-sm flex-1"
                                  />
                                )}
                              </div>
                            )}

                            <Button
                              type="button"
                              size="sm"
                              onClick={addBranch}
                              disabled={
                                conditionBranches.length >= MAX_BRANCHES ||
                                !newBranchCondition ||
                                (selectedConditionType?.needsValue && !newBranchValue) ||
                                (selectedConditionType?.needsValue2 && !newBranchValue2)
                              }
                              className="w-full h-8"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              {conditionBranches.length >= MAX_BRANCHES
                                ? `Maximum ${MAX_BRANCHES} branches reached`
                                : 'Add Branch'}
                            </Button>
                          </div>

                          {/* Branch List */}
                          <div className="space-y-2">
                            <Label className="text-xs">Output Branches ({conditionBranches.length}/{MAX_BRANCHES})</Label>
                            {conditionBranches.length === 0 ? (
                              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                <p className="text-xs text-gray-600">
                                  No branches added yet. Create conditions above to define output paths.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {conditionBranches.map((branch) => (
                                  <div key={branch.id} className="flex items-center gap-2 p-2 bg-white rounded border">
                                    <div
                                      className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: branch.color }}
                                    />
                                    <span className="flex-1 text-xs font-medium truncate" title={branch.label}>
                                      {branch.label}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                      onClick={() => {
                                        setConditionBranches(conditionBranches.filter((b) => b.id !== branch.id));
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

            </>
          )}

          {/* Sync Node Configuration */}
          {nodeData.type === 'sync' && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-indigo-800">Synchronization Point</p>
                  <p className="text-xs text-indigo-700 mt-1">
                    This node waits until <strong>all incoming parallel paths</strong> have completed
                    before allowing the workflow to continue.
                  </p>
                  <ul className="text-xs text-indigo-700 mt-2 space-y-1 list-disc list-inside">
                    <li>Connect multiple parallel branches to this node</li>
                    <li>Workflow pauses here until all branches arrive</li>
                    <li>Once all paths reach this node, workflow proceeds to the next step</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!label}>
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
