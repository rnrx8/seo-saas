export const dynamic = 'force-dynamic'

import { verifyAdmin, getAdminClient } from '@/app/api/_lib/admin'

export async function GET(request) {
  if (!await verifyAdmin(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    { data: { users: authUsers } },
    { data: profiles },
    { count: monthlyJobs },
    { data: activeJobs },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('user_profiles').select('id, plan'),
    admin.from('jobs').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    admin.from('jobs').select('tenant_id').gte('created_at', startOfMonth),
  ])

  const planCounts = { free: 0, standard: 0, pro: 0 }
  ;(profiles ?? []).forEach(p => { planCounts[p.plan] = (planCounts[p.plan] ?? 0) + 1 })

  const totalUsers = authUsers?.length ?? 0
  const totalPaid = planCounts.standard + planCounts.pro
  const conversionRate = totalUsers > 0 ? Math.round((totalPaid / totalUsers) * 100) : 0
  const revenue = planCounts.standard * 2980 + planCounts.pro * 9800
  const activeUserIds = new Set((activeJobs ?? []).map(j => j.tenant_id).filter(Boolean))

  return Response.json({
    totalUsers,
    activeUsers: activeUserIds.size,
    monthlyJobs: monthlyJobs ?? 0,
    planCounts,
    conversionRate,
    revenue,
  })
}
