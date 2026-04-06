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
]

export default function ArticlePage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [artifacts, setArtifacts] = useState({})
  const [activeTab, setActiveTab] = useState('article')
  const [error, setError] = useState('')

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
                <ArticleView markdown={artifacts['article'] ?? ''} />
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
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const VIEWS = [
  { key: 'preview',  label: 'プレビュー' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'html',     label: 'HTML' },
]

function ArticleView({ markdown }) {
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
        <button
          onClick={handleCopy}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-600 hover:border-gray-400 transition-colors"
        >
          {copied ? 'コピーしました！' : 'コピー'}
        </button>
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
