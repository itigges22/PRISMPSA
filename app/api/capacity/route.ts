/**
 * API Route: Capacity Metrics
 * Endpoints for retrieving capacity analytics and metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';
import { capacityService } from '@/lib/services/capacity-service';
import { hasPermission } from '@/lib/permission-checker';
import { Permission } from '@/lib/permissions';

/**
 * GET /api/capacity
 * Get capacity metrics
 * Query params: type (user|department|project|org), id, weekStartDate
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    // Get current user
    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'user';
    const id = searchParams.get('id');
    
    // Get Monday of current week as default
    const getWeekStartDate = (date: Date = new Date()): string => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      return monday.toISOString().split('T')[0];
    };
    
    const weekStartDate = searchParams.get('weekStartDate') || getWeekStartDate();

    let metrics = null;

    switch (type) {
      case 'user': {
        const userId = id || userProfile.id;
        
        // Permission check
        const isOwnData = userId === userProfile.id;
        if (!isOwnData) {
          const canViewTeam = await hasPermission(userProfile, Permission.VIEW_TEAM_CAPACITY);
          const canViewAll = await hasPermission(userProfile, Permission.VIEW_ALL_CAPACITY);
          
          if (!canViewTeam && !canViewAll) {
            return NextResponse.json(
              { error: 'Insufficient permissions to view other users\' capacity' },
              { status: 403 }
            );
          }
        }

        metrics = await capacityService.getUserCapacityMetrics(userId, weekStartDate, supabase);
        break;
      }

      case 'department': {
        if (!id) {
          return NextResponse.json(
            { error: 'Department ID required' },
            { status: 400 }
          );
        }

        // Permission check
        const canViewTeam = await hasPermission(userProfile, Permission.VIEW_TEAM_CAPACITY);
        const canViewAll = await hasPermission(userProfile, Permission.VIEW_ALL_CAPACITY);

        if (!canViewTeam && !canViewAll) {
          return NextResponse.json(
            { error: 'Insufficient permissions to view department capacity' },
            { status: 403 }
          );
        }

        metrics = await capacityService.getDepartmentCapacityMetrics(id, weekStartDate, supabase);
        break;
      }

      case 'project': {
        if (!id) {
          return NextResponse.json(
            { error: 'Project ID required' },
            { status: 400 }
          );
        }

        // Check if user can view this project
        const canView = await hasPermission(userProfile, Permission.VIEW_PROJECTS, { projectId: id });
        if (!canView) {
          return NextResponse.json(
            { error: 'Insufficient permissions to view project capacity' },
            { status: 403 }
          );
        }

        metrics = await capacityService.getProjectCapacityMetrics(id, weekStartDate, supabase);
        break;
      }

      case 'org': {
        // Permission check: VIEW_ALL_CAPACITY required
        const canViewAll = await hasPermission(userProfile, Permission.VIEW_ALL_CAPACITY);
        if (!canViewAll) {
          return NextResponse.json(
            { error: 'Insufficient permissions to view organization capacity' },
            { status: 403 }
          );
        }

        metrics = await capacityService.getOrgCapacityMetrics(weekStartDate, supabase);
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Must be: user, department, project, or org' },
          { status: 400 }
        );
    }

    if (!metrics) {
      return NextResponse.json(
        { error: 'Failed to retrieve capacity metrics' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error: any) {
    console.error('Error in GET /api/capacity:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

