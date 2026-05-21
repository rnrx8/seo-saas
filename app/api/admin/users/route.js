export const dynamic = 'force-dynamic'

import { verifyAdmin, getAdminClient } from '@/app/api/_lib/admin'

export async function GET(request) {
  if (!await verifyAdmin(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const [{ data: { users: authUsers } }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('user_profiles').select('id, plan, credits_remaining, credits_total'),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const users = (authUsers ?? [])
    .map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      plan: profileMap[u.id]?.plan ?? 'free',
      credits_remaining: profileMap[u.id]?.credits_remaining ?? 0,
      credits_total: profileMap[u.id]?.credits_total ?? 0,
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return Response.json({ users })
}
