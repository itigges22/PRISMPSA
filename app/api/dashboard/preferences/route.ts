/**
 * API Route: Dashboard Preferences
 * GET: Retrieve user's dashboard widget configuration
 * PUT: Save user's dashboard widget configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, getUserProfileFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Default widget configuration
const DEFAULT_WIDGET_CONFIG = {
  widgets: [
    { id: 'projects', type: 'projects', visible: true, order: 0, size: 'full' },
    { id: 'capacity', type: 'capacity', visible: true, order: 1, size: 'full' },
    { id: 'time', type: 'time', visible: true, order: 2, size: 'small' },
    { id: 'tasks', type: 'tasks', visible: true, order: 3, size: 'small' },
    { id: 'workflows', type: 'workflows', visible: true, order: 4, size: 'small' },
    { id: 'accounts', type: 'accounts', visible: true, order: 5, size: 'medium' },
    { id: 'collaborators', type: 'collaborators', visible: true, order: 6, size: 'medium' },
    { id: 'time-by-project', type: 'time-by-project', visible: true, order: 7, size: 'small' },
    { id: 'task-trend', type: 'task-trend', visible: true, order: 8, size: 'small' },
    { id: 'deadlines', type: 'deadlines', visible: true, order: 9, size: 'small' },
    { id: 'activity', type: 'activity', visible: true, order: 10, size: 'full' },
  ],
  theme: 'comfortable',
};

/**
 * GET /api/dashboard/preferences
 * Returns the user's dashboard preferences or defaults if none exist
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

    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = userProfile.id;

    // Try to fetch user's existing preferences
    const { data: preferences, error } = await supabase
      .from('user_dashboard_preferences')
      .select('widget_config, updated_at')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = No rows returned - this is expected for new users
      console.error('Error fetching dashboard preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    // Return existing preferences or defaults
    return NextResponse.json({
      success: true,
      data: {
        widgetConfig: preferences?.widget_config || DEFAULT_WIDGET_CONFIG,
        isDefault: !preferences,
        updatedAt: preferences?.updated_at,
      },
    });

  } catch (error: unknown) {
    console.error('Error in GET /api/dashboard/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/dashboard/preferences
 * Saves or updates the user's dashboard preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = userProfile.id;
    const body = await request.json();
    const { widgetConfig } = body;

    if (!widgetConfig) {
      return NextResponse.json(
        { error: 'Missing widgetConfig in request body' },
        { status: 400 }
      );
    }

    // Validate widget config structure
    if (!widgetConfig.widgets || !Array.isArray(widgetConfig.widgets)) {
      return NextResponse.json(
        { error: 'Invalid widgetConfig structure - widgets array required' },
        { status: 400 }
      );
    }

    // Validate each widget has required fields
    for (const widget of widgetConfig.widgets) {
      if (!widget.id || !widget.type || typeof widget.visible !== 'boolean' || typeof widget.order !== 'number') {
        return NextResponse.json(
          { error: 'Invalid widget structure - id, type, visible, and order are required' },
          { status: 400 }
        );
      }
    }

    // Upsert the preferences (insert or update)
    const { data, error } = await supabase
      .from('user_dashboard_preferences')
      .upsert({
        user_id: userId,
        widget_config: widgetConfig,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving dashboard preferences:', error);
      return NextResponse.json(
        { error: 'Failed to save preferences', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        widgetConfig: data.widget_config,
        updatedAt: data.updated_at,
      },
    });

  } catch (error: unknown) {
    console.error('Error in PUT /api/dashboard/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/preferences
 * Resets user's preferences to defaults by deleting their stored preferences
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      );
    }

    const userProfile = await getUserProfileFromRequest(supabase);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = userProfile.id;

    // Delete user's preferences
    const { error } = await supabase
      .from('user_dashboard_preferences')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting dashboard preferences:', error);
      return NextResponse.json(
        { error: 'Failed to reset preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Preferences reset to defaults',
      data: {
        widgetConfig: DEFAULT_WIDGET_CONFIG,
      },
    });

  } catch (error: unknown) {
    console.error('Error in DELETE /api/dashboard/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
