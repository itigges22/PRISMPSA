import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { requireAuthAndPermission, requireAuthentication, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { logger } from '@/lib/debug-logger';

/**
 * GET /api/profile
 * Get current user's profile
 * All authenticated users can view their own profile, regardless of role
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication only - all users should be able to view their own profile
    const userProfile = await requireAuthentication(request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'getProfile' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Fetch user profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, name, email, bio, skills, image, created_at, updated_at')
      .eq('id', userProfile.id)
      .single();

    if (error) {
      logger.error('Error fetching profile', { action: 'getProfile', userId: userProfile.id }, error);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return handleGuardError(error);
  }
}

/**
 * PATCH /api/profile
 * Update current user's profile
 * All authenticated users can edit their own profile, regardless of role
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication only - all users should be able to edit their own profile
    const userProfile = await requireAuthentication(request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'updateProfile' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { name, bio, skills } = body;

    // Validate that user can only update their own profile
    // (This is already enforced by requireAuthAndPermission, but adding explicit check for clarity)
    if (body.id && body.id !== userProfile.id) {
      logger.warn('User attempted to update another user\'s profile', {
        action: 'updateProfile',
        userId: userProfile.id,
        attemptedId: body.id
      });
      return NextResponse.json(
        { error: 'You can only update your own profile' },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: {
      name?: string;
      bio?: string;
      skills?: string[];
      updated_at: string;
    } = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) updateData.skills = skills;

    logger.info('Updating user profile', {
      action: 'updateProfile',
      userId: userProfile.id,
      fields: Object.keys(updateData)
    });

    // Update the profile
    const { data: updatedProfile, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userProfile.id)
      .select('id, name, email, bio, skills, image, created_at, updated_at')
      .single();

    if (error) {
      logger.error('Error updating profile', { action: 'updateProfile', userId: userProfile.id }, error);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    logger.info('Profile updated successfully', {
      action: 'updateProfile',
      userId: userProfile.id
    });

    return NextResponse.json({ profile: updatedProfile });
  } catch (error) {
    return handleGuardError(error);
  }
}

