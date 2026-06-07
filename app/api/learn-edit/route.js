import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Claude のレスポンスから JSON 部分を取り出してパースする（コードフェンス等を許容） */
function parseJsonLoose(text) {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  return JSON.parse(t)
}

/** 修正前後の差分から、再利用可能な執筆ルール（文体・表現の癖・レギュレーション）を抽出する */
async function analyze({ before_text, after_text }) {
  const prompt = `あなたは編集者の校正意図を読み取るアシスタントです。
同じ記事の「修正前」と「修正後」を比較し、この編集者が今後の記事生成でも一貫して守ってほしいであろう「執筆ルール」を抽出してください。

重要な方針:
- 文体・語尾・トーン・表現の癖・言い回し・表記ルール・媒体レギュレーションといった、**他の記事にも再利用できる一般化されたルール**だけを抽出する。
- この記事固有の事実・固有名詞・具体的な内容の差し替えは抽出しない（再利用できないため）。
- 各ルールは簡潔な命令形で書く（例：「『〜と言えるでしょう』のような曖昧な語尾を避け、断定的に書く」）。
- 必ずしも論理的に正しくなくても、編集者の好みとして尊重して言語化する。
- 文体に関わる意味のある変更が無い場合は、空配列を返す。

【修正前】
${before_text}

【修正後】
${after_text}

次の JSON 形式だけを返してください。説明文は不要です:
{
  "rules": [
    { "rule_text": "ルール本文", "before_example": "修正前の代表例（短く）", "after_example": "修正後の代表例（短く）" }
  ]
}`

  const msg = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  let parsed
  try {
    parsed = parseJsonLoose(msg.content[0].text)
  } catch {
    return Response.json({ rules: [] })
  }
  const rules = Array.isArray(parsed?.rules) ? parsed.rules.filter(r => r?.rule_text?.trim()) : []
  return Response.json({ rules })
}

/** ユーザーの一箇所の修正と同種の修正を、記事全文に一貫して反映する */
async function applyGlobal({ before_text, after_text, intent_text }) {
  const prompt = `編集者が記事の一部を修正しました。「修正前」と「修正後」を比較すると、編集者の文体・表現の好みが読み取れます。
同じ種類の修正を、記事全文（=「修正後の記事全文」）に一貫して適用してください。

厳守事項:
- 文体・語尾・表現・表記の一貫化だけを行い、**記事の内容・意味・構成・見出し・事実は変えない**。
- Markdown 構造（見出しレベル・リスト・表・リンク）は保持する。
- 既に好ましい形になっている箇所はそのまま残す。

${intent_text ? `【検索意図（参考）】\n${intent_text}\n` : ''}
【編集者の修正例：修正前】
${before_text}

【編集者の修正例：修正後 ＝ 現在の記事全文】
${after_text}

修正を全文に反映した「記事全文」を Markdown でそのまま返してください。余分な説明・コードフェンスは不要です。`

  const msg = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  return Response.json({ full_article: msg.content[0].text.trim() })
}

export async function POST(request) {
  const { before_text, after_text, intent_text, mode } = await request.json()

  if (!before_text || !after_text) {
    return Response.json({ error: 'before_text, after_text は必須です' }, { status: 400 })
  }

  try {
    if (mode === 'apply_global') {
      return await applyGlobal({ before_text, after_text, intent_text })
    }
    return await analyze({ before_text, after_text })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
