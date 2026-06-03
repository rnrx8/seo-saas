import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/** Markdown からセクションを抽出する */
function extractSection(markdown, targetText, headingLevel) {
  const lines = markdown.split('\n')
  const rank = { h2: 2, h3: 3, h4: 4 }[headingLevel] ?? 2

  // 全見出しを収集
  const headings = []
  lines.forEach((line, i) => {
    const m = line.match(/^(#{2,4})\s+(.+)/)
    if (m) headings.push({ level: m[1].length, text: m[2].trim(), lineIdx: i })
  })

  const targetIdx = headings.findIndex(h => h.level === rank && h.text === targetText)
  if (targetIdx === -1) return null

  const startLine = headings[targetIdx].lineIdx

  // 同レベル以上の次の見出しまでがセクション
  let endLine = lines.length
  for (let i = targetIdx + 1; i < headings.length; i++) {
    if (headings[i].level <= rank) { endLine = headings[i].lineIdx; break }
  }

  // 前後文脈
  let beforeText = ''
  if (targetIdx > 0) {
    const prev = headings[targetIdx - 1]
    beforeText = lines.slice(prev.lineIdx, startLine).join('\n')
  }
  let afterText = ''
  if (endLine < lines.length) {
    const nextH = headings.find(h => h.lineIdx === endLine)
    if (nextH) {
      const nextIdx = headings.indexOf(nextH)
      let nextEnd = lines.length
      for (let i = nextIdx + 1; i < headings.length; i++) {
        if (headings[i].level <= nextH.level) { nextEnd = headings[i].lineIdx; break }
      }
      afterText = lines.slice(endLine, nextEnd).join('\n')
    }
  }

  return {
    sectionText: lines.slice(startLine, endLine).join('\n'),
    beforeText,
    afterText,
    startLine,
    endLine,
  }
}

/** 修正後テキストで元セクションを置換して全文を返す */
function replaceSection(markdown, modifiedSection, startLine, endLine) {
  const lines = markdown.split('\n')
  return [
    lines.slice(0, startLine).join('\n'),
    modifiedSection,
    lines.slice(endLine).join('\n'),
  ].filter(s => s !== '').join('\n')
}

export async function POST(request) {
  const body = await request.json()
  const {
    article_text,
    intent_text,
    edit_type,
    target_heading,
    heading_level,
    insert_position,
    instruction,
    service,   // { name, selling_points, url }
    cta,       // { name, body, button_text, url }
  } = body

  if (!article_text || !target_heading || !heading_level) {
    return Response.json({ error: 'article_text, target_heading, heading_level は必須です' }, { status: 400 })
  }

  const section = extractSection(article_text, target_heading, heading_level)
  if (!section) {
    return Response.json({ error: `見出し「${target_heading}」が見つかりませんでした` }, { status: 400 })
  }

  const insertNote = insert_position === 'after_heading'
    ? `見出し「${target_heading}」の直後（既存コンテンツの前）に追加してください。`
    : `このセクションの末尾（次の見出しの直前）に追加してください。`

  let userPrompt = ''

  if (edit_type === 'text_edit') {
    userPrompt = `以下の記事セクションを指示に従って修正してください。

【検索意図】
${intent_text ?? ''}

【前後の文脈】
${section.beforeText}\n---\n${section.afterText}

【対象セクション】
${section.sectionText}

【修正指示】
${instruction}

修正後のセクション全文をそのまま返してください。余分な説明は不要です。`
  } else if (edit_type === 'service') {
    userPrompt = `以下の記事セクションに、指定サービスの紹介を自然な流れで挿入してください。
押し売り感なく、読者にとって有益な情報として紹介してください。
記事の文体（です・ます調）に合わせてください。
${insertNote}

【検索意図】
${intent_text ?? ''}

【前後の文脈】
${section.beforeText}\n---\n${section.afterText}

【対象セクション】
${section.sectionText}

【見出しレベル】${heading_level}

【サービス情報】
- サービス名：${service?.name ?? ''}
- セールスポイント：${(service?.selling_points ?? []).join('、')}
- URL：${service?.url ?? ''}

修正後のセクション全文をそのまま返してください。余分な説明は不要です。`
  } else if (edit_type === 'cta') {
    userPrompt = `以下の記事セクションの適切な位置に、指定のCTAを自然な流れで挿入してください。
記事の文体に合わせ、読者の行動を促す形にしてください。
${insertNote}

【検索意図】
${intent_text ?? ''}

【前後の文脈】
${section.beforeText}\n---\n${section.afterText}

【対象セクション】
${section.sectionText}

【CTA情報】
- 名前：${cta?.name ?? ''}
- 誘導文：${cta?.body ?? ''}
- ボタンテキスト：${cta?.button_text ?? ''}
- URL：${cta?.url ?? ''}

Markdown形式で自然にCTAを組み込んでください。
修正後のセクション全文をそのまま返してください。余分な説明は不要です。`
  } else {
    return Response.json({ error: '不正な edit_type です' }, { status: 400 })
  }

  try {
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const modifiedSection = msg.content[0].text.trim()
    const fullArticle = replaceSection(article_text, modifiedSection, section.startLine, section.endLine)

    return Response.json({
      modified_section: modifiedSection,
      original_section: section.sectionText,
      full_article: fullArticle,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
