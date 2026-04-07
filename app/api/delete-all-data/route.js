import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function deleteStorageFolder(supabase, userId) {
  // Root files (userId/...)
  const { data: rootItems } = await supabase.storage.from('documents').list(userId)
  const rootFiles = (rootItems ?? []).filter(i => i.id !== null).map(i => `${userId}/${i.name}`)
  const subFolders = (rootItems ?? []).filter(i => i.id === null)

  // Subfolder files (userId/sources/...)
  const subFilePaths = []
  for (const folder of subFolders) {
    const { data: subItems } = await supabase.storage.from('documents').list(`${userId}/${folder.name}`)
    for (const item of (subItems ?? [])) {
      subFilePaths.push(`${userId}/${folder.name}/${item.name}`)
    }
  }

  const allPaths = [...rootFiles, ...subFilePaths]
  if (allPaths.length > 0) {
    await supabase.storage.from('documents').remove(allPaths)
  }
}

export async function POST(request) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminSupabase()

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id

  try {
    // 1. Supabase Storage のファイルを全削除
    await deleteStorageFolder(supabase, userId)

    // 2. テーブルデータを削除（jobsはCASCADEでartifactsも削除される前提。
    //    されない場合は artifacts も明示削除）
    const tables = [
      'primary_sources',
      'services',
      'cta_blocks',
      'company_settings',
      'category_settings',
    ]
    for (const table of tables) {
      await supabase.from(table).delete().eq('tenant_id', userId)
    }

    // jobs（tenant_idで登録）
    const { data: jobRows } = await supabase
      .from('jobs')
      .select('id')
      .eq('tenant_id', userId)
    const jobIds = (jobRows ?? []).map(j => j.id)
    if (jobIds.length > 0) {
      // artifacts を明示削除（CASCADE未設定の場合の保険）
      await supabase.from('artifacts').delete().in('job_id', jobIds)
      await supabase.from('jobs').delete().eq('tenant_id', userId)
    }

    // user_profiles
    await supabase.from('user_profiles').delete().eq('id', userId)

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
