'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Users, Shield, Building2 } from 'lucide-react';
import { RoleHierarchyNode } from '@/lib/role-management-service';
import { organizationService } from '@/lib/organization-service';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { logger, componentRender, componentError } from '@/lib/debug-logger';

interface HierarchyViewProps {
  searchQuery?: string;
  selectedDepartment?: string;
  onRoleSelect?: (role: RoleHierarchyNode) => void;
  onUserAssign?: (userId: string, roleId: string) => void;
  onRoleUpdate?: (roleId: string) => void;
  onRoleDelete?: (roleId: string) => void;
  isReadOnly?: boolean;
}

interface TreeNodeProps {
  node: RoleHierarchyNode;
  level: number;
  isExpanded: boolean;
  onToggle: (nodeId: string) => void;
  onRoleSelect?: (role: RoleHierarchyNode) => void;
  onUserAssign?: (userId: string, roleId: string) => void;
  onRoleUpdate?: (roleId: string) => void;
  onRoleDelete?: (roleId: string) => void;
  isReadOnly?: boolean;
  searchQuery?: string;
  selectedDepartment?: string;
}

function TreeNode({
  node,
  level,
  isExpanded,
  onToggle,
  onRoleSelect,
  onUserAssign,
  onRoleUpdate,
  onRoleDelete,
  isReadOnly = false,
  searchQuery = '',
  selectedDepartment,
}: TreeNodeProps) {
  const [roleUsers, setRoleUsers] = useState<any[]>([]);
  const [showUsers, setShowUsers] = useState(false);

  // Filter by search query
  const matchesSearch = !searchQuery || 
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.department_name.toLowerCase().includes(searchQuery.toLowerCase());

  // Filter by selected department
  const matchesDepartment = !selectedDepartment || node.department_id === selectedDepartment;

  const shouldShow = matchesSearch && matchesDepartment;

  useEffect(() => {
    if (showUsers && node.id) {
      loadRoleUsers();
    }
  }, [showUsers, node.id]);

  const loadRoleUsers = async () => {
    try {
      logger.debug('Loading role users', { 
        action: 'loadRoleUsers', 
        roleId: node.id 
      });
      
      const users = await organizationService.getUsersByRole(node.id);
      setRoleUsers(users);
      
      logger.debug('Role users loaded successfully', { 
        action: 'loadRoleUsers', 
        roleId: node.id,
        userCount: users.length
      });
    } catch (error) {
      componentError('HierarchyView', error as Error, { 
        action: 'loadRoleUsers',
        roleId: node.id
      });
      logger.error('Error loading role users', { 
        action: 'loadRoleUsers', 
        roleId: node.id 
      }, error as Error);
      setRoleUsers([]);
    }
  };

  const handleToggle = () => {
    onToggle(node.id);
  };

  const handleRoleClick = () => {
    onRoleSelect?.(node);
  };

  const handleUserAssign = (userId: string) => {
    if (onUserAssign) {
      onUserAssign(userId, node.id);
    }
  };

  const handleRoleUpdate = () => {
    if (onRoleUpdate) {
      onRoleUpdate(node.id);
    }
  };

  const handleRoleDelete = () => {
    if (onRoleDelete) {
      onRoleDelete(node.id);
    }
  };

  if (!shouldShow) {
    return null;
  }

  const getRoleIcon = () => {
    if (node.is_system_role) {
      return <Shield className="h-4 w-4 text-red-500" />;
    }
    if (node.hierarchy_level >= 100) {
      return <Users className="h-4 w-4 text-blue-500" />;
    }
    return <Users className="h-4 w-4 text-gray-500" />;
  };

  const getRoleColor = () => {
    if (node.is_system_role) return 'border-red-200 bg-red-50';
    if (node.hierarchy_level >= 100) return 'border-blue-200 bg-blue-50';
    if (node.hierarchy_level >= 80) return 'border-green-200 bg-green-50';
    return 'border-gray-200 bg-gray-50';
  };

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${getRoleColor()}`}
        style={{ marginLeft: `${level * 20}px` }}
        onClick={handleRoleClick}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
        >
          {node.children.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getRoleIcon()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm break-words">{node.name}</h3>
              {node.is_system_role && (
                <Badge variant="destructive" className="text-xs shrink-0">
                  System
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground break-words">
              {node.department_name} • Level {node.hierarchy_level}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {node.user_count} users
          </Badge>
          
          {!isReadOnly && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUsers(!showUsers);
                }}
              >
                {showUsers ? 'Hide' : 'Show'} Users
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleUpdate();
                }}
              >
                Edit
              </Button>
              {!node.is_system_role && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRoleDelete();
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Users List */}
      {showUsers && roleUsers.length > 0 && (
        <div className="ml-8 space-y-1">
          {roleUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 p-2 bg-muted/30 rounded border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
              {!isReadOnly && onUserAssign && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => handleUserAssign(user.id)}
                >
                  Reassign
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Children */}
      {isExpanded && node.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          level={level + 1}
          isExpanded={isExpanded}
          onToggle={onToggle}
          onRoleSelect={onRoleSelect}
          onUserAssign={onUserAssign}
          onRoleUpdate={onRoleUpdate}
          onRoleDelete={onRoleDelete}
          isReadOnly={isReadOnly}
          searchQuery={searchQuery}
          selectedDepartment={selectedDepartment}
        />
      ))}
    </div>
  );
}

export function HierarchyView({
  searchQuery = '',
  selectedDepartment,
  onRoleSelect,
  onUserAssign,
  onRoleUpdate,
  onRoleDelete,
  isReadOnly = false,
}: HierarchyViewProps) {
  const [hierarchy, setHierarchy] = useState<RoleHierarchyNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHierarchy();
  }, []);

  const loadHierarchy = async () => {
    try {
      setLoading(true);
      const hierarchyData = await organizationService.getHierarchyView();
      if (hierarchyData) {
        setHierarchy(hierarchyData.nodes);
        // Auto-expand first level
        const firstLevelIds = hierarchyData.nodes.map(node => node.id);
        setExpandedNodes(new Set(firstLevelIds));
      }
    } catch (error) {
      console.error('Error loading hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleRoleSelect = (role: RoleHierarchyNode) => {
    onRoleSelect?.(role);
  };

  const handleUserAssign = (userId: string, roleId: string) => {
    onUserAssign?.(userId, roleId);
  };

  const handleRoleUpdate = (roleId: string) => {
    onRoleUpdate?.(roleId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading hierarchy...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary component="HierarchyView">
      <div className="space-y-2">
        {hierarchy.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No roles found
          </p>
        ) : (
          hierarchy.map((node) => (
            <ErrorBoundary key={node.id} component="TreeNode">
              <TreeNode
                node={node}
                level={0}
                isExpanded={expandedNodes.has(node.id)}
                onToggle={handleToggle}
                onRoleSelect={handleRoleSelect}
                onUserAssign={handleUserAssign}
                onRoleUpdate={handleRoleUpdate}
                onRoleDelete={onRoleDelete}
                isReadOnly={isReadOnly}
                searchQuery={searchQuery}
                selectedDepartment={selectedDepartment}
              />
            </ErrorBoundary>
          ))
        )}
      </div>
    </ErrorBoundary>
  );
}
