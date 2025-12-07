'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle, Search, RefreshCw } from 'lucide-react';

interface UserDiagnostic {
  id: string;
  name: string;
  email: string;
  is_superadmin: boolean;
  user_roles: {
    id: string;
    role_id: string;
    roles: {
      id: string;
      name: string;
      department_id: string;
      permissions: Record<string, boolean>;
      departments: {
        id: string;
        name: string;
      };
    };
  }[];
}

interface RoleDiagnostic {
  id: string;
  name: string;
  department_name: string;
  permissions: Record<string, boolean>;
  user_count: number;
}

export default function RBACDiagnosticsPage() {
  const [users, setUsers] = useState<UserDiagnostic[]>([]);
  const [roles, setRoles] = useState<RoleDiagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Permission filter state (reserved for future use)
  const [_selectedPermission, _setSelectedPermission] = useState('');

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/rbac-diagnostics');
      const data = await response.json();
      setUsers(data.users || []);
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Error fetching RBAC diagnostics:', error);
    }
    setLoading(false);
  };

  const runDiagnosticTest = async () => {
    setTesting(true);
    setTestResults(null);

    try {
      const response = await fetch('/api/admin/rbac-diagnostics/test', {
        method: 'POST'
      });
      const results = await response.json();
      setTestResults(results);
    } catch (error) {
      console.error('Error running diagnostic test:', error);
    }

    setTesting(false);
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const usersWithIssues = users.filter(u => u.user_roles.length === 0 && !u.is_superadmin);
  const allPermissions = Array.from(
    new Set(roles.flatMap(r => Object.keys(r.permissions)))
  ).sort();

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RBAC Diagnostics</h1>
          <p className="text-muted-foreground">
            Verify Role-Based Access Control is working correctly
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchDiagnostics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={runDiagnosticTest} disabled={testing} size="sm">
            {testing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Run Full Diagnostic'
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Users with Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{usersWithIssues.length}</div>
              {usersWithIssues.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allPermissions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Issues Alert */}
      {usersWithIssues.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Users Without Roles Detected</AlertTitle>
          <AlertDescription>
            {usersWithIssues.length} user(s) have no roles assigned and are not superadmins.
            They may not have access to any features.
          </AlertDescription>
        </Alert>
      )}

      {/* Test Results */}
      {testResults && (
        <Alert variant={testResults.allPassed ? 'default' : 'destructive'}>
          {testResults.allPassed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {testResults.allPassed ? 'All Tests Passed' : 'Some Tests Failed'}
          </AlertTitle>
          <AlertDescription>
            {testResults.passed} / {testResults.total} tests passed
            {testResults.failures.length > 0 && (
              <div className="mt-2 space-y-1">
                {testResults.failures.map((failure: string, i: number) => (
                  <div key={i} className="text-sm">• {failure}</div>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="roles">Role Permissions</TabsTrigger>
          <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Role Verification</CardTitle>
              <CardDescription>
                Verify that getUserProfileFromRequest() is correctly loading user_roles for all users
              </CardDescription>
              <div className="pt-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Permissions Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const totalPermissions = new Set(
                        user.user_roles.flatMap(ur => Object.keys(ur.roles.permissions || {}))
                      ).size;
                      const hasIssue = user.user_roles.length === 0 && !user.is_superadmin;

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            {user.is_superadmin ? (
                              <Badge className="bg-purple-500">Superadmin</Badge>
                            ) : hasIssue ? (
                              <Badge variant="destructive">No Roles</Badge>
                            ) : (
                              <Badge variant="default">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.user_roles.map((ur) => (
                                <Badge key={ur.id} variant="outline" className="text-xs">
                                  {ur.roles.name}
                                  <span className="ml-1 text-muted-foreground">
                                    ({ur.roles.departments.name})
                                  </span>
                                </Badge>
                              ))}
                              {user.user_roles.length === 0 && !user.is_superadmin && (
                                <span className="text-sm text-muted-foreground italic">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.is_superadmin ? (
                              <span className="text-sm">All</span>
                            ) : (
                              <span className="text-sm">{totalPermissions}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Permission Details</CardTitle>
              <CardDescription>
                View which permissions each role grants
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roles.map((role) => (
                  <Card key={role.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{role.name}</CardTitle>
                          <CardDescription>
                            {role.department_name} • {role.user_count} user(s)
                          </CardDescription>
                        </div>
                        <Badge>
                          {Object.values(role.permissions).filter(Boolean).length} permissions
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(role.permissions)
                          .filter(([, enabled]) => enabled)
                          .map(([permission]) => (
                            <Badge key={permission} variant="secondary" className="text-xs">
                              {permission}
                            </Badge>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
              <CardDescription>
                Complete permission matrix showing which roles have which permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Permission</TableHead>
                      {roles.map((role) => (
                        <TableHead key={role.id} className="text-center min-w-[100px]">
                          <div className="text-xs">{role.name}</div>
                          <div className="text-xs text-muted-foreground">{role.department_name}</div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allPermissions.map((permission) => (
                      <TableRow key={permission}>
                        <TableCell className="sticky left-0 bg-background font-mono text-xs">
                          {permission}
                        </TableCell>
                        {roles.map((role) => (
                          <TableCell key={`${role.id}-${permission}`} className="text-center">
                            {role.permissions[permission] ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
