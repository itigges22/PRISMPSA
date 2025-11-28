import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { hasPermission } from '@/lib/rbac'
import { Permission } from '@/lib/permissions'
import { createAccountSchema, validateRequestBody } from '@/lib/validation-schemas'
import { logger } from '@/lib/debug-logger'
import { config } from '@/lib/config'

/**
 * POST /api/accounts - Create a new account
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    if (!supabase) {
      logger.error('Failed to create Supabase client', { action: 'create_account' })
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      logger.warn('Unauthorized account creation attempt', { action: 'create_account' })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile with roles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', user.id)
      .single()

    if (!userProfile) {
      logger.error('User profile not found', { action: 'create_account', userId: user.id })
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Check CREATE_ACCOUNT permission
    const canCreateAccount = await hasPermission(userProfile, Permission.CREATE_ACCOUNT)
    if (!canCreateAccount) {
      logger.warn('Insufficient permissions to create account', {
        action: 'create_account',
        userId: user.id
      })
      return NextResponse.json({ error: 'Insufficient permissions to create accounts' }, { status: 403 })
    }

    // Validate request body with Zod
    const body = await request.json()
    const validation = validateRequestBody(createAccountSchema, body)

    if (!validation.success) {
      logger.warn('Invalid account creation data', {
        action: 'create_account',
        userId: user.id,
        error: validation.error
      })
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Create the account
    const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        name: validation.data.name,
        description: validation.data.description || null,
        primary_contact_name: validation.data.primary_contact_name || null,
        primary_contact_email: validation.data.primary_contact_email || null,
        status: validation.data.status || 'active',
        account_manager_id: validation.data.account_manager_id || user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create account in database', {
        action: 'create_account',
        userId: user.id
      }, error as Error)

      return NextResponse.json({
        error: 'Failed to create account',
        ...(config.errors.exposeDetails && { details: error.message })
      }, { status: 500 })
    }

    logger.info('Account created successfully', {
      action: 'create_account',
      userId: user.id,
      accountId: account.id
    })

    return NextResponse.json({ success: true, account }, { status: 201 })
  } catch (error) {
    logger.error('Error in POST /api/accounts', { action: 'create_account' }, error as Error)
    return NextResponse.json({
      error: 'Internal server error',
      ...(config.errors.exposeDetails && { details: (error as Error).message })
    }, { status: 500 })
  }
}
