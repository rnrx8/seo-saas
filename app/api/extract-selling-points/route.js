import Anthropic from '@anthropic-ai/sdk'
import { extractTextFromStorage } from '../_lib/file-parser'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  const { url, text, file_path } = await request.json()

  if (!file_path && !url && !text) {
    return Response.json({ error: 'file_path・url・text のいずれかが必要です' }, { status: 400 })
  }

  let sourceText = ''

  // 優先順位: ファイル > URL > テキスト
  if (file_path) {
    try {
      const raw = await extractTextFromStorage(file_path)
      sourceText = raw.slice(0, 8000)
    } catch (err) {
      return Response.json({ error: 'ファイルの読み込みに失敗しました: ' + err.message }, { status: 502 })
    }
  } else if (url) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Pipeline/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      const html = await res.text()
      sourceText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000)
    } catch {
      if (!text) {
        return Response.json({ error: 'URLの取得に失敗しました' }, { status: 502 })
      }
    }
  }

  if (!sourceText && text) {
    sourceText = text.slice(0, 8000)
  }

  if (!sourceText) {
    return Response.json({ error: 'コンテンツを取得できませんでした' }, { status: 400 })
  }

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `以下のサービス情報から、SEO記事内でサービスを自然に紹介するためのセールスポイントを5〜8個抽出してください。簡潔な箇条書きで出力してください。JSON配列形式で返してください：["ポイント1", "ポイント2", ...]

必ずJSON配列のみを返してください。説明文は不要です。

【サービス情報】
${sourceText}`,
        },
      ],
    })

    const raw = msg.content[0].text.trim()
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) {
      return Response.json({ error: 'セールスポイントの抽出に失敗しました' }, { status: 500 })
    }
    const selling_points = JSON.parse(match[0])
    return Response.json({ selling_points })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
