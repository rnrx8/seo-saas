'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'

const PLAN_LABELS = { free: 'フリー', standard: 'スタンダード', pro: 'プロ' }
const STATUS_MAP = {
  queued:  { bg: '#fef9c3', color: '#854d0e', label: '待機中' },
  running: { bg: '#dbeafe', color: '#1e40af', label: '生成中' },
  done:    { bg: '#dcfce7', color: '#166534', label: '完了' },
  failed:  { bg: '#fee2e2', color: '#991b1b', label: '失敗' },
}

function fmt(str, time) {
  if (!str) return '—'
  return new Date(str).toLocaleString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const userId = params?.id

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(null)
  const [creditDelta, setCreditDelta] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustMsg, setAdjustMsg] = useState(null)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session || !userId) return
      setToken(session.access_token)
      fetch(`/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => setLoading(false))
    })
  }, [userId])

  async function handleCreditAdjust() {
    const delta = parseInt(creditDelta)
    if (!delta || !token) return
    setAdjusting(true)
    setAdjustMsg(null)

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ credit_delta: delta }),
    })
    const result = await res.json()

    if (res.ok) {
      setData(prev => prev ? {
        ...prev,
        profile: { ...prev.profile, credits_remaining: result.credits_remaining, credits_total: result.credits_total },
      } : prev)
      setCreditDelta('')
      setAdjustMsg({ ok: true, text: `クレジットを調整しました（${delta > 0 ? '+' : ''}${delta}）` })
    } else {
      setAdjustMsg({ ok: false, text: result.error ?? '調整に失敗しました' })
    }

    setAdjusting(false)
    setTimeout(() => setAdjustMsg(null), 5000)
  }

  if (loading) return <div className="p-8 text-gray-400 text-sm">読み込み中...</div>
  if (!data) return <div className="p-8 text-red-500 text-sm">ユーザーが見つかりません</div>

  const { user, profile, recentJobs, companies } = data
  const isPro = profile?.plan === 'pro'
  const doneCount = (recentJobs ?? []).filter(j => j.status === 'done').length

  return (
    <div className="px-8 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-3 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" />
          </svg>
          ユーザー一覧
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 break-all">{user?.email ?? '—'}</h1>
        <p className="text-gray-500 text-sm mt-1">
          登録: {fmt(user?.created_at, false)} ・ 最終ログイン: {fmt(user?.last_sign_in_at, true)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Profile */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">プロフィール</h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
            <div>
              <dt className="text-xs text-gray-400">プラン</dt>
              <dd className="text-sm font-medium text-gray-600 mt-0.5">{PLAN_LABELS[profile?.plan] ?? profile?.plan ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">クレジット残 / 合計</dt>
              <dd className="text-sm font-medium text-gray-600 mt-0.5">
                {isPro ? <span className="text-purple-600">無制限</span> : `${profile?.credits_remaining ?? 0} / ${profile?.credits_total ?? 0}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">登録企業数</dt>
              <dd className="text-sm text-gray-600 mt-0.5">{companies?.length ?? 0}社</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">完了記事数（直近20件中）</dt>
              <dd className="text-sm text-gray-600 mt-0.5">{doneCount}件</dd>
            </div>
          </dl>
        </div>

        {/* Credit adjustment */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">クレジット調整</h2>
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              {[3, 5, 10].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCreditDelta(String(n))}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    creditDelta === String(n)
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  +{n}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={creditDelta}
                onChange={e => setCreditDelta(e.target.value)}
                placeholder="±数値"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={handleCreditAdjust}
                disabled={!creditDelta || adjusting}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {adjusting ? '...' : '適用'}
              </button>
            </div>
            {adjustMsg && (
              <p className={`text-xs ${adjustMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{adjustMsg.text}</p>
            )}
            <p className="text-[10px] text-gray-400 mt-1">負の値で減算。0クレジット未満にはなりません。</p>
          </div>
        </div>
      </div>

      {/* Recent jobs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">最近のジョブ（直近20件）</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">キーワード</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">ステータス</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">カテゴリ</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">日時</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(recentJobs ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 text-sm py-10">ジョブなし</td>
              </tr>
            ) : (
              recentJobs.map(job => {
                const s = STATUS_MAP[job.status] ?? { bg: '#f3f4f6', color: '#6b7280', label: job.status }
                return (
                  <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-sm text-gray-600">{job.main_keyword}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: s.bg, color: s.color }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{job.category ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmt(job.created_at, true)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
