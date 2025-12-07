'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronRight, 
  ChevronDown, 
  GripVertical, 
  Edit, 
  Trash2,
  UserPlus,
  Users,
  Shield,
  Loader2,
  ArrowUp
} from 'lucide-react';
import { toast } from 'sonner';

export interface RoleWithUsers {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  department_name: string | null;
  hierarchy_level: number;
  display_order: number;
  reporting_role_id: string | null;
  is_system_role: boolean;
  permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
  user_count: number;
  users: Array<{
    id: string;
    name: string;
    email: string;
    image: string | null;
  }>;
  department: {
    id: string;
    name: string;
  };
  reporting_role?: {
    id: string;
    name: string;
  };
  depth?: number;
}

interface SortableRoleItemProps {
  role: RoleWithUsers;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (role: RoleWithUsers) => void;
  onDelete: (roleId: string) => void;
  onAssignUser: (role: RoleWithUsers) => void;
  onSetReportingRole: (role: RoleWithUsers) => void;
  isReadOnly: boolean;
}

function SortableRoleItem({ 
  role, 
  depth, 
  expanded, 
  onToggle, 
  onEdit,
  onDelete, 
  onAssignUser,
  onSetReportingRole,
  isReadOnly 
}: SortableRoleItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role.id });
  
  const style = {
    paddingLeft: `${depth * 24}px`,
    transform: CSS.Transform.toString(transform),
    transition,
  };

  console.log(`🎨 Rendering ${role.name} with depth ${depth} (padding: ${depth * 24}px)`);

  const hasChildren = role.user_count > 0;
  const isSystemRole = role.is_system_role || role.name === 'Superadmin' || role.name === 'No Assigned Role';

  return (
    <>
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-2 px-3 rounded-lg border bg-white hover:bg-gray-50 shadow-sm ${
        role.is_system_role ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Drag Handle - only for non-system roles */}
      {!isSystemRole && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab hover:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {/* Expand/Collapse Button */}
      <button
        onClick={onToggle}
        className="p-0.5 hover:bg-gray-200 rounded"
        disabled={!hasChildren}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )
        ) : (
          <div className="h-4 w-4" />
        )}
      </button>

      {/* Role Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{role.name}</span>
          {role.is_system_role && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <Shield className="h-3 w-3" />
              System
            </Badge>
          )}
          {role.department_name && (
            <Badge variant="outline" className="text-xs truncate">
              {role.department_name}
            </Badge>
          )}
        </div>
        {role.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{role.description}</p>
        )}
      </div>

      {/* Hierarchy Level Badge - Editable */}
      <div className="flex items-center gap-2">
        <Badge 
          variant="secondary" 
          className="text-sm font-mono px-2 cursor-help" 
          title="Hierarchy Level (100 = highest, 1 = lowest)"
        >
          Level {role.hierarchy_level}
        </Badge>
        {role.reporting_role_id && (
          <Badge 
            variant="outline" 
            className="text-xs"
            title={`Reports to: ${role.reporting_role?.name ?? 'Unknown'}`}
          >
            Reports to: {role.reporting_role?.name ?? 'Unknown'}
          </Badge>
        )}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>{role.user_count}</span>
        </div>
      </div>

      {/* Action Buttons - Only show if user has permissions */}
      {!isReadOnly && (
        <div className="flex items-center gap-1">
          {/* Assign User button - only show if user has ASSIGN_USERS_TO_ROLES permission */}
          {/* Note: We check this via isReadOnly prop which comes from parent permission checks */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { onAssignUser(role); }}
            className="h-7 w-7 p-0"
            title="Assign User"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
          {/* Set Reporting Role - only if user can edit roles */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { onSetReportingRole(role); }}
            className="h-7 w-7 p-0"
            title="Set Reporting Role"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          {/* Edit button - only show if user can edit roles and role is not system role */}
          {role.name !== 'No Assigned Role' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { onEdit(role); }}
              className="h-7 w-7 p-0"
              title="Edit Role"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
          {/* Delete button - only show if user can delete roles and role is deletable */}
          {!role.is_system_role && role.name !== 'No Assigned Role' && role.name !== 'Superadmin' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { onDelete(role.id); }}
              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="Delete Role"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
    
    {/* Show users when expanded */}
    {expanded && hasChildren && role.users && role.users.length > 0 && (
      <div className="mt-2 ml-12 space-y-1">
        {role.users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-2 py-1.5 px-3 bg-gray-50 rounded text-sm"
          >
            <Users className="h-3.5 w-3.5 text-gray-400" />
            <span className="flex-1">{user.name}</span>
            <span className="text-xs text-gray-500">{user.email}</span>
          </div>
        ))}
      </div>
    )}
  </>
  );
}

interface RoleHierarchyDndProps {
  roles: RoleWithUsers[];
  onRoleUpdate: () => void;
  onEdit: (role: RoleWithUsers) => void;
  onDelete: (roleId: string) => void;
  onAssignUser: (role: RoleWithUsers) => void;
  onSetReportingRole: (role: RoleWithUsers) => void;
  isReadOnly: boolean;
  onEditModeChange?: (isEditMode: boolean) => void; // Notify parent of edit mode changes
  pendingRoleEdits?: Map<string, unknown>; // NEW: Role edits queued in parent
  pendingUserAssignments?: Array<{roleId: string, userId: string, userName: string}>; // NEW: User assignments queued in parent (from dialogs)
  onHasUnsavedChanges?: (hasChanges: boolean) => void; // NEW: Notify parent of unsaved changes
}

export function RoleHierarchyDnd({
  roles,
  onRoleUpdate,
  onEdit,
  onDelete,
  onAssignUser,
  onSetReportingRole,
  isReadOnly,
  onEditModeChange,
  pendingRoleEdits = new Map(),
  pendingUserAssignments: parentPendingUserAssignments = [],
  onHasUnsavedChanges
}: RoleHierarchyDndProps) {
  const [items, setItems] = useState<RoleWithUsers[]>(roles);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  // Simple state - no edit mode needed
  const [isSaving, setIsSaving] = useState(false);
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    console.log('🔄 useEffect triggered with:', {
      rolesLength: roles.length,
      rolesData: roles.map(r => `${r.name} (Level ${r.hierarchy_level}, Order ${r.display_order})`)
    });
    
    // Don't sort here - let buildHierarchyTree handle the proper ordering
    // Just set the roles as they come from the API
    setItems(roles);
  }, [roles]);

  // Simple state management - no edit mode needed

  // Drag & drop removed - using reporting relationships only

  // Drag & drop handlers removed - using reporting relationships only

  function toggleExpanded(roleId: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }
  
  // Edit mode removed - all actions available at all times
  
  // Simple direct handlers - no edit mode needed
  function handleEdit(role: RoleWithUsers) {
    onEdit(role);
  }
  
  function handleDelete(roleId: string) {
    onDelete(roleId);
  }
  
  function handleAssignUser(role: RoleWithUsers) {
    onAssignUser(role);
  }
  
  function handleSetReportingRole(role: RoleWithUsers) {
    onSetReportingRole(role);
  }
  
  // Handle drag end for reordering roles with proper parent-child handling
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }
    
    const activeIndex = items.findIndex((item) => item.id === active.id);
    const overIndex = items.findIndex((item) => item.id === over.id);
    
    if (activeIndex === -1 || overIndex === -1) {
      return;
    }
    
    const activeRole = items[activeIndex];
    const overRole = items[overIndex];
    
    // Don't allow reordering system roles
    if (activeRole.is_system_role || overRole.is_system_role) {
      toast.error('Cannot reorder system roles');
      return;
    }
    
    // Check if we're moving a parent role - if so, we need to move all children too
    const isParentRole = items.some(role => role.reporting_role_id === activeRole.id);
    
    if (isParentRole) {
      // Moving a parent role - collect all children recursively
      const childrenToMove = new Set<string>();
      
      function collectChildren(parentId: string) {
        const children = items.filter(role => role.reporting_role_id === parentId);
        for (const child of children) {
          childrenToMove.add(child.id);
          collectChildren(child.id); // Recursively collect grandchildren
        }
      }
      
      collectChildren(activeRole.id);
      
      // Get all roles that need to move (parent + all children)
      const rolesToMove = [activeRole, ...items.filter(role => childrenToMove.has(role.id))];
      const rolesToMoveIds = new Set(rolesToMove.map(role => role.id));
      
      // Get roles that don't need to move
      const otherRoles = items.filter(role => !rolesToMoveIds.has(role.id));
      
      // Find the insertion point
      const overIndexInOther = otherRoles.findIndex(role => role.id === overRole.id);
      
      if (overIndexInOther === -1) {
        // Insert at the end
        const newItems = [...otherRoles, ...rolesToMove];
        setItems(newItems);
        
        // Update display orders for all moved roles
        rolesToMove.forEach((role, index) => {
          role.display_order = otherRoles.length + index + 1;
        });
        
        // Save the changes
        void saveDisplayOrderChanges(rolesToMove);
      } else {
        // Insert at the specified position
        const newItems = [
          ...otherRoles.slice(0, overIndexInOther),
          ...rolesToMove,
          ...otherRoles.slice(overIndexInOther)
        ];
        setItems(newItems);
        
        // Update display orders for all roles
        newItems.forEach((role, index) => {
          role.display_order = index + 1;
        });
        
        // Save the changes
        void saveDisplayOrderChanges(newItems);
      }
      
      toast.success(`Moved ${activeRole.name} and ${childrenToMove.size} child role(s)`);
    } else {
      // Moving a single role - only allow reordering within the same hierarchy level
      if (activeRole.hierarchy_level !== overRole.hierarchy_level) {
        toast.error('Can only reorder roles at the same hierarchy level');
        return;
      }
      
      // Reorder the items
      const newItems = arrayMove(items, activeIndex, overIndex);
      setItems(newItems);
      
      // Update display orders for roles at the same level
      const sameLevelRoles = newItems.filter(role => role.hierarchy_level === activeRole.hierarchy_level);
      sameLevelRoles.forEach((role, index) => {
        role.display_order = index + 1;
      });
      
      // Save the changes
      void saveDisplayOrderChanges(sameLevelRoles);
    }
  }
  
  // Save display order changes to the database
  async function saveDisplayOrderChanges(rolesToUpdate: RoleWithUsers[]) {
    setIsSaving(true);
    
    try {
      const updatePromises = rolesToUpdate.map(role => 
        fetch('/api/roles/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roleId: role.id,
            newDisplayOrder: role.display_order,
            newHierarchyLevel: role.hierarchy_level,
            newReportingRoleId: role.reporting_role_id
          })
        })
      );
      
      await Promise.all(updatePromises);
      toast.success('Role order updated successfully');
      
      // Reload data to ensure consistency
       onRoleUpdate();
    } catch (error) {
      console.error('Error updating role order:', error);
      toast.error('Failed to update role order');
    } finally {
      setIsSaving(false);
    }
  }

  // Build hierarchy tree for rendering with proper parent-child nesting
  function buildHierarchyTree(roles: RoleWithUsers[]): RoleWithUsers[] {
    console.log('🌳 Building hierarchy tree with roles:', roles.map(r => `${r.name} (Level ${r.hierarchy_level}, Reports to: ${(r.reporting_role?.name ?? r.reporting_role_id) || 'none'})`));
    
    // Create a map for quick lookup
    const roleMap = new Map(roles.map(role => [role.id, role]));
    
    // Find root roles (roles with no reporting role or highest level)
    const maxLevel = Math.max(...roles.map(r => r.hierarchy_level));
    const rootRoles = roles
      .filter(role => !role.reporting_role_id || role.hierarchy_level === maxLevel)
      .sort((a, b) => {
        // Superadmin should always be first
        if (a.name === 'Superadmin') return -1;
        if (b.name === 'Superadmin') return 1;
        // Sort by hierarchy level (descending) then by display order
        if (a.hierarchy_level !== b.hierarchy_level) {
          return b.hierarchy_level - a.hierarchy_level;
        }
        return a.display_order - b.display_order;
      });
    
    console.log('🌳 Root roles:', rootRoles.map(r => `${r.name} (Level ${r.hierarchy_level})`));
    
    const result: RoleWithUsers[] = [];
    const addedRoles = new Set<string>();
    
    // Recursively build the tree starting from root roles
    function buildTree(parentRole: RoleWithUsers | null, depth: number = 0): void {
      if (!parentRole) {
        // Process root roles
        for (const role of rootRoles) {
          if (!addedRoles.has(role.id)) {
            addedRoles.add(role.id);
            result.push({ ...role, depth });
            console.log(`🌳 Added root ${role.name} at depth ${depth}`);
            // Recursively process children
            buildTree(role, depth + 1);
          }
        }
        return;
      }
      
      // Find direct children of this parent
      const children = roles
        .filter(role => role.reporting_role_id === parentRole.id && !addedRoles.has(role.id))
        .sort((a, b) => a.display_order - b.display_order);
      
      console.log(`🌳 Children of ${parentRole.name}:`, children.map(r => `${r.name} (Level ${r.hierarchy_level})`));
      
      // Add each child and recursively process their children
      for (const child of children) {
        addedRoles.add(child.id);
        result.push({ ...child, depth });
        console.log(`🌳 Added child ${child.name} at depth ${depth} under ${parentRole.name}`);
        // Recursively process children of this child
        buildTree(child, depth + 1);
      }
    }
    
    // Start building the tree from root roles
    buildTree(null);
    
    // Add any orphaned roles (roles that weren't added due to missing parent)
    const orphanedRoles = roles.filter(role => !addedRoles.has(role.id));
    if (orphanedRoles.length > 0) {
      console.log('🌳 Orphaned roles (missing parent):', orphanedRoles.map(r => `${r.name} (reports to: ${r.reporting_role?.name ?? r.reporting_role_id})`));
      // Sort orphaned roles by hierarchy level (descending) then by display order
      const sortedOrphans = orphanedRoles.sort((a, b) => {
        if (a.hierarchy_level !== b.hierarchy_level) {
          return b.hierarchy_level - a.hierarchy_level;
        }
        return a.display_order - b.display_order;
      });
      result.push(...sortedOrphans.map(role => ({ ...role, depth: 0 })));
    }
    
    console.log('🌳 Final hierarchy tree:', result.map(r => `${'  '.repeat(r.depth ?? 0)}${r.name} (Level ${r.hierarchy_level})`));
    return result;
  }

  const hierarchyTree = buildHierarchyTree(items);
  console.log('🌳 Hierarchy tree for rendering:', hierarchyTree.map(r => `${r.name} (Level ${r.hierarchy_level})`));

  return (
    <div className="space-y-4">
      {/* Drag and Drop Context for reordering roles at the same level */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={hierarchyTree.map(role => role.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {hierarchyTree.map((role, index) => (
              <SortableRoleItem
                key={`${role.id}-${role.hierarchy_level}-${role.display_order}-${index}`}
                role={role}
                depth={role.depth ?? 0}
                expanded={expandedIds.has(role.id)}
                onToggle={() => { toggleExpanded(role.id); }}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAssignUser={handleAssignUser}
                onSetReportingRole={handleSetReportingRole}
                isReadOnly={isReadOnly}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

