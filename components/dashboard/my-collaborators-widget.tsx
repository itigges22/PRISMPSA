'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FolderKanban } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import useSWR from 'swr';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  image?: string;
  role?: string;
  department?: string;
  sharedProjects: number;
  projectNames: string[];
}

interface CollaboratorsResponse {
  success: boolean;
  data: {
    collaborators: Collaborator[];
    totalCollaborators: number;
  };
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-cyan-500',
    'bg-rose-500',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

export function MyCollaboratorsWidget() {
  const { data, error, isLoading } = useSWR<CollaboratorsResponse>(
    '/api/dashboard/my-collaborators',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-500" />
            My Collaborators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load collaborators</p>
        </CardContent>
      </Card>
    );
  }

  const collaborators = data?.data?.collaborators || [];
  const totalCollaborators = data?.data?.totalCollaborators || 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-500" />
          My Collaborators
          {totalCollaborators > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({totalCollaborators})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {collaborators.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No collaborators on active projects
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Working with you this week:</p>
            {collaborators.slice(0, 5).map((collaborator) => (
              <div
                key={collaborator.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-9 w-9">
                  {collaborator.image && (
                    <AvatarImage src={collaborator.image} alt={collaborator.name} />
                  )}
                  <AvatarFallback className={`text-xs text-white ${getAvatarColor(collaborator.name)}`}>
                    {getInitials(collaborator.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{collaborator.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {collaborator.role && (
                      <span className="truncate">{collaborator.role}</span>
                    )}
                    {collaborator.role && collaborator.department && (
                      <span className="text-muted-foreground/50">•</span>
                    )}
                    {collaborator.department && (
                      <span className="truncate">{collaborator.department}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <FolderKanban className="h-3 w-3" />
                  <span>{collaborator.sharedProjects}</span>
                </div>
              </div>
            ))}

            {collaborators.length > 5 && (
              <p className="text-center text-xs text-muted-foreground py-1">
                +{collaborators.length - 5} more collaborators
              </p>
            )}

            {/* Summary of projects */}
            {collaborators.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Collaborating on {[...new Set(collaborators.flatMap(c => c.projectNames))].length} active projects
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MyCollaboratorsWidget;
