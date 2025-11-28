'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  SaveIcon
} from 'lucide-react';
import { createClientSupabase } from '@/lib/supabase';

interface Role {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  permissions: any;
  created_at: string;
  updated_at: string;
  user_count?: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  user_roles: {
    id: string;
    role_id: string;
    roles: Role;
  }[];
}

interface DepartmentSettings {
  id: string;
  name: string;
  description: string | null;
  notification_settings: any;
  workflow_rules: any;
}

interface DepartmentAdminTabsProps {
  departmentId: string;
}

export default function DepartmentAdminTabs({ departmentId }: DepartmentAdminTabsProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departmentSettings, setDepartmentSettings] = useState<DepartmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    description: '',
    notificationSettings: {
      projectDeadlines: true,
      taskAssignments: true,
      deliverableApprovals: true,
      weeklyDigest: true,
    },
    workflowRules: {
      requireApproval: false,
      autoAssignTasks: false,
      defaultPriority: 'medium',
    }
  });

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, [departmentId]);

  const loadData = async () => {
    try {
      const supabase = createClientSupabase();
      if (!supabase) return;

      // Load roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select(`
          *,
          user_roles!user_roles_role_id_fkey(count)
        `)
        .eq('department_id', departmentId)
        .order('name');

      if (rolesError) {
        console.error('Error loading roles:', rolesError);
      } else {
        const rolesWithCount = rolesData?.map((role: any) => ({
          ...role,
          user_count: role.user_roles?.[0]?.count || 0
        })) || [];
        setRoles(rolesWithCount);
      }

      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          name,
          email,
          image,
          user_roles!user_roles_user_id_fkey (
            id,
            role_id,
            roles!user_roles_role_id_fkey (
              id,
              name,
              department_id
            )
          )
        `)
        .order('name');

      if (usersError) {
        console.error('Error loading users:', usersError);
      } else {
        setUsers(usersData || []);
      }

      // Load department settings
      const { data: departmentData, error: departmentError } = await supabase
        .from('departments')
        .select('*')
        .eq('id', departmentId)
        .single();

      if (departmentError) {
        console.error('Error loading department:', departmentError);
      } else {
        setDepartmentSettings(departmentData);
        setSettingsForm({
          name: departmentData.name,
          description: departmentData.description || '',
          notificationSettings: departmentData.notification_settings || {
            projectDeadlines: true,
            taskAssignments: true,
            deliverableApprovals: true,
            weeklyDigest: true,
          },
          workflowRules: departmentData.workflow_rules || {
            requireApproval: false,
            autoAssignTasks: false,
            defaultPriority: 'medium',
          }
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleSaveSettings = async () => {
    try {
      const supabase = createClientSupabase();
      if (!supabase) return;

      const { error } = await supabase
        .from('departments')
        .update({
          name: settingsForm.name,
          description: settingsForm.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', departmentId);

      if (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings. Please try again.');
        return;
      }

      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('An error occurred. Please try again.');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading...</div>;
  }

  return (
    <Tabs defaultValue="team" className="w-full">
      <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 h-auto sm:h-10">
        <TabsTrigger value="team" className="text-xs sm:text-sm py-2 sm:py-1.5">Team Overview</TabsTrigger>
        <TabsTrigger value="settings" className="text-xs sm:text-sm py-2 sm:py-1.5">Department Settings</TabsTrigger>
      </TabsList>


      {/* Team Overview Tab */}
      <TabsContent value="team" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Team Overview</CardTitle>
            <CardDescription>
              View team members and their roles in this department
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{users.length}</div>
                  <div className="text-sm text-muted-foreground">Total Users</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{roles.length}</div>
                  <div className="text-sm text-muted-foreground">Roles in Department</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {users.filter(user => 
                      user.user_roles.some(ur => ur.roles.department_id === departmentId)
                    ).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Assigned Users</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current User-Role Assignments */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members & Roles</CardTitle>
            <CardDescription>
              View team members and their current role assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map((user) => {
                const userRoles = user.user_roles
                  .filter(ur => ur.roles.department_id === departmentId);
                
                if (userRoles.length === 0) {
                  return null;
                }

                return (
                  <div key={user.id} className="border rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{user.name}</div>
                        <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {userRoles.map((userRole) => (
                          <Badge key={userRole.id} variant="secondary" className="text-xs">
                            {userRole.roles.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {users.every(user => 
                user.user_roles.filter(ur => ur.roles.department_id === departmentId).length === 0
              ) && (
                <div className="text-center py-8 text-muted-foreground">
                  No team members assigned to roles in this department
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Department Settings Tab */}
      <TabsContent value="settings" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Department Configuration</CardTitle>
            <CardDescription>
              Configure department settings and workflow rules
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dept-name">Department Name</Label>
                <Input
                  id="dept-name"
                  value={settingsForm.name}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-description">Description</Label>
                <Textarea
                  id="dept-description"
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Notification Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="project-deadlines"
                      checked={settingsForm.notificationSettings.projectDeadlines}
                      onChange={(e) => setSettingsForm(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          projectDeadlines: e.target.checked
                        }
                      }))}
                      className="rounded"
                    />
                    <Label htmlFor="project-deadlines">Project Deadlines</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="task-assignments"
                      checked={settingsForm.notificationSettings.taskAssignments}
                      onChange={(e) => setSettingsForm(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          taskAssignments: e.target.checked
                        }
                      }))}
                      className="rounded"
                    />
                    <Label htmlFor="task-assignments">Task Assignments</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="deliverable-approvals"
                      checked={settingsForm.notificationSettings.deliverableApprovals}
                      onChange={(e) => setSettingsForm(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          deliverableApprovals: e.target.checked
                        }
                      }))}
                      className="rounded"
                    />
                    <Label htmlFor="deliverable-approvals">Deliverable Approvals</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="weekly-digest"
                      checked={settingsForm.notificationSettings.weeklyDigest}
                      onChange={(e) => setSettingsForm(prev => ({
                        ...prev,
                        notificationSettings: {
                          ...prev.notificationSettings,
                          weeklyDigest: e.target.checked
                        }
                      }))}
                      className="rounded"
                    />
                    <Label htmlFor="weekly-digest">Weekly Digest</Label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Workflow Rules</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="require-approval"
                      checked={settingsForm.workflowRules.requireApproval}
                      onChange={(e) => setSettingsForm(prev => ({
                        ...prev,
                        workflowRules: {
                          ...prev.workflowRules,
                          requireApproval: e.target.checked
                        }
                      }))}
                      className="rounded"
                    />
                    <Label htmlFor="require-approval">Require Approval for Projects</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="auto-assign-tasks"
                      checked={settingsForm.workflowRules.autoAssignTasks}
                      onChange={(e) => setSettingsForm(prev => ({
                        ...prev,
                        workflowRules: {
                          ...prev.workflowRules,
                          autoAssignTasks: e.target.checked
                        }
                      }))}
                      className="rounded"
                    />
                    <Label htmlFor="auto-assign-tasks">Auto-assign Tasks</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-priority">Default Priority</Label>
                  <Select
                    value={settingsForm.workflowRules.defaultPriority}
                    onValueChange={(value) => setSettingsForm(prev => ({
                      ...prev,
                      workflowRules: {
                        ...prev.workflowRules,
                        defaultPriority: value
                      }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button onClick={handleSaveSettings} className="w-full sm:w-auto">
              <SaveIcon className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
