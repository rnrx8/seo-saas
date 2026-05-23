export const dynamic = 'force-dynamic'

import { verifyAdmin, getAdminClient } from '@/app/api/_lib/admin'

export async function GET(request) {
  if (!await verifyAdmin(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pipelineUrl = process.env.PIPELINE_API_URL || process.env.NEXT_PUBLIC_PIPELINE_API_URL

  // SerpAPI 状況をパイプライン経由で取得
  let serpapi = null
  try {
    const res = await fetch(`${pipelineUrl}/service-status`, {
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    serpapi = data.serpapi
  } catch (e) {
    serpapi = { error: e.message }
  }

  // Anthropic 状況：直近24時間のクレジットエラーをDBから取得
  const admin = getAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: creditErrors } = await admin
    .from('jobs')
    .select('id, created_at, error_message')
    .eq('status', 'failed')
    .ilike('error_message', '%credit balance%')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)

  const anthropic = {
    status: creditErrors?.length > 0 ? 'credit_error' : 'ok',
    last_error_at: creditErrors?.[0]?.created_at ?? null,
  }

  return Response.json({ serpapi, anthropic })
}
