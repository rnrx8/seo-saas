import { extractTextFromStorage } from '../_lib/file-parser'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const { file_path, bucket = 'documents' } = await request.json()

  if (!file_path) {
    return Response.json({ error: 'file_path は必須です' }, { status: 400 })
  }

  try {
    const text = await extractTextFromStorage(file_path, bucket)
    return Response.json({ text })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
