'use client'

export const dynamic = 'force-dynamic'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getSupabase } from '@/lib/supabase'

export default function ArticlePage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [content, setContent] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      fetchArticle()
    })
  }, [id])

  async function fetchArticle() {
    const { data, error } = await getSupabase()
      .from('artifacts')
      .select('content_text')
      .eq('job_id', id)
      .eq('step', 'article')
      .single()

    if (error || !data) {
      setError('記事が見つかりませんでした')
    } else {
      setContent(data.content_text)
    }
  }

  async function handleCopy() {
    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">記事表示</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            disabled={!content}
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

      <main className="max-w-3xl mx-auto px-8 py-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-sm">
            {error}
          </div>
        ) : content === null ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 prose prose-gray max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        )}
      </main>
    </div>
  )
}
