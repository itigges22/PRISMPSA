'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Shield, Building2, User } from 'lucide-react';
import { RoleHierarchyNode } from '@/lib/role-management-service';

interface OrgChartNodeData {
  type?: 'department' | 'role' | 'user';
  role?: RoleHierarchyNode;
  name?: string;
  description?: string;
  userCount?: number;
  userId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  isSelected?: boolean;
  onSelect?: () => void;
  onUserAssign?: (userId: string, roleId: string) => void;
  onRoleUpdate?: (roleId: string) => void;
  isReadOnly?: boolean;
  [key: string]: unknown;
}

function OrgChartNodeComponent({ data }: NodeProps) {
  // Cast data to our expected type
  const nodeData = data as OrgChartNodeData;
  const {
    type = 'role',
    role,
    name,
    description,
    userCount = 0,
    userId,
    user,
    isSelected = false,
    onSelect,
    onUserAssign,
    onRoleUpdate,
    isReadOnly = false,
  } = nodeData;

  const handleClick = () => {
    onSelect?.();
  };

  const handleUserAssign = () => {
    if (userId && role?.id && onUserAssign) {
      onUserAssign(userId, role.id);
    }
  };

  const handleRoleUpdate = () => {
    if (role?.id && onRoleUpdate) {
      onRoleUpdate(role.id);
    }
  };

  // Department node
  if (type === 'department') {
    return (
      <div className="relative">
        <Handle type="target" position={Position.Top} />
        <Card 
          className={`w-64 cursor-pointer transition-all hover:shadow-md ${
            isSelected ? 'ring-2 ring-primary shadow-lg' : ''
          }`}
          onClick={handleClick}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{name}</h3>
                <p className="text-xs text-muted-foreground truncate">{description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {userCount} users
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  // User node
  if (type === 'user' && user) {
    return (
      <div className="relative">
        <Handle type="target" position={Position.Top} />
        <Card 
          className={`w-48 cursor-pointer transition-all hover:shadow-md ${
            isSelected ? 'ring-2 ring-primary shadow-lg' : ''
          }`}
          onClick={handleClick}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback>
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{user.name}</h4>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  // Role node
  if (role) {
    const getRoleIcon = () => {
      if (role.is_system_role) {
        return <Shield className="h-5 w-5 text-red-500" />;
      }
      if (role.hierarchy_level >= 100) {
        return <Users className="h-5 w-5 text-blue-500" />;
      }
      return <User className="h-5 w-5 text-gray-500" />;
    };

    const getRoleColor = () => {
      if (role.is_system_role) return 'border-red-200 bg-red-50';
      if (role.hierarchy_level >= 100) return 'border-blue-200 bg-blue-50';
      if (role.hierarchy_level >= 80) return 'border-green-200 bg-green-50';
      return 'border-gray-200 bg-gray-50';
    };

    return (
      <div className="relative">
        <Handle type="target" position={Position.Top} />
        <Card 
          className={`w-64 cursor-pointer transition-all hover:shadow-md ${getRoleColor()} ${
            isSelected ? 'ring-2 ring-primary shadow-lg' : ''
          }`}
          onClick={handleClick}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white">
                {getRoleIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-sm break-words">{role.name}</h3>
                  {role.is_system_role && (
                    <Badge variant="destructive" className="text-xs shrink-0">
                      System
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground break-words mb-2">
                  {role.department_name}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {role.user_count}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Level {role.hierarchy_level}
                  </Badge>
                </div>
                {!isReadOnly && (
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRoleUpdate();
                      }}
                      className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      Edit
                    </button>
                    {onUserAssign && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUserAssign();
                        }}
                        className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  // Fallback node
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} />
      <Card className="w-48 cursor-pointer">
        <CardContent className="p-4">
          <div className="text-center">
            <h3 className="font-semibold text-sm">{name ?? 'Unknown'}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const OrgChartNode = memo(OrgChartNodeComponent);
