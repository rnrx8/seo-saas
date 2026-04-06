'use client'

export const dynamic = 'force-dynamic'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getSupabase } from '@/lib/supabase'

const TABS = [
  { key: 'article',       label: '記事' },
  { key: 'search_intent', label: '検索意図' },
  { key: 'outline',       label: '構成案' },
  { key: 'serp',          label: '競合情報' },
]

export default function ArticlePage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [artifacts, setArtifacts] = useState({})
  const [activeTab, setActiveTab] = useState('article')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

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
      .in('step', ['article', 'search_intent', 'outline', 'serp'])

    if (error || !data) {
      setError('データが見つかりませんでした')
      return
    }
    const map = {}
    for (const row of data) map[row.step] = row.content_text
    setArtifacts(map)
  }

  async function handleCopy() {
    const text = artifacts['article']
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLoading = Object.keys(artifacts).length === 0 && !error

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">記事表示</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            disabled={!artifacts['article']}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
          >
            {copied ? 'コピーしました！' : 'コピー'}
          </button>
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
                <article className="prose prose-gray max-w-none">
                  <ReactMarkdown>{artifacts['article'] ?? ''}</ReactMarkdown>
                </article>
              )}

              {activeTab === 'search_intent' && (
                <article className="prose prose-gray max-w-none">
                  <ReactMarkdown>{artifacts['search_intent'] ?? '（データなし）'}</ReactMarkdown>
                </article>
              )}

              {activeTab === 'outline' && (
                <article className="prose prose-gray max-w-none">
                  <ReactMarkdown>{artifacts['outline'] ?? '（データなし）'}</ReactMarkdown>
                </article>
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

function SerpView({ content }) {
  if (!content) return <p className="text-gray-400 text-sm">（データなし）</p>

  let results = null
  try {
    const parsed = JSON.parse(content)
    // SerpApi の organic_results or 配列直接に対応
    results = Array.isArray(parsed) ? parsed : (parsed.organic_results ?? null)
  } catch {
    // JSON でなければ plain text フォールバック
    return <pre className="text-sm text-gray-700 whitespace-pre-wrap">{content}</pre>
  }

  if (!results) {
    return <pre className="text-sm text-gray-700 whitespace-pre-wrap">{content}</pre>
  }

  return (
    <div className="flex flex-col gap-4">
      {results.map((item, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-green-700 truncate mb-1">{item.link ?? item.url ?? ''}</p>
              <a
                href={item.link ?? item.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 font-medium text-sm hover:underline"
              >
                {item.title ?? '（タイトルなし）'}
              </a>
              {item.snippet && (
                <p className="text-gray-600 text-sm mt-1 leading-relaxed">{item.snippet}</p>
              )}
            </div>
            <span className="text-xs text-gray-400 shrink-0">#{i + 1}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
