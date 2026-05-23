'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'

const SERPAPI_THRESHOLD = 3

function StatusBadge({ ok, label }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={ok
        ? { backgroundColor: '#dcfce7', color: '#166534' }
        : { backgroundColor: '#fee2e2', color: '#991b1b' }
      }
    >
      <span>{ok ? '✓' : '✕'}</span>
      {label}
    </span>
  )
}

function ServiceCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  )
}

function fmt(str) {
  if (!str) return '—'
  return new Date(str).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminServicesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/admin/service-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => { setError('取得に失敗しました'); setLoading(false) })
    })
  }, [])

  if (loading) return <div className="p-10 text-center text-gray-400 text-sm">読み込み中...</div>
  if (error)   return <div className="p-8 text-red-500 text-sm">{error}</div>

  const serp = data?.serpapi ?? {}
  const anth = data?.anthropic ?? {}
  const serpLeft = (serp.searches_left ?? 0) + (serp.extra_credits ?? 0)
  const serpTotal = serp.searches_per_month ?? 0
  const serpPct = serpTotal > 0 ? Math.min(100, Math.round((serpLeft / serpTotal) * 100)) : 0
  const serpLow = serpLeft <= SERPAPI_THRESHOLD
  const serpBarColor = serpLow ? '#dc2626' : serpPct < 20 ? '#f59e0b' : '#16a34a'

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">サービス状況</h1>
        <p className="text-gray-500 text-sm mt-1">外部APIの残量・疎通状態</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* SerpAPI */}
        <ServiceCard title="SerpAPI">
          {serp.error ? (
            <p className="text-red-500 text-sm">{serp.error}</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <StatusBadge ok={!serpLow} label={serpLow ? '残量わずか' : '正常'} />
                <span className="text-xs text-gray-400">{serp.plan_name}</span>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-800">残り <strong style={{ color: serpBarColor }}>{serpLeft}</strong> 回</span>
                  <span className="text-gray-400">/ 月{serpTotal}回</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${serpPct}%`, backgroundColor: serpBarColor }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-3">
                <span>今月使用: {serp.this_month_usage ?? '—'} 回</span>
                {serp.extra_credits > 0 && <span>エクストラ: +{serp.extra_credits} 回</span>}
              </div>
              {serpLow && (
                <a
                  href="https://serpapi.com/manage-api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block text-center text-xs text-red-600 hover:text-red-700 font-medium underline underline-offset-2"
                >
                  プランを追加する →
                </a>
              )}
            </>
          )}
        </ServiceCard>

        {/* Anthropic */}
        <ServiceCard title="Anthropic API">
          <div className="flex items-center justify-between mb-4">
            <StatusBadge ok={anth.status === 'ok'} label={anth.status === 'ok' ? '正常' : 'クレジット切れ'} />
          </div>
          {anth.status === 'credit_error' ? (
            <>
              <p className="text-sm text-gray-600 mb-1">直近24時間にクレジット切れエラーを検出しました。</p>
              <p className="text-xs text-gray-400 mb-4">最終エラー: {fmt(anth.last_error_at)}</p>
              <a
                href="https://console.anthropic.com/settings/billing"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs text-red-600 hover:text-red-700 font-medium underline underline-offset-2"
              >
                クレジットを追加する →
              </a>
            </>
          ) : (
            <p className="text-sm text-gray-500">直近24時間のクレジットエラーなし</p>
          )}
          <p className="text-xs text-gray-300 mt-4">※ 残高はAnthropicコンソールで確認してください</p>
        </ServiceCard>

        {/* Railway */}
        <ServiceCard title="Railway（パイプライン）">
          <div className="flex items-center justify-between mb-4">
            <StatusBadge ok label="外部確認" />
          </div>
          <p className="text-sm text-gray-500 mb-4">使用量・制限はRailwayのダッシュボードで確認してください。</p>
          <a
            href="https://railway.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-gray-500 hover:text-gray-700 font-medium underline underline-offset-2"
          >
            Railway ダッシュボードを開く →
          </a>
        </ServiceCard>

      </div>
    </div>
  )
}
