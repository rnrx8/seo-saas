'use client'

export const dynamic = 'force-dynamic'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { marked } from 'marked'
import { getSupabase } from '@/lib/supabase'

const MD_COMPONENTS = {
  h1:     ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3">{children}</h1>,
  h2:     ({ children }) => <h2 className="text-xl font-bold mt-5 mb-2 border-b pb-1">{children}</h2>,
  h3:     ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
  h4:     ({ children }) => <h4 className="text-base font-semibold mt-3 mb-1">{children}</h4>,
  p:      ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
  ul:     ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
  ol:     ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
  li:     ({ children }) => <li className="ml-4">{children}</li>,
  table:  ({ children }) => <table className="w-full border-collapse mb-4">{children}</table>,
  th:     ({ children }) => <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left text-sm font-semibold">{children}</th>,
  td:     ({ children }) => <td className="border border-gray-300 px-3 py-2 text-sm">{children}</td>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  code:   ({ children }) => <code className="bg-gray-100 px-1 rounded text-sm">{children}</code>,
}

const TABS = [
  { key: 'article',       label: '記事' },
  { key: 'search_intent', label: '検索意図' },
  { key: 'outline',       label: '構成案' },
  { key: 'fact_sheet',    label: 'ファクトシート' },
  { key: 'paa_lsi',       label: 'PAA / LSI' },
  { key: 'serp',          label: '競合情報' },
  { key: 'llmo',          label: 'LLMO' },
]

export default function ArticlePage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [artifacts, setArtifacts] = useState({})
  const [activeTab, setActiveTab] = useState('article')
  const [error, setError] = useState('')
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      fetchArtifacts()
    })
  }, [id])

  async function fetchArtifacts() {
    const { data, error } = await getSupabase()
      .from('artifacts')
      .select('step, content_text')
      .eq('job_id', id)
      .in('step', ['article', 'search_intent', 'outline', 'fact_sheet', 'serp'])

    if (error || !data) {
      setError('データが見つかりませんでした')
      return
    }
    const map = {}
    for (const row of data) map[row.step] = row.content_text
    setArtifacts(map)
  }

  function handleApplyEdit(fullArticle) {
    setArtifacts(prev => ({ ...prev, article: fullArticle }))
    setShowPanel(false)
  }

  const isLoading = Object.keys(artifacts).length === 0 && !error

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">記事表示</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-4 py-2 rounded-lg transition-colors"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-sm">
            {error}
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-8">
              {activeTab === 'article' && (
                <ArticleView
                  markdown={artifacts['article'] ?? ''}
                  onOpenPanel={() => setShowPanel(true)}
                />
              )}

              {activeTab === 'search_intent' && (
                <article className="max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{artifacts['search_intent'] ?? '（データなし）'}</ReactMarkdown>
                </article>
              )}

              {activeTab === 'outline' && (
                <article className="max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{artifacts['outline'] ?? '（データなし）'}</ReactMarkdown>
                </article>
              )}

              {activeTab === 'fact_sheet' && (
                <article className="max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{artifacts['fact_sheet'] ?? 'ファクトシートがありません'}</ReactMarkdown>
                </article>
              )}

              {activeTab === 'paa_lsi' && (
                <PaaLsiView content={artifacts['serp']} />
              )}

              {activeTab === 'serp' && (
                <SerpView content={artifacts['serp']} />
              )}

              {activeTab === 'llmo' && (
                <LlmoView markdown={artifacts['article'] ?? ''} />
              )}
            </div>
          </div>
        )}
      </main>

      <EditAssistPanel
        open={showPanel}
        onClose={() => setShowPanel(false)}
        jobId={id}
        articleText={artifacts['article'] ?? ''}
        intentText={artifacts['search_intent'] ?? ''}
        onApply={handleApplyEdit}
      />
    </div>
  )
}

const VIEWS = [
  { key: 'preview',  label: 'プレビュー' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'html',     label: 'HTML' },
]

function ArticleView({ markdown, onOpenPanel }) {
  const [view, setView] = useState('preview')
  const [copied, setCopied] = useState(false)

  const html = marked(markdown)

  async function handleCopy() {
    const text = view === 'html' ? html : markdown
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      {/* ビュー切り替え + コピーボタン */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded border px-3 py-1 text-sm transition-colors ${
                view === v.key
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-600 hover:border-gray-400 transition-colors"
          >
            {copied ? 'コピーしました！' : 'コピー'}
          </button>
          {onOpenPanel && (
            <button
              onClick={onOpenPanel}
              className="rounded border border-purple-300 bg-purple-50 px-3 py-1 text-sm text-purple-700 hover:bg-purple-100 transition-colors"
            >
              ✏️ 編集アシスト
            </button>
          )}
        </div>
      </div>

      {/* コンテンツ */}
      {view === 'preview' && (
        <article className="max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{markdown}</ReactMarkdown>
        </article>
      )}
      {view === 'markdown' && (
        <pre className="bg-gray-50 p-4 rounded overflow-auto whitespace-pre-wrap text-sm text-gray-800">
          {markdown}
        </pre>
      )}
      {view === 'html' && (
        <pre className="bg-gray-50 p-4 rounded overflow-auto whitespace-pre-wrap text-sm text-gray-800">
          {html}
        </pre>
      )}
    </div>
  )
}

function PaaLsiView({ content }) {
  let paa = []
  let related = []

  if (content) {
    try {
      const parsed = JSON.parse(content)
      paa     = parsed.people_also_ask  ?? []
      related = parsed.related_searches ?? []
    } catch {
      // パース失敗時は空のまま
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* PAA */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">よくある質問（PAA）</h2>
        {paa.length === 0 ? (
          <p className="text-gray-400 text-sm">取得できませんでした</p>
        ) : (
          <div className="flex flex-col gap-3">
            {paa.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-800 text-sm mb-1">Q. {item.question}</p>
                {item.snippet && (
                  <p className="text-gray-600 text-sm leading-relaxed">{item.snippet}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* LSI / Related searches */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">関連キーワード（LSI候補）</h2>
        {related.length === 0 ? (
          <p className="text-gray-400 text-sm">取得できませんでした</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {related.map((kw, i) => (
              <span
                key={i}
                className="rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-sm"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function HeadingsList({ headings, fetchStatus }) {
  const [open, setOpen] = useState(false)

  if (fetchStatus === 'failed') {
    return <p className="text-gray-400 text-xs mt-2">見出しを取得できませんでした</p>
  }
  if (!headings || headings.length === 0) {
    return null
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        {open ? '▲ 見出しを閉じる' : `▼ 見出しを表示（${headings.length}件）`}
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1">
          {headings.map((h, i) => (
            <li
              key={i}
              className={h.level === 'h2'
                ? 'text-sm font-semibold text-gray-700'
                : 'ml-4 text-sm text-gray-500'}
            >
              <span className="text-gray-300 mr-1">{h.level === 'h2' ? 'H2' : 'H3'}</span>
              {h.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SerpView({ content }) {
  if (!content) return <p className="text-gray-400 text-sm">（データなし）</p>

  let organicResults = null
  let headingsMap = {}
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      organicResults = parsed
    } else {
      organicResults = parsed.organic_results ?? null
      for (const h of (parsed.competitor_headings ?? [])) {
        if (h?.url) headingsMap[h.url] = h
      }
    }
  } catch {
    return <pre className="text-sm text-gray-700 whitespace-pre-wrap">{content}</pre>
  }

  if (!organicResults) {
    return <pre className="text-sm text-gray-700 whitespace-pre-wrap">{content}</pre>
  }

  return (
    <div className="flex flex-col gap-4">
      {organicResults.map((item, i) => {
        const url = item.link ?? item.url ?? ''
        const heading = headingsMap[url]
        return (
          <div key={i} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-green-700 truncate mb-1">{url}</p>
                <a
                  href={url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 font-medium text-sm hover:underline"
                >
                  {item.title ?? '（タイトルなし）'}
                </a>
                {item.snippet && (
                  <p className="text-gray-600 text-sm mt-1 leading-relaxed">{item.snippet}</p>
                )}
                {heading && (
                  <HeadingsList
                    headings={heading.headings}
                    fetchStatus={heading.fetch_status}
                  />
                )}
              </div>
              <span className="text-xs text-gray-400 shrink-0">#{i + 1}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// LlmoView
// ─────────────────────────────────────────────

function LlmoView({ markdown }) {
  const [schema, setSchema] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    setSchema(null)
    try {
      const res = await fetch('/api/generate-faq-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_text: markdown }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setSchema(data.schema)
      }
    } catch {
      setError('通信エラーが発生しました')
    }
    setGenerating(false)
  }

  async function handleCopy() {
    if (!schema) return
    await navigator.clipboard.writeText(JSON.stringify(schema, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800">FAQスキーマ（schema.org）</h2>
            <p className="text-xs text-gray-500 mt-1">記事内のFAQや疑問詞見出しからJSON-LDを生成します。<br />生成後、&lt;script type="application/ld+json"&gt;タグで記事ページに埋め込んでください。</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !markdown}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {generating ? '生成中...' : 'FAQスキーマ生成'}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>
        )}

        {schema && (
          <div>
            <div className="flex justify-end mb-2">
              <button
                onClick={handleCopy}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:border-gray-400 transition-colors"
              >
                {copied ? 'コピーしました！' : 'コピー'}
              </button>
            </div>
            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-800 overflow-auto whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────
// EditAssistPanel
// ─────────────────────────────────────────────

function parseHeadings(markdown) {
  return markdown.split('\n').reduce((acc, line, idx) => {
    const m = line.match(/^(#{2,4})\s+(.+)/)
    if (m) acc.push({ level: `h${m[1].length}`, text: m[2].trim(), lineIdx: idx })
    return acc
  }, [])
}

const EDIT_TYPES = [
  { key: 'text_edit', label: '文章修正' },
  { key: 'service',   label: 'サービス紹介を挿入' },
  { key: 'cta',       label: 'CTAを挿入' },
]

function EditAssistPanel({ open, onClose, jobId, articleText, intentText, onApply }) {
  const [step, setStep] = useState(1)
  const [editType, setEditType] = useState('')
  const [headings, setHeadings] = useState([])
  const [selectedHeading, setSelectedHeading] = useState(null)
  const [insertPosition, setInsertPosition] = useState('end_of_section')
  const [instruction, setInstruction] = useState('')
  const [insertStyle, setInsertStyle] = useState('natural')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedCtaId, setSelectedCtaId] = useState('')
  const [services, setServices] = useState([])
  const [ctas, setCtas] = useState([])
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [applying, setApplying] = useState(false)
  const [panelError, setPanelError] = useState('')

  useEffect(() => {
    if (!open) return
    setStep(1); setEditType(''); setSelectedHeading(null)
    setInsertPosition('end_of_section'); setInstruction('')
    setInsertStyle('natural'); setSelectedServiceId(''); setSelectedCtaId('')
    setResult(null); setPanelError('')
    setHeadings(parseHeadings(articleText))
    getSupabase().from('services').select('id,name,category,url,selling_points').then(({ data }) => setServices(data ?? []))
    getSupabase().from('cta_blocks').select('id,name,category,body,button_text,url').then(({ data }) => setCtas(data ?? []))
  }, [open])

  async function handleGenerate() {
    if (!selectedHeading) return
    const service = services.find(s => s.id === selectedServiceId) ?? null
    const cta = ctas.find(c => c.id === selectedCtaId) ?? null
    setPanelError(''); setGenerating(true)
    try {
      const res = await fetch('/api/edit-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_text: articleText,
          intent_text: intentText,
          edit_type: editType,
          target_heading: selectedHeading.text,
          heading_level: selectedHeading.level,
          insert_position: insertPosition,
          instruction: editType === 'text_edit' ? instruction : '',
          service: service ? { name: service.name, selling_points: service.selling_points ?? [], url: service.url } : null,
          cta: cta ? { name: cta.name, body: cta.body, button_text: cta.button_text, url: cta.url } : null,
        }),
      })
      const data = await res.json()
      if (data.error) { setPanelError(data.error); setGenerating(false); return }
      setResult(data)
      setStep(4)
    } catch (e) {
      setPanelError('通信エラーが発生しました')
    }
    setGenerating(false)
  }

  async function handleApply() {
    if (!result) return
    setApplying(true)
    // edit_history に保存
    await getSupabase().from('edit_history').insert({
      job_id: jobId,
      edit_type: editType,
      target_section: selectedHeading?.text ?? '',
      before_text: result.original_section,
      after_text: result.modified_section,
    })
    // artifacts を更新
    await getSupabase()
      .from('artifacts')
      .update({ content_text: result.full_article })
      .eq('job_id', jobId)
      .eq('step', 'article')
    setApplying(false)
    onApply(result.full_article)
  }

  if (!open) return null

  const levelLabel = selectedHeading
    ? { h2: 'H2', h3: 'H3', h4: 'H4' }[selectedHeading.level] ?? ''
    : ''

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="font-semibold text-gray-800">編集アシスト</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-5 py-3 border-b border-gray-100 shrink-0">
          {[1,2,3].map(n => (
            <div key={n} className={`flex-1 h-1 rounded-full ${step > n ? 'bg-blue-600' : step === n ? 'bg-blue-400' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {panelError && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-3 mb-4">{panelError}</p>
          )}

          {/* STEP 1: 編集タイプ */}
          {step === 1 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">STEP 1：編集タイプを選択</p>
              <div className="flex flex-col gap-2">
                {EDIT_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => { setEditType(t.key); setStep(2) }}
                    className="text-left border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: 見出し選択 */}
          {step === 2 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">STEP 2：対象セクションを選択</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-4 max-h-64 overflow-y-auto">
                {headings.length === 0 ? (
                  <p className="text-sm text-gray-400 p-4">見出しが見つかりません</p>
                ) : headings.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedHeading(h)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                      selectedHeading?.text === h.text && selectedHeading?.level === h.level
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-50 text-gray-700'
                    } ${h.level === 'h3' ? 'pl-7' : h.level === 'h4' ? 'pl-11' : ''}`}
                  >
                    <span className="text-xs text-gray-400 mr-1.5">{h.level.toUpperCase()}</span>
                    <span className={h.level === 'h2' ? 'font-semibold' : ''}>{h.text}</span>
                  </button>
                ))}
              </div>

              {selectedHeading && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">挿入位置</p>
                  {[
                    { val: 'end_of_section', label: `この${levelLabel}セクションの末尾` },
                    { val: 'after_heading',  label: `この${levelLabel}の直後（コンテンツの前）` },
                  ].map(opt => (
                    <label key={opt.val} className="flex items-center gap-2 text-sm text-gray-700 mb-2 cursor-pointer">
                      <input
                        type="radio"
                        name="insertPosition"
                        value={opt.val}
                        checked={insertPosition === opt.val}
                        onChange={() => setInsertPosition(opt.val)}
                        className="accent-blue-600"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">戻る</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!selectedHeading}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 transition-colors disabled:opacity-40"
                >
                  次へ
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: 内容指定 */}
          {step === 3 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">STEP 3：内容を指定</p>
              <p className="text-xs text-gray-500 mb-4 bg-gray-50 rounded px-3 py-2">
                対象：<span className="font-medium text-gray-700">{selectedHeading?.text}</span>
              </p>

              {editType === 'text_edit' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">修正指示</label>
                  <textarea
                    value={instruction}
                    onChange={e => setInstruction(e.target.value)}
                    rows={5}
                    placeholder="例：もう少し簡潔にして&#10;例：です・ます調に統一して"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}

              {editType === 'service' && (
                <div className="flex flex-col gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">サービスを選択</label>
                    <select
                      value={selectedServiceId}
                      onChange={e => setSelectedServiceId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- 選択 --</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">挿入スタイル</label>
                    {[
                      { val: 'natural', label: '自然な本文として挿入' },
                      { val: 'box',     label: 'ボックス形式で挿入' },
                    ].map(opt => (
                      <label key={opt.val} className="flex items-center gap-2 text-sm text-gray-700 mb-2 cursor-pointer">
                        <input
                          type="radio"
                          name="insertStyle"
                          value={opt.val}
                          checked={insertStyle === opt.val}
                          onChange={() => setInsertStyle(opt.val)}
                          className="accent-blue-600"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {editType === 'cta' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">CTAを選択</label>
                  <select
                    value={selectedCtaId}
                    onChange={e => setSelectedCtaId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- 選択 --</option>
                    {ctas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">戻る</button>
                <button
                  onClick={handleGenerate}
                  disabled={generating || (editType === 'text_edit' && !instruction.trim()) || (editType === 'service' && !selectedServiceId) || (editType === 'cta' && !selectedCtaId)}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 transition-colors disabled:opacity-40"
                >
                  {generating ? '生成中...' : '生成'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: 結果・適用 */}
          {step === 4 && result && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">STEP 4：変更内容を確認</p>
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1">変更前</p>
                <pre className="bg-red-50 border border-red-100 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-40">{result.original_section}</pre>
              </div>
              <div className="mb-5">
                <p className="text-xs font-medium text-gray-500 mb-1">変更後</p>
                <pre className="bg-green-50 border border-green-100 rounded p-3 text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-40">{result.modified_section}</pre>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setResult(null); setStep(3) }}
                  className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  やり直し
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700 transition-colors disabled:opacity-40"
                >
                  {applying ? '適用中...' : '適用'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
