'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

const PLAN_LABELS = { free: 'フリー', standard: 'スタンダード', pro: 'プロ' }
const PLAN_BADGE = {
  free:     'bg-gray-100 text-gray-600',
  standard: 'bg-blue-100 text-blue-700',
  pro:      'bg-purple-100 text-purple-700',
}

function formatDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => { setUsers(data.users ?? []); setLoading(false) })
        .catch(() => { setError('データ取得に失敗しました'); setLoading(false) })
    })
  }, [])

  const filtered = users.filter(u => {
    const matchSearch = !search || u.email?.toLowerCase().includes(search.toLowerCase())
    const matchPlan = planFilter === 'all' || u.plan === planFilter
    return matchSearch && matchPlan
  })

  if (loading) return <div className="p-8 text-gray-400 text-sm">読み込み中...</div>
  if (error) return <div className="p-8 text-red-500 text-sm">{error}</div>

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
        <p className="text-gray-500 text-sm mt-1">{users.length}人のユーザー</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="メールアドレスで検索..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-64 bg-white"
        />
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-gray-700"
        >
          <option value="all">すべてのプラン</option>
          <option value="free">フリー</option>
          <option value="standard">スタンダード</option>
          <option value="pro">プロ</option>
        </select>
        {filtered.length !== users.length && (
          <span className="text-xs text-gray-400">{filtered.length}件表示</span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">メール</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">プラン</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">クレジット残</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">登録日</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">最終ログイン</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 text-sm py-12">
                  ユーザーが見つかりません
                </td>
              </tr>
            ) : (
              filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-800">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[u.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                      {PLAN_LABELS[u.plan] ?? u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {u.plan === 'pro' ? <span className="text-purple-600 font-medium">∞</span> : `${u.credits_remaining} / ${u.credits_total}`}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.last_sign_in_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => router.push(`/admin/users/${u.id}`)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
                    >
                      詳細 →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
