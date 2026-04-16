import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const client = new Anthropic()

export async function POST(request) {
  const { article_text } = await request.json()

  if (!article_text) {
    return Response.json({ error: 'article_text is required' }, { status: 400 })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `以下の記事から、FAQスキーマ（schema.org FAQPage）用のQ&Aを抽出してください。

抽出ルール：
- FAQセクションがある場合はそのQ&Aを優先する
- FAQセクションがない場合は、疑問詞を含むH2/H3見出し（〜とは？いくら？なぜ？など）をQとし、その直下の結論文をAとして抽出する
- 最大10件まで
- 回答は簡潔に（1〜3文）

以下のJSON形式のみを返してください（前後の説明文不要、JSONのみ）：
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "質問テキスト",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "回答テキスト"
      }
    }
  ]
}

---
記事：
${article_text}`,
        },
      ],
    })

    const text = message.content[0].text.trim()

    // JSONブロックを抽出してパース
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      return Response.json({ error: 'スキーマの生成に失敗しました' }, { status: 500 })
    }
    const schema = JSON.parse(match[0])
    return Response.json({ schema })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
