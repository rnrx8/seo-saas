export async function POST(request) {
  const { job_id, keyword } = await request.json()

  const pipelineUrl = process.env.NEXT_PUBLIC_PIPELINE_API_URL
  if (!pipelineUrl) {
    return Response.json({ error: 'PIPELINE_API_URL not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${pipelineUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id, keyword }),
    })
    const data = await res.json().catch(() => ({}))
    return Response.json(data, { status: res.status })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 })
  }
}
