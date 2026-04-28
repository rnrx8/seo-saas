'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import MainLayout from '@/app/_components/v2/MainLayout'

const STEPS = [
  { key: 'serp',          label: 'SERP取得' },
  { key: 'search_intent', label: '検索意図' },
  { key: 'fact_sheet',    label: 'ファクトシート' },
  { key: 'outline',       label: '構成案' },
  { key: 'article',       label: '記事執筆' },
  { key: 'review',        label: 'レビュー' },
]

function StatusBadge({ status }) {
  const map = {
    queued:  { bg: '#fef9c3', color: '#854d0e', label: '待機中' },
    running: { bg: '#dbeafe', color: '#1e40af', label: '生成中' },
    done:    { bg: '#dcfce7', color: '#166534', label: '完了' },
    failed:  { bg: '#fee2e2', color: '#991b1b', label: '失敗' },
  }
  const s = map[status] ?? { bg: '#f3f4f6', color: '#6b7280', label: status }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function StepProgress({ currentStep }) {
  const idx = STEPS.findIndex(s => s.key === currentStep)
  return (
    <div className="flex items-center gap-1 mt-1">
      {STEPS.map((s, i) => (
        <div
          key={s.key}
          className="h-1 rounded-full flex-1"
          style={{
            backgroundColor: i < idx ? '#2563eb' : i === idx ? '#93c5fd' : '#e2e8f0',
          }}
          title={s.label}
        />
      ))}
      {currentStep && (
        <span className="ml-1 text-[10px] text-blue-600 whitespace-nowrap">
          {STEPS.find(s => s.key === currentStep)?.label}
        </span>
      )}
    </div>
  )
}

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function wordCount(text) {
  if (!text) return 0
  return text.replace(/\s/g, '').length
}

export default function NewDashboardPage() {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [jobs, setJobs] = useState([])
  const [profile, setProfile] = useState(null)
  const [theme, setTheme] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [authChecked, setAuthChecked] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [pollingId, setPollingId] = useState(null)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setAuthChecked(true)
        fetchJobs()
        fetchProfile(session.user.id)
        fetchTheme(session.user.id)
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      if (pollingId) clearInterval(pollingId)
    }
  }, [pollingId])

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await getSupabase()
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
  }, [])

  const fetchTheme = useCallback(async (userId) => {
    const { data } = await getSupabase()
      .from('tenant_themes')
      .select('*')
      .eq('tenant_id', userId)
      .maybeSingle()
    if (data) setTheme(data)
  }, [])

  const fetchJobs = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('jobs')
      .select('id, main_keyword, status, created_at, current_step, category')
      .order('created_at', { ascending: false })
    if (!error && data) setJobs(data)
  }, [])

  async function handleGenerate(e) {
    e.preventDefault()
    if (!keyword.trim() || generating) return

    if (profile?.plan !== 'pro' && profile?.credits_remaining <= 0) {
      setStatusMessage({ type: 'error', text: 'クレジットが不足しています。' })
      return
    }

    setGenerating(true)
    setStatusMessage(null)

    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: job, error: insertError } = await supabase
      .from('jobs')
      .insert({
        main_keyword: keyword.trim(),
        status: 'queued',
        category: category.trim() || null,
        tenant_id: user.id,
        company_restriction: 'ai',
        delivery_type: 'full',
      })
      .select()
      .single()

    if (insertError || !job) {
      setStatusMessage({ type: 'error', text: 'ジョブの作成に失敗しました' })
      setGenerating(false)
      return
    }

    await fetchJobs()
    setKeyword('')
    setCategory('')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000)

    try {
      await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id, keyword: job.main_keyword }),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name !== 'AbortError') {
        setStatusMessage({ type: 'error', text: 'サーバーに接続できませんでした' })
        setGenerating(false)
        return
      }
    }
    clearTimeout(timeoutId)

    const id = setInterval(async () => {
      const { data } = await getSupabase()
        .from('jobs')
        .select('status, current_step')
        .eq('id', job.id)
        .single()

      if (data?.current_step !== undefined) setCurrentStep(data.current_step)

      if (data?.status === 'done') {
        clearInterval(id)
        setPollingId(null)
        setGenerating(false)
        setCurrentStep(null)
        fetchJobs()
        if (profile?.plan !== 'pro') {
          await getSupabase()
            .from('user_profiles')
            .update({ credits_remaining: profile.credits_remaining - 1 })
            .eq('id', profile.id)
          await fetchProfile(profile.id)
        }
        setStatusMessage({ type: 'success', text: '生成完了！' })
      } else if (data?.status === 'failed') {
        clearInterval(id)
        setPollingId(null)
        setGenerating(false)
        setCurrentStep(null)
        fetchJobs()
        setStatusMessage({ type: 'error', text: '生成に失敗しました' })
      }
    }, 5000)
    setPollingId(id)
  }

  if (!authChecked) return null

  const filteredJobs = jobs.filter(j => {
    const matchSearch = !searchFilter || j.main_keyword?.toLowerCase().includes(searchFilter.toLowerCase())
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    return matchSearch && matchStatus
  })

  const isPro = profile?.plan === 'pro'
  const creditsRemaining = profile?.credits_remaining ?? 0

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">SEO記事生成ダッシュボード</h1>
          <p className="text-gray-500 text-sm mt-1">キーワードを入力して、SEO最適化された記事を自動生成します</p>
        </div>

        {/* Generate form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-3.5 h-3.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-800">新規記事生成</h2>
          </div>

          <form onSubmit={handleGenerate} className="flex flex-col gap-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="メインキーワードを入力（例：転職エージェント おすすめ 30代）"
                disabled={generating}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 bg-gray-50"
              />
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="カテゴリ（任意）"
                disabled={generating}
                className="w-44 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 bg-gray-50"
              />
              <button
                type="submit"
                disabled={generating || !keyword.trim() || (!isPro && creditsRemaining <= 0)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {generating ? '生成中...' : '記事生成'}
              </button>
            </div>

            {generating && currentStep && (
              <div className="flex flex-col gap-1">
                <StepProgress currentStep={currentStep} />
              </div>
            )}

            {statusMessage && (
              <div className={`text-sm px-4 py-2.5 rounded-xl ${
                statusMessage.type === 'error'
                  ? 'bg-red-50 text-red-700'
                  : statusMessage.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-blue-50 text-blue-700'
              }`}>
                {statusMessage.text}
              </div>
            )}
          </form>
        </div>

        {/* Jobs table card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table header with filters */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-gray-800">生成済み記事一覧</h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="キーワードで検索..."
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 bg-gray-50"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-600"
              >
                <option value="all">すべてのステータス</option>
                <option value="queued">待機中</option>
                <option value="running">生成中</option>
                <option value="done">完了</option>
                <option value="failed">失敗</option>
              </select>
              <button
                onClick={fetchJobs}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="更新"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path d="M4 4v5h5M20 20v-5h-5" strokeLinecap="round" />
                  <path d="M4 9a8 8 0 0114.93-3.36M20 15a8 8 0 01-14.93 3.36" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">キーワード</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ステータス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">作成日時</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">カテゴリ</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 text-sm py-12">
                    {jobs.length === 0 ? 'まだ記事が生成されていません' : '条件に一致する記事がありません'}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800">{job.main_keyword}</div>
                      {job.status === 'running' && job.current_step && (
                        <StepProgress currentStep={job.current_step} />
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-400">{formatDate(job.created_at)}</td>
                    <td className="px-4 py-4 text-xs text-gray-400">{job.category ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      {job.status === 'done' ? (
                        <Link
                          href={`/article/${job.id}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          記事を見る →
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  )
}
