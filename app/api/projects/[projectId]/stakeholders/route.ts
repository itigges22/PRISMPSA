import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards'
import { Permission } from '@/lib/permissions'
import { logger } from '@/lib/debug-logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
  // Await params (Next.js 15 requirement)
  const { projectId } = await params

    // Check authentication and permission
    await requireAuthAndPermission(Permission.VIEW_PROJECTS, { projectId }, request)

    // Use server Supabase client
    const supabase = await createServerSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Fetch stakeholders - specify the relationship to avoid ambiguity
    const { data, error } = await supabase
      .from('project_stakeholders')
      .select(`
        id,
        user_id,
        role,
        user_profiles:user_profiles!project_stakeholders_user_id_fkey(
          id,
          name,
          email,
          image
        )
      `)
      .eq('project_id', projectId)

    if (error) {
      logger.error('Error fetching stakeholders', { action: 'getStakeholders', projectId }, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ stakeholders: data || [] })
  } catch (error) {
    return handleGuardError(error)
  }
}

