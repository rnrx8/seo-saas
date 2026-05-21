'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import MainLayout from '@/app/_components/v2/MainLayout'

const REPO = 'rnrx8/seo-saas'

const STATUS_PRIORITY = [
  { label: 'bugfix:manual',        status: '手動対応中',            bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-400' },
  { label: 'bugfix:pr-lint-error', status: '確認待ち（lintエラー）', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  { label: 'bugfix:pr-ready',      status: '自動修正確認待ち',       bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
]

const STATUS_IN_PROGRESS = { status: '自動修正中',  bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-400' }
const STATUS_DONE        = { status: '対応完了',    bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-400' }

const ALL_STATUSES = [STATUS_IN_PROGRESS, ...STATUS_PRIORITY.slice().reverse(), STATUS_DONE]

function resolveStatus(issue) {
  if (issue.state === 'closed') return STATUS_DONE
  const labelSet = new Set(issue.labels.map(l => l.name))
  for (const s of STATUS_PRIORITY) {
    if (labelSet.has(s.label)) return s
  }
  return STATUS_IN_PROGRESS
}

function StatusBadge({ status }) {
  const { status: label, bg, text, dot } = status
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {label}
    </span>
  )
}

export default function BugsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [theme, setTheme] = useState(null)
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showClosed] = useState(true)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      fetchProfile(session.user.id)
      fetchTheme(session.user.id)
      fetchIssues()
    })
  }, [])

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await getSupabase().from('user_profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }, [])

  const fetchTheme = useCallback(async (userId) => {
    const { data } = await getSupabase().from('tenant_themes').select('*').eq('tenant_id', userId).maybeSingle()
    if (data) setTheme(data)
  }, [])

  const fetchIssues = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/issues?labels=bugfix&state=all&per_page=50&sort=created&direction=desc`,
        { headers: { Accept: 'application/vnd.github+json' } }
      )
      if (!res.ok) throw new Error()
      setIssues(await res.json())
    } catch {
      setError('バグレポートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  const filtered = showClosed ? issues : issues.filter(i => i.state === 'open')
  const openCount = issues.filter(i => i.state === 'open').length

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="p-8 max-w-5xl mx-auto">

        {/* ヘッダー */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">バグ対応状況</h1>
            <p className="text-sm text-gray-500 mt-1">
              自動修正ワークフローの進捗
              {!loading && openCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {openCount}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchIssues}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 transition-colors"
            >
              更新
            </button>
          </div>
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap gap-2 mb-5">
          {ALL_STATUSES.map(s => (
            <StatusBadge key={s.status} status={s} />
          ))}
        </div>

        {/* テーブル */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
            読み込み中...
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-red-500 text-sm">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
            バグ報告はありません
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs w-14">#</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs">バグ内容</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs w-56">ステータス</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs w-24">報告日</th>
                  <th className="px-5 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(issue => {
                  const status = resolveStatus(issue)
                  return (
                    <tr key={issue.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-gray-400 font-mono text-xs">{issue.number}</td>
                      <td className="px-5 py-4 text-gray-900 font-medium leading-snug">{issue.title}</td>
                      <td className="px-5 py-4"><StatusBadge status={status} /></td>
                      <td className="px-5 py-4 text-gray-400 text-xs">
                        {new Date(issue.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-4">
                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 text-xs"
                        >
                          詳細
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
