"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "dropdown"
  | "multiselect"
  | "url"
  | "textarea"
  | "email"
  | "checkbox";

export interface FormField {
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

const FIELD_TYPES: {
  value: FieldType;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "text",
    label: "Short Text",
    icon: "📝",
    description: "Single line text input (e.g., name, title)",
  },
  {
    value: "textarea",
    label: "Long Text",
    icon: "📄",
    description: "Multi-line text area (e.g., description, comments)",
  },
  {
    value: "email",
    label: "Email",
    icon: "📧",
    description: "Email address with validation",
  },
  {
    value: "number",
    label: "Number",
    icon: "#",
    description: "Numeric input (e.g., hours, amount)",
  },
  { value: "date", label: "Date", icon: "📅", description: "Date picker" },
  {
    value: "dropdown",
    label: "Dropdown",
    icon: "▼",
    description: "Select ONE option from a list",
  },
  {
    value: "multiselect",
    label: "Multi-Select",
    icon: "☑",
    description: "Select MULTIPLE options from a list",
  },
  {
    value: "checkbox",
    label: "Yes/No Checkbox",
    icon: "✓",
    description: "Single checkbox for yes/no questions",
  },
  {
    value: "url",
    label: "URL/Link",
    icon: "🔗",
    description: "Website URL with validation",
  },
];

interface InlineFormBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  className?: string;
}

export function InlineFormBuilder({
  fields,
  onChange,
  className = "",
}: InlineFormBuilderProps) {
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(
    null,
  );
  const [expandedFieldIndex, setExpandedFieldIndex] = useState<number | null>(
    null,
  );
  const [optionsText, setOptionsText] = useState<Record<number, string>>({});

  const addField = (type: FieldType) => {
    const newField: FormField = {
      id: uuidv4(),
      type,
      label: `New ${type} field`,
      required: false,
      placeholder: "",
      options:
        type === "dropdown" || type === "multiselect"
          ? ["Option 1", "Option 2"]
          : undefined,
    };
    onChange([...fields, newField]);
    setSelectedFieldIndex(fields.length);
    setExpandedFieldIndex(fields.length);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange(newFields);
  };

  const removeField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    onChange(newFields);
    if (selectedFieldIndex === index) {
      setSelectedFieldIndex(null);
      setExpandedFieldIndex(null);
    } else if (selectedFieldIndex !== null && selectedFieldIndex > index) {
      setSelectedFieldIndex(selectedFieldIndex - 1);
      if (expandedFieldIndex === selectedFieldIndex) {
        setExpandedFieldIndex(selectedFieldIndex - 1);
      }
    }
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [
      newFields[index],
      newFields[index - 1],
    ];
    onChange(newFields);
    if (selectedFieldIndex === index) {
      setSelectedFieldIndex(index - 1);
      setExpandedFieldIndex(index - 1);
    } else if (selectedFieldIndex === index - 1) {
      setSelectedFieldIndex(index);
      if (expandedFieldIndex === selectedFieldIndex) {
        setExpandedFieldIndex(index);
      }
    }
  };

  const moveFieldDown = (index: number) => {
    if (index === fields.length - 1) return;
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [
      newFields[index + 1],
      newFields[index],
    ];
    onChange(newFields);
    if (selectedFieldIndex === index) {
      setSelectedFieldIndex(index + 1);
      setExpandedFieldIndex(index + 1);
    } else if (selectedFieldIndex === index + 1) {
      setSelectedFieldIndex(index);
      if (expandedFieldIndex === selectedFieldIndex) {
        setExpandedFieldIndex(index);
      }
    }
  };

  const toggleExpanded = (index: number) => {
    if (expandedFieldIndex === index) {
      setExpandedFieldIndex(null);
    } else {
      setExpandedFieldIndex(index);
      setSelectedFieldIndex(index);
    }
  };

  const updateFieldOptions = (index: number, optionsText: string) => {
    // Support both comma-separated and newline-separated options
    const options = optionsText
      .split(/[,\n]+/) // Split by comma or newline
      .map((opt) => opt.trim())
      .filter((opt) => opt !== "");
    updateField(index, { options });
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${className}`}>
      {/* Left Column - Form Builder */}
      <div className="space-y-4">
        {/* Field Type Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Add Field</CardTitle>
            <CardDescription className="text-xs">
              Choose a field type to add to the form
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {FIELD_TYPES.map((fieldType) => (
                <Button
                  key={fieldType.value}
                  variant="outline"
                  size="sm"
                  onClick={() => { addField(fieldType.value); }}
                  className="justify-start text-xs h-8"
                >
                  <span className="mr-1">{fieldType.icon}</span>
                  {fieldType.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fields List */}
        {fields.length === 0 ? (
          <Card>
            <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
              No fields yet. Add a field above to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => {
              const isExpanded = expandedFieldIndex === index;
              const fieldTypeInfo = FIELD_TYPES.find(
                (ft) => ft.value === field.type,
              );

              return (
                <Card key={field.id} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => { toggleExpanded(index); }}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <span className="text-sm">{fieldTypeInfo?.icon}</span>
                      <span className="text-sm font-medium">{field.label}</span>
                      {field.required && (
                        <Badge variant="secondary" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { moveFieldUp(index); }}
                        disabled={index === 0}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { moveFieldDown(index); }}
                        disabled={index === fields.length - 1}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { removeField(index); }}
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 pt-0 space-y-3 border-t">
                      {/* Field Label */}
                      <div className="space-y-1">
                        <Label
                          htmlFor={`field-${index}-label`}
                          className="text-xs"
                        >
                          Field Label *
                        </Label>
                        <Input
                          id={`field-${index}-label`}
                          value={field.label}
                          onChange={(e) =>
                            { updateField(index, { label: e.target.value }); }
                          }
                          placeholder="Enter field label"
                          className="h-8 text-sm"
                        />
                      </div>

                      {/* Field Type */}
                      <div className="space-y-1">
                        <Label className="text-xs">Field Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => {
                            const newType = value as FieldType;
                            const updates: Partial<FormField> = {
                              type: newType,
                            };
                            if (
                              newType === "dropdown" ||
                              newType === "multiselect"
                            ) {
                              updates.options = field.options ?? [
                                "Option 1",
                                "Option 2",
                              ];
                            } else {
                              updates.options = undefined;
                            }
                            updateField(index, updates);
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((ft) => (
                              <SelectItem
                                key={ft.value}
                                value={ft.value}
                                className="text-sm"
                              >
                                {ft.icon} {ft.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Placeholder */}
                      {field.type !== "checkbox" && (
                        <div className="space-y-1">
                          <Label
                            htmlFor={`field-${index}-placeholder`}
                            className="text-xs"
                          >
                            Placeholder Text (shown before user enters data)
                          </Label>
                          <Input
                            id={`field-${index}-placeholder`}
                            value={field.placeholder ?? ""}
                            onChange={(e) =>
                              updateField(index, {
                                placeholder: e.target.value,
                              })
                            }
                            placeholder={
                              field.type === "email"
                                ? "e.g., Enter your email"
                                : field.type === "number"
                                  ? "e.g., Enter hours"
                                  : field.type === "date"
                                    ? "e.g., Select a date"
                                    : field.type === "url"
                                      ? "e.g., https://example.com"
                                      : "e.g., Enter value here"
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      )}

                      {/* Options (for dropdown/multiselect) */}
                      {(field.type === "dropdown" ||
                        field.type === "multiselect") && (
                        <div className="space-y-1">
                          <Label
                            htmlFor={`field-${index}-options`}
                            className="text-xs"
                          >
                            Options (comma-separated) *
                          </Label>
                          <Textarea
                            id={`field-${index}-options`}
                            value={
                              optionsText[index] !== undefined
                                ? optionsText[index]
                                : (field.options ?? []).join(", ")
                            }
                            onChange={(e) =>
                              setOptionsText({
                                ...optionsText,
                                [index]: e.target.value,
                              })
                            }
                            onBlur={(e) => {
                              updateFieldOptions(index, e.target.value);
                              setOptionsText((prev) => {
                                const newState = { ...prev };
                                delete newState[index];
                                return newState;
                              });
                            }}
                            placeholder="Option 1, Option 2, Option 3"
                            rows={3}
                            className="text-sm font-mono"
                          />
                        </div>
                      )}

                      {/* Required Toggle */}
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`field-${index}-required`}
                          className="text-xs"
                        >
                          Required Field
                        </Label>
                        <Switch
                          id={`field-${index}-required`}
                          checked={field.required}
                          onCheckedChange={(checked) =>
                            { updateField(index, { required: checked }); }
                          }
                        />
                      </div>

                      {/* Validation (for specific field types) */}
                      {(field.type === "number" ||
                        field.type === "text" ||
                        field.type === "textarea") && (
                        <div className="space-y-2 border-t pt-3">
                          <Label className="text-xs font-semibold">
                            Validation Rules (optional)
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            {field.type === "number" && (
                              <>
                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`field-${index}-min`}
                                    className="text-xs"
                                  >
                                    Minimum Value
                                  </Label>
                                  <Input
                                    id={`field-${index}-min`}
                                    type="number"
                                    value={field.validation?.min || ""}
                                    onChange={(e) =>
                                      updateField(index, {
                                        validation: {
                                          ...field.validation,
                                          min: e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                        },
                                      })
                                    }
                                    placeholder="e.g., 0"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`field-${index}-max`}
                                    className="text-xs"
                                  >
                                    Maximum Value
                                  </Label>
                                  <Input
                                    id={`field-${index}-max`}
                                    type="number"
                                    value={field.validation?.max ?? ""}
                                    onChange={(e) =>
                                      updateField(index, {
                                        validation: {
                                          ...field.validation,
                                          max: e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                        },
                                      })
                                    }
                                    placeholder="e.g., 100"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </>
                            )}
                            {(field.type === "text" ||
                              field.type === "textarea") && (
                              <>
                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`field-${index}-min-length`}
                                    className="text-xs"
                                  >
                                    Minimum Length (characters)
                                  </Label>
                                  <Input
                                    id={`field-${index}-min-length`}
                                    type="number"
                                    value={field.validation?.min || ""}
                                    onChange={(e) =>
                                      updateField(index, {
                                        validation: {
                                          ...field.validation,
                                          min: e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                        },
                                      })
                                    }
                                    placeholder="e.g., 3"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label
                                    htmlFor={`field-${index}-max-length`}
                                    className="text-xs"
                                  >
                                    Maximum Length (characters)
                                  </Label>
                                  <Input
                                    id={`field-${index}-max-length`}
                                    type="number"
                                    value={field.validation?.max || ""}
                                    onChange={(e) =>
                                      updateField(index, {
                                        validation: {
                                          ...field.validation,
                                          max: e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                        },
                                      })
                                    }
                                    placeholder="e.g., 500"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {fields.length > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            {fields.length} field{fields.length !== 1 ? "s" : ""} added
          </div>
        )}
      </div>

      {/* Right Column - Form Preview */}
      <div className="space-y-4">
        <Card className="sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Form Preview</CardTitle>
            <CardDescription className="text-xs">
              See how your form will look to users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Add fields to see preview
              </div>
            ) : (
              fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <Label className="text-sm">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </Label>

                  {field.type === "text" && (
                    <Input
                      placeholder={field.placeholder ?? "Enter text"}
                      disabled
                      className="bg-gray-50"
                    />
                  )}

                  {field.type === "textarea" && (
                    <Textarea
                      placeholder={field.placeholder || "Enter text"}
                      disabled
                      rows={3}
                      className="bg-gray-50"
                    />
                  )}

                  {field.type === "email" && (
                    <Input
                      type="email"
                      placeholder={field.placeholder ?? "Enter email"}
                      disabled
                      className="bg-gray-50"
                    />
                  )}

                  {field.type === "number" && (
                    <Input
                      type="number"
                      placeholder={field.placeholder ?? "Enter number"}
                      disabled
                      className="bg-gray-50"
                    />
                  )}

                  {field.type === "date" && (
                    <Input type="date" disabled className="bg-gray-50" />
                  )}

                  {field.type === "url" && (
                    <Input
                      type="url"
                      placeholder={field.placeholder ?? "https://example.com"}
                      disabled
                      className="bg-gray-50"
                    />
                  )}

                  {field.type === "dropdown" && (
                    <Select disabled>
                      <SelectTrigger className="bg-gray-50">
                        <SelectValue
                          placeholder={field.placeholder ?? "Select an option"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options ?? []).map((option, idx) => (
                          <SelectItem key={idx} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {field.type === "multiselect" && (
                    <div className="space-y-2 p-3 border rounded-md bg-gray-50">
                      {(field.options || []).map((option, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <input type="checkbox" disabled className="rounded" />
                          <span className="text-sm">{option}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {field.type === "checkbox" && (
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" disabled className="rounded" />
                      <span className="text-sm text-muted-foreground">
                        {field.placeholder ?? "Check this box"}
                      </span>
                    </div>
                  )}

                  {field.validation && (
                    <div className="text-xs text-muted-foreground">
                      {field.validation.min !== undefined &&
                      field.validation.max !== undefined ? (
                        <span>
                          {field.type === "number"
                            ? `Range: ${field.validation.min} - ${field.validation.max}`
                            : `Length: ${field.validation.min} - ${field.validation.max} characters`}
                        </span>
                      ) : field.validation.min !== undefined ? (
                        <span>
                          {field.type === "number"
                            ? `Minimum: ${field.validation.min}`
                            : `Min length: ${field.validation.min} characters`}
                        </span>
                      ) : field.validation.max !== undefined ? (
                        <span>
                          {field.type === "number"
                            ? `Maximum: ${field.validation.max}`
                            : `Max length: ${field.validation.max} characters`}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
