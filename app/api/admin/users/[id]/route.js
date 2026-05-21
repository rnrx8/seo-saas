export const dynamic = 'force-dynamic'

import { verifyAdmin, getAdminClient } from '@/app/api/_lib/admin'

export async function GET(request, { params }) {
  if (!await verifyAdmin(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const admin = getAdminClient()

  const [
    { data: { user: authUser } },
    { data: profile },
    { data: jobs },
    { data: companies },
  ] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('user_profiles').select('*').eq('id', id).single(),
    admin.from('jobs')
      .select('id, main_keyword, status, created_at, current_step, category')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin.from('company_settings').select('id, company_name, recommend_level').eq('tenant_id', id),
  ])

  return Response.json({
    user: authUser ? {
      id: authUser.id,
      email: authUser.email,
      last_sign_in_at: authUser.last_sign_in_at,
      created_at: authUser.created_at,
    } : null,
    profile: profile ?? null,
    recentJobs: jobs ?? [],
    companies: companies ?? [],
  })
}

export async function PATCH(request, { params }) {
  if (!await verifyAdmin(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { credit_delta } = await request.json()

  if (typeof credit_delta !== 'number' || !Number.isInteger(credit_delta) || credit_delta === 0) {
    return Response.json({ error: 'credit_delta は0以外の整数を指定してください' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('credits_remaining, credits_total')
    .eq('id', id)
    .single()

  if (!profile) return Response.json({ error: 'User not found' }, { status: 404 })

  const newRemaining = Math.max(0, (profile.credits_remaining ?? 0) + credit_delta)
  const newTotal = credit_delta > 0
    ? (profile.credits_total ?? 0) + credit_delta
    : profile.credits_total

  const { error } = await admin
    .from('user_profiles')
    .update({ credits_remaining: newRemaining, credits_total: newTotal })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ credits_remaining: newRemaining, credits_total: newTotal })
}
