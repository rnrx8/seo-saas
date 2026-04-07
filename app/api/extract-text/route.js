import { extractTextFromStorage } from '../_lib/file-parser'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const { file_path, bucket = 'documents' } = await request.json()

  if (!file_path) {
    return Response.json({ error: 'file_path は必須です' }, { status: 400 })
  }

  const fileType = file_path.split('.').pop().toLowerCase()

  // PDFはVercelで処理せずRailwayに委譲
  if (fileType === 'pdf') {
    const pipelineUrl = process.env.PIPELINE_API_URL
      || process.env.NEXT_PUBLIC_PIPELINE_API_URL

    if (!pipelineUrl) {
      return Response.json({ error: 'PIPELINE_API_URL not configured' }, { status: 500 })
    }

    try {
      const response = await fetch(`${pipelineUrl}/extract-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path }),
      })

      if (!response.ok) {
        throw new Error('PDF extraction failed on pipeline server')
      }

      const data = await response.json()
      return Response.json({ text: data.text })
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }

  try {
    const text = await extractTextFromStorage(file_path, bucket)
    return Response.json({ text })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
