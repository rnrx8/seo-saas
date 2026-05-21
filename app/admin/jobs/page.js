'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

const STATUS_MAP = {
  queued:  { bg: '#fef9c3', color: '#854d0e', label: '待機中' },
  running: { bg: '#dbeafe', color: '#1e40af', label: '生成中' },
  done:    { bg: '#dcfce7', color: '#166534', label: '完了' },
  failed:  { bg: '#fee2e2', color: '#991b1b', label: '失敗' },
}

function fmt(str) {
  if (!str) return '—'
  return new Date(str).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_TABS = [
  { value: 'failed',  label: '失敗' },
  { value: 'running', label: '実行中' },
  { value: 'queued',  label: '待機中' },
  { value: 'all',     label: 'すべて' },
]

export default function AdminJobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('failed')
  const [sessionToken, setSessionToken] = useState(null)

  const fetchJobs = useCallback((status, token) => {
    setLoading(true)
    fetch(`/api/admin/jobs?status=${status}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setJobs(d.jobs ?? []); setLoading(false) })
      .catch(() => { setError('取得に失敗しました'); setLoading(false) })
  }, [])

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      setSessionToken(session.access_token)
      fetchJobs('failed', session.access_token)
    })
  }, [fetchJobs])

  function handleStatusChange(status) {
    setStatusFilter(status)
    if (sessionToken) fetchJobs(status, sessionToken)
  }

  if (error) return <div className="p-8 text-red-500 text-sm">{error}</div>

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ジョブ監視</h1>
        <p className="text-gray-500 text-sm mt-1">失敗・異常ジョブの早期発見</p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'bg-red-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => sessionToken && fetchJobs(statusFilter, sessionToken)}
          className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="更新"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M4 4v5h5M20 20v-5h-5" strokeLinecap="round" />
            <path d="M4 9a8 8 0 0114.93-3.36M20 15a8 8 0 01-14.93 3.36" strokeLinecap="round" />
          </svg>
        </button>
        {!loading && <span className="text-xs text-gray-400 ml-1">{jobs.length}件</span>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">キーワード</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">ステータス</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">ユーザー</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">カテゴリ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">ステップ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">日時</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 text-sm py-12">
                    {statusFilter === 'failed' ? '失敗ジョブはありません' : 'ジョブがありません'}
                  </td>
                </tr>
              ) : (
                jobs.map(job => {
                  const s = STATUS_MAP[job.status] ?? { bg: '#f3f4f6', color: '#6b7280', label: job.status }
                  return (
                    <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 text-sm text-gray-800 max-w-xs">
                        <span className="block truncate">{job.main_keyword}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: s.bg, color: s.color }}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
                        <span className="block truncate">{job.user_email}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{job.category ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{job.current_step ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmt(job.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        {job.tenant_id && (
                          <button
                            onClick={() => router.push(`/admin/users/${job.tenant_id}`)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
                          >
                            ユーザー →
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
