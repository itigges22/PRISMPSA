/**
 * First-Time Setup API
 *
 * This endpoint allows the first superadmin to be created when:
 * 1. No superadmins exist in the database
 * 2. The correct SETUP_SECRET is provided
 * 3. The user is authenticated
 *
 * Security:
 * - Only works when zero superadmins exist
 * - Requires matching SETUP_SECRET env var
 * - Automatically disabled after first superadmin
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';

// GET - Check if setup is available
export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Check if any superadmins exist
    const { data: superadmins, error: countError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('is_superadmin', true)
      .limit(1);

    if (countError) {
      console.error('Error checking superadmins:', countError);
      return NextResponse.json({ error: 'Failed to check setup status' }, { status: 500 });
    }

    const hasSuperadmin = superadmins && superadmins.length > 0;
    const setupSecretConfigured = !!process.env.SETUP_SECRET;

    return NextResponse.json({
      setupAvailable: !hasSuperadmin && setupSecretConfigured,
      hasSuperadmin,
      setupSecretConfigured,
      message: hasSuperadmin
        ? 'Setup already completed. A superadmin exists.'
        : setupSecretConfigured
          ? 'Setup available. Provide the correct secret key to become superadmin.'
          : 'SETUP_SECRET environment variable not configured.'
    });
  } catch (error) {
    console.error('Error in GET /api/setup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Promote current user to superadmin
export async function POST(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get the setup secret from request body
    const body = await request.json();
    const { setupSecret } = body;

    // Validate setup secret
    const expectedSecret = process.env.SETUP_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({
        error: 'SETUP_SECRET environment variable not configured. Add it to your environment variables.'
      }, { status: 400 });
    }

    if (!setupSecret || setupSecret !== expectedSecret) {
      return NextResponse.json({
        error: 'Invalid setup secret. Check your SETUP_SECRET environment variable.'
      }, { status: 401 });
    }

    // Check if any superadmins already exist
    const { data: existingSuperadmins, error: checkError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('is_superadmin', true)
      .limit(1);

    if (checkError) {
      console.error('Error checking existing superadmins:', checkError);
      return NextResponse.json({ error: 'Failed to check existing superadmins' }, { status: 500 });
    }

    if (existingSuperadmins && existingSuperadmins.length > 0) {
      return NextResponse.json({
        error: 'Setup already completed. A superadmin already exists.',
        existingAdmin: existingSuperadmins[0].email
      }, { status: 400 });
    }

    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({
        error: 'You must be logged in to complete setup. Please sign up first.'
      }, { status: 401 });
    }

    // Check if user profile exists
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({
        error: 'User profile not found. Please ensure you have signed up.'
      }, { status: 404 });
    }

    // Promote user to superadmin
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ is_superadmin: true })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error promoting to superadmin:', updateError);
      return NextResponse.json({ error: 'Failed to promote to superadmin' }, { status: 500 });
    }

    // Also assign the Superadmin role if it exists
    const { data: superadminRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Superadmin')
      .single();

    if (superadminRole) {
      // Check if user already has this role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_id', superadminRole.id)
        .single();

      if (!existingRole) {
        await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            role_id: superadminRole.id,
            assigned_by: user.id
          });
      }
    }

    console.log(`[SETUP] User ${profile.email} promoted to superadmin`);

    return NextResponse.json({
      success: true,
      message: `Congratulations! ${profile.name || profile.email} is now a superadmin.`,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name
      }
    });

  } catch (error) {
    console.error('Error in POST /api/setup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
