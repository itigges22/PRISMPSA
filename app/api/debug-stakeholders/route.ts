import { NextResponse, NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards'
import { Permission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }

    // Check authentication and permission
    await requireAuthAndPermission(Permission.VIEW_PROJECTS, { projectId }, request)
    
    const supabase = await createServerSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

  // Fetch stakeholders
  const { data: stakeholders, error } = await supabase
    .from('project_stakeholders')
    .select(`
      id,
      user_id,
      role,
      added_at,
      user_profiles:user_profiles(*)
    `)
    .eq('project_id', projectId)

  console.log('=== STAKEHOLDERS DEBUG ===')
  console.log('Project ID:', projectId)
  console.log('Stakeholders count:', stakeholders?.length || 0)
  console.log('Stakeholders data:', JSON.stringify(stakeholders, null, 2))
  console.log('Error:', error)
  console.log('=== END DEBUG ===')

  return NextResponse.json({ stakeholders, error })
  } catch (error) {
    return handleGuardError(error);
  }
}

