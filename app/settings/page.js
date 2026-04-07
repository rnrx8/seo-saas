'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'

const PLANS = [
  {
    id: 'free',
    name: 'フリー',
    description: '5記事/月',
    credits: 5,
    price: '無料',
    color: 'border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
  },
  {
    id: 'standard',
    name: 'スタンダード',
    description: '30記事/月',
    credits: 30,
    price: '¥2,980/月',
    color: 'border-blue-400',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'pro',
    name: 'プロ',
    description: '無制限',
    credits: null,
    price: '¥9,800/月',
    color: 'border-purple-400',
    badge: 'bg-purple-100 text-purple-700',
  },
]

const PLAN_LABELS = {
  free: 'フリー',
  standard: 'スタンダード',
  pro: 'プロ',
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      fetchProfile(session.user.id)
    })
  }, [])

  async function fetchProfile(userId) {
    const { data } = await getSupabase()
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  function handleUpgrade(planId) {
    alert(`「${PLAN_LABELS[planId]}」プランへのアップグレード機能は準備中です（Stripe連携予定）`)
  }

  function handleBuyCredits() {
    alert('クレジット追加購入機能は準備中です（Stripe連携予定）')
  }

  async function handleLogout() {
    await getSupabase().auth.signOut()
    router.replace('/login')
  }

  if (loading) return null

  const usedCredits = profile ? profile.credits_total - profile.credits_remaining : 0
  const isPro = profile?.plan === 'pro'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">SEO記事生成</h1>
        <nav className="flex items-center gap-6 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-700 transition-colors">ダッシュボード</Link>
          <Link href="/settings" className="font-medium text-blue-600">プラン設定</Link>
          <Link href="/settings/services" className="hover:text-gray-700 transition-colors">サービス管理</Link>
          <Link href="/settings/ctas" className="hover:text-gray-700 transition-colors">CTA管理</Link>
          <Link href="/settings/companies" className="hover:text-gray-700 transition-colors">企業管理</Link>
          <Link href="/settings/sources" className="hover:text-gray-700 transition-colors">一次情報</Link>
          <button onClick={handleLogout} className="hover:text-gray-700 transition-colors">ログアウト</button>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-8">
        {/* Current plan summary */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">現在のプラン</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">プラン</p>
              <p className="text-lg font-semibold text-gray-800">
                {PLAN_LABELS[profile?.plan] ?? profile?.plan ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">残りクレジット</p>
              <p className={`text-lg font-semibold ${!isPro && profile?.credits_remaining <= 1 ? 'text-red-600' : 'text-gray-800'}`}>
                {isPro ? '無制限' : `${profile?.credits_remaining ?? 0} 記事`}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">累計使用数</p>
              <p className="text-lg font-semibold text-gray-800">
                {isPro ? '—' : `${usedCredits} 記事`}
              </p>
            </div>
          </div>
          {!isPro && (
            <div className="mt-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: profile?.credits_total
                      ? `${(profile.credits_remaining / profile.credits_total) * 100}%`
                      : '0%',
                  }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {profile?.credits_total ?? 0}記事中 {profile?.credits_remaining ?? 0}記事残り
              </p>
            </div>
          )}
        </section>

        {/* Credit add-on */}
        {!isPro && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">クレジットを追加購入</h2>
                <p className="text-sm text-gray-500 mt-1">10記事単位で購入できます（準備中）</p>
              </div>
              <button
                onClick={handleBuyCredits}
                className="border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium px-5 py-2 rounded-lg text-sm transition-colors"
              >
                クレジット追加
              </button>
            </div>
          </section>
        )}

        {/* Plan list */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">プランを変更する</h2>
          <div className="flex flex-col gap-4">
            {PLANS.map((plan) => {
              const isCurrent = profile?.plan === plan.id
              return (
                <div
                  key={plan.id}
                  className={`flex items-center justify-between border-2 rounded-xl px-5 py-4 transition-colors ${
                    isCurrent ? plan.color + ' bg-gray-50' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{plan.name}</span>
                        {isCurrent && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan.badge}`}>
                            現在のプラン
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">{plan.price}</span>
                    {!isCurrent && (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        {plan.id === 'free' ? 'ダウングレード' : 'アップグレード'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
