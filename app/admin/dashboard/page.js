'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'

function KPICard({ label, value, sub, highlight }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${highlight ? 'text-green-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => { setStats(data); setLoading(false) })
        .catch(() => { setError('データ取得に失敗しました'); setLoading(false) })
    })
  }, [])

  if (loading) return <div className="p-8 text-gray-400 text-sm">読み込み中...</div>
  if (error) return <div className="p-8 text-red-500 text-sm">{error}</div>

  const { totalUsers = 0, activeUsers = 0, monthlyJobs = 0, planCounts = {}, conversionRate = 0, revenue = 0 } = stats ?? {}
  const activeRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0

  return (
    <div className="px-8 py-8 max-w-5xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-gray-900">管理ダッシュボード</h1>
        <p className="text-gray-500 text-sm mt-1">運営・売上の概況</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <KPICard label="総ユーザー数" value={totalUsers.toLocaleString()} sub="累計登録" />
        <KPICard label="今月アクティブ" value={activeUsers.toLocaleString()} sub={`アクティブ率 ${activeRate}%`} />
        <KPICard label="今月の生成数" value={monthlyJobs.toLocaleString()} sub="記事・調査含む" />
        <KPICard label="売上推計" value={`¥${revenue.toLocaleString()}`} sub="月次（プラン課金）" highlight />
      </div>

      {/* Plan breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-600">プラン内訳</h2>
          <span className="text-sm text-gray-500">
            課金転換率 <span className="font-semibold text-gray-600">{conversionRate}%</span>
            <span className="text-xs text-gray-400 ml-1">（フリー→有料）</span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'free',     label: 'フリー',        cardBg: 'bg-gray-50',    badge: 'bg-gray-200 text-gray-700',    bar: 'bg-gray-400' },
            { key: 'standard', label: 'スタンダード',  cardBg: 'bg-blue-50',    badge: 'bg-blue-200 text-blue-800',    bar: 'bg-blue-500' },
            { key: 'pro',      label: 'プロ',          cardBg: 'bg-purple-50',  badge: 'bg-purple-200 text-purple-800', bar: 'bg-purple-500' },
          ].map(p => {
            const count = planCounts[p.key] ?? 0
            const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0
            return (
              <div key={p.key} className={`rounded-xl p-4 ${p.cardBg}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.badge}`}>{p.label}</span>
                  <span className="text-2xl font-bold text-gray-600">{count}<span className="text-sm font-normal text-gray-500 ml-0.5">人</span></span>
                </div>
                <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${p.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">{pct}%</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
