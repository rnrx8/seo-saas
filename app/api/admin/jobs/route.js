export const dynamic = 'force-dynamic'

import { verifyAdmin, getAdminClient } from '@/app/api/_lib/admin'

export async function GET(request) {
  if (!await verifyAdmin(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? 'failed'

  const admin = getAdminClient()
  let query = admin
    .from('jobs')
    .select('id, main_keyword, status, created_at, current_step, category, tenant_id')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') query = query.eq('status', status)

  const { data: jobs, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const tenantIds = [...new Set((jobs ?? []).map(j => j.tenant_id).filter(Boolean))]
  let emailMap = {}
  if (tenantIds.length) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    emailMap = Object.fromEntries((users ?? []).map(u => [u.id, u.email]))
  }

  return Response.json({
    jobs: (jobs ?? []).map(j => ({ ...j, user_email: emailMap[j.tenant_id] ?? j.tenant_id })),
  })
}
