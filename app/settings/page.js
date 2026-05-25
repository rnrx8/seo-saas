'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import MainLayout from '@/app/_components/v2/MainLayout'

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
  const [theme, setTheme] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleteStep, setDeleteStep] = useState(null) // null | 'confirm' | 'password'
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePasswordError, setDeletePasswordError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [wpUrl, setWpUrl] = useState('')
  const [wpUsername, setWpUsername] = useState('')
  const [wpAppPassword, setWpAppPassword] = useState('')
  const [wpAuthType, setWpAuthType] = useState('app_password')
  const [wpSaving, setWpSaving] = useState(false)
  const [wpSaveMsg, setWpSaveMsg] = useState('')
  const [highAccuracyDefault, setHighAccuracyDefault] = useState(false)
  const [accuracySaving, setAccuracySaving] = useState(false)
  const [accuracySaveMsg, setAccuracySaveMsg] = useState('')

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await getSupabase()
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setWpUrl(data?.wp_url ?? '')
    setWpUsername(data?.wp_username ?? '')
    setWpAppPassword(data?.wp_app_password ?? '')
    setWpAuthType(data?.wp_auth_type ?? 'app_password')
    setHighAccuracyDefault(data?.high_accuracy_mode_default ?? false)
    setLoading(false)
  }, [])

  const fetchTheme = useCallback(async (userId) => {
    const { data } = await getSupabase().from('tenant_themes').select('*').eq('tenant_id', userId).maybeSingle()
    if (data) setTheme(data)
  }, [])

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      fetchProfile(session.user.id)
      fetchTheme(session.user.id)
    })
  }, [fetchProfile, fetchTheme])

  async function handleWpSave() {
    setWpSaving(true)
    setWpSaveMsg('')
    const { error } = await getSupabase()
      .from('user_profiles')
      .update({ wp_url: wpUrl.trim(), wp_username: wpUsername.trim(), wp_app_password: wpAppPassword.trim(), wp_auth_type: wpAuthType })
      .eq('id', profile.id)
    setWpSaving(false)
    setWpSaveMsg(error ? '保存に失敗しました' : '保存しました')
    setTimeout(() => setWpSaveMsg(''), 3000)
  }

  function handleUpgrade(planId) {
    alert(`「${PLAN_LABELS[planId]}」プランへのアップグレード機能は準備中です（Stripe連携予定）`)
  }

  async function handleAccuracySave(checked) {
    setHighAccuracyDefault(checked)
    setAccuracySaving(true)
    setAccuracySaveMsg('')
    const { error } = await getSupabase()
      .from('user_profiles')
      .update({ high_accuracy_mode_default: checked })
      .eq('id', profile.id)
    setAccuracySaving(false)
    setAccuracySaveMsg(error ? '保存に失敗しました' : '保存しました')
    setTimeout(() => setAccuracySaveMsg(''), 3000)
  }

  function handleBuyCredits() {
    alert('クレジット追加購入機能は準備中です（Stripe連携予定）')
  }

  async function handleExport() {
    const supabase = getSupabase()
    const [jobsRes, servicesRes, ctasRes, companiesRes, sourcesRes, artifactsRes] =
      await Promise.all([
        supabase.from('jobs').select('id, main_keyword, status, category, created_at'),
        supabase.from('services').select('*'),
        supabase.from('cta_blocks').select('*'),
        supabase.from('company_settings').select('*'),
        supabase.from('primary_sources').select('id, title, category, file_path, file_type, created_at'),
        supabase.from('artifacts').select('*'),
      ])
    const exportData = {
      exported_at: new Date().toISOString(),
      jobs: jobsRes.data ?? [],
      artifacts: artifactsRes.data ?? [],
      services: servicesRes.data ?? [],
      cta_blocks: ctasRes.data ?? [],
      company_settings: companiesRes.data ?? [],
      primary_sources: sourcesRes.data ?? [],
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seo_data_export_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteAll() {
    setDeleting(true)
    setDeletePasswordError('')
    const supabase = getSupabase()
    try {
      // パスワード確認
      const { data: { user } } = await supabase.auth.getUser()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      })
      if (signInError) {
        setDeletePasswordError('パスワードが正しくありません')
        setDeleting(false)
        return
      }
      // 削除実行
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/delete-all-data', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      await supabase.auth.signOut()
      router.replace('/login')
    } catch {
      setDeleting(false)
    }
  }

  function closeDeleteModal() {
    setDeleteStep(null)
    setDeletePassword('')
    setDeletePasswordError('')
  }

  if (loading) return null

  const usedCredits = profile ? profile.credits_total - profile.credits_remaining : 0
  const isPro = profile?.plan === 'pro'

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-8">
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
        {/* 生成デフォルト設定 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">生成デフォルト設定</h2>
          <p className="text-xs text-gray-500 mb-4">記事生成フォームを開いたときのデフォルト設定です。プリセット選択時はプリセット側の設定が優先されます。</p>
          <div className="flex items-start gap-3 border rounded-lg px-4 py-4 border-amber-200 bg-amber-50">
            <input
              type="checkbox"
              id="default-high-accuracy"
              checked={highAccuracyDefault}
              onChange={e => handleAccuracySave(e.target.checked)}
              disabled={accuracySaving}
              className="mt-0.5 w-4 h-4 accent-amber-500 cursor-pointer flex-shrink-0"
            />
            <div className="flex-1">
              <label htmlFor="default-high-accuracy" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2">
                情報精度99.9%モードをデフォルトで有効にする
                <span className="text-xs font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">+0.2クレジット/記事</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                記事生成後、本文の全数値・統計・固有名詞をWebで再検索して自動確認・修正します。<br />
                Tier1ソース（公式・政府・学術）は1件で確認済み、Tier2（一般サイト）は複数一致で確認済みと判定します。
              </p>
              {accuracySaveMsg && (
                <p className={`text-xs mt-2 ${accuracySaveMsg === '保存しました' ? 'text-green-600' : 'text-red-600'}`}>{accuracySaveMsg}</p>
              )}
            </div>
          </div>
        </section>

        {/* WordPress連携 */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">WordPress連携</h2>
          <p className="text-xs text-gray-500 mb-4">設定するとWordPressへ記事を下書き投稿できます。</p>
          <div className="flex flex-col gap-3">
            {/* 認証方式 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">認証方式</label>
              <div className="flex flex-col gap-2">
                {[
                  { val: 'app_password', label: 'Application Password', desc: 'VPS・Kinsta・WP Engineなど多くの環境で利用可' },
                  { val: 'jwt', label: 'JWT認証', desc: 'ロリポップなど一部の共有サーバー向け（JWT Authentication for WP-APIプラグインが必要）' },
                ].map(opt => (
                  <label key={opt.val} className={`flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${wpAuthType === opt.val ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name="wpAuthType"
                      value={opt.val}
                      checked={wpAuthType === opt.val}
                      onChange={() => setWpAuthType(opt.val)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">サイトURL</label>
              <input
                type="url"
                value={wpUrl}
                onChange={e => setWpUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ユーザー名</label>
              <input
                type="text"
                value={wpUsername}
                onChange={e => setWpUsername(e.target.value)}
                placeholder="admin"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {wpAuthType === 'app_password' ? 'Application Password' : 'パスワード'}
              </label>
              <input
                type="password"
                value={wpAppPassword}
                onChange={e => setWpAppPassword(e.target.value)}
                placeholder={wpAuthType === 'app_password' ? 'xxxx xxxx xxxx xxxx xxxx xxxx' : 'WordPressのログインパスワード'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {wpAuthType === 'app_password' && (
                <p className="text-xs text-gray-400 mt-1">WP管理画面 → ユーザー → プロフィール → アプリケーションパスワードで発行</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 mt-1">
              {wpSaveMsg && (
                <span className={`text-xs ${wpSaveMsg === '保存しました' ? 'text-green-600' : 'text-red-600'}`}>{wpSaveMsg}</span>
              )}
              <button
                onClick={handleWpSave}
                disabled={wpSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {wpSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </section>

        {/* Data management */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">データ管理</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">データをエクスポート</p>
                <p className="text-xs text-gray-500 mt-0.5">記事・設定・成果物をJSONでダウンロード</p>
              </div>
              <button
                onClick={handleExport}
                className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm px-4 py-2 rounded-lg transition-colors"
              >
                エクスポート
              </button>
            </div>
            <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">データをすべて削除する</p>
                <p className="text-xs text-gray-500 mt-0.5">生成記事・設定・ファイルを含む全データを削除します。アカウントは削除されません。</p>
              </div>
              <button
                onClick={() => setDeleteStep('confirm')}
                className="border border-red-300 text-red-600 hover:bg-red-50 text-sm px-4 py-2 rounded-lg transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* STEP1: 確認モーダル */}
      {deleteStep === 'confirm' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-3">以下のデータをすべて削除します</h3>
            <ul className="text-sm text-gray-600 mb-4 flex flex-col gap-1 list-disc pl-5">
              <li>生成した記事・ファクトシート等の成果物</li>
              <li>サービス・CTA・企業・一次情報の設定</li>
              <li>アップロードしたファイル</li>
            </ul>
            <p className="text-sm text-red-600 mb-6">この操作は取り消せません。続けますか？</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeleteModal}
                className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => setDeleteStep('password')}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                次へ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP2: パスワード確認モーダル */}
      {deleteStep === 'password' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-900 mb-2">パスワードを確認</h3>
            <p className="text-sm text-gray-600 mb-4">確認のため、現在のパスワードを入力してください。</p>
            <input
              type="password"
              value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeletePasswordError('') }}
              placeholder="パスワード"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-2"
            />
            {deletePasswordError && (
              <p className="text-xs text-red-600 mb-3">{deletePasswordError}</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting || !deletePassword}
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
