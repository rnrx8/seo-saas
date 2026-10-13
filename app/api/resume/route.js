export const dynamic = 'force-dynamic'

export async function POST(request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return Response.json({ error: 'ログインし直してください。' }, { status: 401 })
  const { job_id } = await request.json()
  if (typeof job_id !== 'string' || !job_id) return Response.json({ error: '記事が指定されていません。' }, { status: 400 })
  const pipelineUrl = process.env.PIPELINE_API_URL || process.env.NEXT_PUBLIC_PIPELINE_API_URL
  if (!pipelineUrl) return Response.json({ error: 'PIPELINE_API_URL not configured' }, { status: 500 })
  try {
    const res = await fetch(`${pipelineUrl}/resume`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify({ job_id }),
    })
    return Response.json(await res.json().catch(() => ({})), { status: res.status })
  } catch {
    return Response.json({ error: '再開処理に接続できませんでした。時間をおいて再度お試しください。' }, { status: 502 })
  }
}
