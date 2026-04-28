'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'

function calcSimilarity(kw1, kw2) {
  const t1 = kw1.toLowerCase().split(/\s+/).filter(Boolean)
  const t2 = kw2.toLowerCase().split(/\s+/).filter(Boolean)
  if (!t1.length || !t2.length) return 0
  let matches = 0
  for (const a of t1) {
    for (const b of t2) {
      if (a === b || a.includes(b) || b.includes(a)) { matches++; break }
    }
  }
  return matches / Math.max(t1.length, t2.length)
}

const PLAN_LABELS = {
  free: 'フリープラン',
  standard: 'スタンダードプラン',
  pro: 'プロプラン',
}

export default function DashboardPage() {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [companyRestriction, setCompanyRestriction] = useState('category') // 'category'|'registered_only'|'ai'
  const [categorySetting, setCategorySetting] = useState(null) // 'registered_only'|'ai'|null
  const [deliveryType, setDeliveryType] = useState('full') // 'full'|'outline_only'|'research_only'
  const [articlePurpose, setArticlePurpose] = useState('')
  const [articlePurposeOther, setArticlePurposeOther] = useState('')
  const [wordCountType, setWordCountType] = useState('absolute') // 'absolute'|'relative'
  const [wordCountValue, setWordCountValue] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [mustReferenceUrls, setMustReferenceUrls] = useState('')
  const [neverReferenceUrls, setNeverReferenceUrls] = useState('')
  const [showUrlFields, setShowUrlFields] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkKeywords, setBulkKeywords] = useState('')
  const [jobs, setJobs] = useState([])
  const [profile, setProfile] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [pollingId, setPollingId] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null) // { type: 'success'|'error', text: string }

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setAuthChecked(true)
        fetchJobs()
        fetchProfile(session.user.id)
      }
    })
  }, [])

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await getSupabase()
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
  }, [])

  const fetchJobs = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setJobs(data)
  }, [])

  useEffect(() => {
    return () => {
      if (pollingId) clearInterval(pollingId)
    }
  }, [pollingId])

  useEffect(() => {
    const trimmed = category.trim()
    if (!trimmed) { setCategorySetting(null); return }
    getSupabase()
      .from('category_settings')
      .select('company_restriction')
      .eq('category', trimmed)
      .maybeSingle()
      .then(({ data }) => setCategorySetting(data?.company_restriction ?? null))
  }, [category])

  async function handleBulkGenerate(e) {
    e.preventDefault()
    const keywords = bulkKeywords.split('\n').map(k => k.trim()).filter(Boolean)
    if (!keywords.length || generating) return

    setGenerating(true)
    setStatusMessage(null)

    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    let resolvedRestriction = companyRestriction
    if (companyRestriction === 'category') resolvedRestriction = categorySetting ?? 'ai'
    const resolvedPurpose = articlePurpose === 'other' ? (articlePurposeOther.trim() || null) : (articlePurpose || null)

    let successCount = 0
    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i]
      setStatusMessage({ type: 'info', text: `登録中… (${i + 1}/${keywords.length}) ${kw}` })
      const { data: job, error } = await supabase.from('jobs').insert({
        main_keyword: kw,
        status: 'queued',
        category: category.trim() || null,
        tenant_id: user.id,
        company_restriction: resolvedRestriction,
        delivery_type: deliveryType,
        article_purpose: resolvedPurpose,
        word_count_setting: wordCountValue || null,
        target_audience: targetAudience.trim() || null,
        custom_prompt: customPrompt.trim() || null,
        must_reference_urls: mustReferenceUrls.trim() || null,
        never_reference_urls: neverReferenceUrls.trim() || null,
      }).select().single()

      if (!error && job) {
        fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: job.id, keyword: job.main_keyword }),
        }).catch(() => {})
        successCount++
      }
      if (i < keywords.length - 1) await new Promise(r => setTimeout(r, 300))
    }

    await fetchJobs()
    setBulkKeywords('')
    setGenerating(false)
    setStatusMessage({ type: 'success', text: `${successCount}件を登録しました。バックグラウンドで生成が開始されます。` })
  }

  async function handleGenerate(e) {
    e.preventDefault()
    if (!keyword.trim() || generating) return

    // クレジットチェック（proプランは無制限）
    if (profile?.plan !== 'pro' && profile?.credits_remaining <= 0) {
      setStatusMessage({ type: 'error', text: 'クレジットが不足しています。設定ページからプランをアップグレードしてください。' })
      return
    }

    setGenerating(true)
    setStatusMessage(null)

    // Insert job
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    // company_restriction を解決（'category' → category_settingsの値、未設定はデフォルト'ai'）
    let resolvedRestriction = companyRestriction
    if (companyRestriction === 'category') {
      resolvedRestriction = categorySetting ?? 'ai'
    }

    const resolvedPurpose = articlePurpose === 'other'
      ? (articlePurposeOther.trim() || null)
      : (articlePurpose || null)
    const resolvedWordCount = wordCountValue || null

    const { data: job, error: insertError } = await supabase
      .from('jobs')
      .insert({
        main_keyword: keyword.trim(),
        status: 'queued',
        category: category.trim() || null,
        tenant_id: user.id,
        company_restriction: resolvedRestriction,
        delivery_type: deliveryType,
        article_purpose: resolvedPurpose,
        word_count_setting: resolvedWordCount,
        target_audience: targetAudience.trim() || null,
        custom_prompt: customPrompt.trim() || null,
        must_reference_urls: mustReferenceUrls.trim() || null,
        never_reference_urls: neverReferenceUrls.trim() || null,
      })
      .select()
      .single()

    if (insertError || !job) {
      setStatusMessage({ type: 'error', text: 'ジョブの作成に失敗しました: ' + (insertError?.message ?? '') })
      setGenerating(false)
      return
    }

    await fetchJobs()
    setKeyword('')
    setCategory('')
    setCompanyRestriction('category')
    setCategorySetting(null)
    setDeliveryType('full')
    setArticlePurpose('')
    setArticlePurposeOther('')
    setWordCountValue('')
    setTargetAudience('')
    setCustomPrompt('')
    setMustReferenceUrls('')
    setNeverReferenceUrls('')

    // Next.js プロキシ経由で Railway API にリクエスト（30分タイムアウト）
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

    // 5秒おきにステータスをポーリング
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

        // 完了後にクレジットを1消費
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

  async function handleLogout() {
    await getSupabase().auth.signOut()
    router.replace('/login')
  }

  function statusBadge(status) {
    const map = {
      queued:  'bg-yellow-100 text-yellow-800',
      running: 'bg-blue-100 text-blue-800',
      done:    'bg-green-100 text-green-800',
      failed:  'bg-red-100 text-red-800',
      error:   'bg-red-100 text-red-800',
    }
    return map[status] ?? 'bg-gray-100 text-gray-800'
  }

  if (!authChecked) return null

  const STEPS = [
    { key: 'serp',          label: '競合・SERP情報の取得' },
    { key: 'search_intent', label: '検索意図の分析' },
    { key: 'fact_sheet',    label: 'ファクトシートの作成' },
    { key: 'outline',       label: '記事構成案の作成' },
    { key: 'article',       label: '記事本文の執筆' },
    { key: 'review',        label: '最終確認・レビュー' },
  ]
  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep)

  const isPro = profile?.plan === 'pro'
  const similarJobs = keyword.trim()
    ? jobs.filter(j => j.status === 'done' && calcSimilarity(keyword.trim(), j.main_keyword) >= 0.5)
    : []
  const creditsLabel = isPro
    ? '無制限'
    : profile
    ? `残り${profile.credits_remaining}記事`
    : '...'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">SEO記事生成</h1>
        <div className="flex items-center gap-6">
          {profile && (
            <span className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">
                {PLAN_LABELS[profile.plan] ?? profile.plan}
              </span>
              {' '}｜{' '}
              <span className={!isPro && profile.credits_remaining <= 1 ? 'text-red-600 font-medium' : ''}>
                {creditsLabel}
              </span>
            </span>
          )}
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            設定
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-8 flex flex-col gap-8">
        {/* Generate form */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">記事を生成する</h2>
          <form onSubmit={bulkMode ? handleBulkGenerate : handleGenerate} className="flex flex-col gap-3">
            {/* 納品物の選択 */}
            <div className="flex gap-2">
              {[
                { value: 'full',          label: '記事まで生成', time: '約20分' },
                { value: 'outline_only',  label: '構成案まで',   time: '約10分' },
                { value: 'research_only', label: '調査のみ',     time: '約5分'  },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDeliveryType(opt.value)}
                  disabled={generating}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 flex flex-col items-center ${
                    deliveryType === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {opt.label}
                  <span className={`text-[10px] font-normal mt-0.5 ${deliveryType === opt.value ? 'text-blue-200' : 'text-gray-400'}`}>
                    {opt.time}
                  </span>
                </button>
              ))}
            </div>
            {/* 単体 / 一括 切り替え */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[{ v: false, label: '単体' }, { v: true, label: '一括' }].map(opt => (
                  <button
                    key={String(opt.v)}
                    type="button"
                    onClick={() => setBulkMode(opt.v)}
                    disabled={generating}
                    className={`px-3 py-1 rounded text-xs font-medium border transition-colors disabled:opacity-50 ${bulkMode === opt.v ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'}`}
                  >{opt.label}</button>
                ))}
              </div>
              {bulkMode && <span className="text-xs text-gray-400">1行1キーワード</span>}
            </div>
            {/* キーワード入力 */}
            <div className="flex gap-3">
              {bulkMode ? (
                <textarea
                  value={bulkKeywords}
                  onChange={(e) => setBulkKeywords(e.target.value)}
                  placeholder={"保険 30代 おすすめ\nクレジットカード 比較\n転職 エージェント おすすめ"}
                  disabled={generating}
                  rows={4}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="メインキーワードを入力..."
                  disabled={generating}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              )}
              <button
                type="submit"
                disabled={generating || (bulkMode ? !bulkKeywords.trim() : (!keyword.trim() || (!isPro && profile?.credits_remaining <= 0)))}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 whitespace-nowrap self-start"
              >
                {generating ? (bulkMode ? '登録中...' : '生成中...') : (bulkMode ? '一括登録' : '記事生成')}
              </button>
            </div>
            {/* 詳細設定トグル */}
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 text-left transition-colors flex items-center gap-1"
            >
              <span>{showAdvanced ? '▲' : '▼'}</span>
              <span>詳細設定（カテゴリ・記事目的・文字数・ターゲット層など）</span>
            </button>
            {showAdvanced && (
              <div className="flex flex-col gap-3 pt-1 border-t border-gray-100">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="カテゴリ（任意）例：転職、クレジットカード"
                    disabled={generating}
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  />
                  <select
                    value={companyRestriction}
                    onChange={(e) => setCompanyRestriction(e.target.value)}
                    disabled={generating}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700"
                  >
                    <option value="category">
                      {companyRestriction === 'category' && categorySetting
                        ? `カテゴリ設定に従う（現在：${categorySetting === 'registered_only' ? '登録企業のみ' : 'AIに任せる'}）`
                        : 'カテゴリ設定に従う'}
                    </option>
                    <option value="registered_only">登録企業のみ（強制）</option>
                    <option value="ai">AIに任せる（強制）</option>
                  </select>
                </div>
                {/* 記事目的 */}
                <div className="flex gap-3">
                  <select
                    value={articlePurpose}
                    onChange={(e) => setArticlePurpose(e.target.value)}
                    disabled={generating}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700"
                  >
                    <option value="">記事目的（任意）</option>
                    <option value="inbound">誘導記事（SEO流入→回遊）</option>
                    <option value="cv">自社商品・サービスのCV</option>
                    <option value="line">LINE・メルマガ登録</option>
                    <option value="whitepaper">ホワイトペーパー・資料DL</option>
                    <option value="branding">ブランディング・認知拡大</option>
                    <option value="other">その他</option>
                  </select>
                  {articlePurpose === 'other' && (
                    <input
                      type="text"
                      value={articlePurposeOther}
                      onChange={(e) => setArticlePurposeOther(e.target.value)}
                      placeholder="記事目的を入力..."
                      disabled={generating}
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  )}
                </div>
                {/* 文字数指定 */}
                <div className="flex gap-3">
                  <select
                    value={wordCountType}
                    onChange={(e) => { setWordCountType(e.target.value); setWordCountValue('') }}
                    disabled={generating}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700"
                  >
                    <option value="absolute">絶対値</option>
                    <option value="relative">競合比（相対値）</option>
                  </select>
                  <select
                    value={wordCountValue}
                    onChange={(e) => setWordCountValue(e.target.value)}
                    disabled={generating}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700"
                  >
                    <option value="">文字数指定（任意）</option>
                    {wordCountType === 'absolute' ? (
                      <>
                        <option value="〜3,000字">〜3,000字</option>
                        <option value="3,000〜5,000字">3,000〜5,000字</option>
                        <option value="5,000〜7,000字">5,000〜7,000字</option>
                        <option value="7,000〜10,000字">7,000〜10,000字</option>
                        <option value="10,000〜15,000字">10,000〜15,000字</option>
                        <option value="15,000字〜">15,000字〜</option>
                      </>
                    ) : (
                      <>
                        <option value="競合平均-20%">競合平均 -20%</option>
                        <option value="競合平均-10%">競合平均 -10%</option>
                        <option value="競合平均±0%">競合平均 ±0%</option>
                        <option value="競合平均+20%">競合平均 +20%</option>
                        <option value="競合平均+50%">競合平均 +50%</option>
                        <option value="競合平均+100%">競合平均 +100%</option>
                      </>
                    )}
                  </select>
                </div>
                {/* ターゲット層 */}
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="ターゲット層（任意）例：30代会社員・副業初心者"
                  disabled={generating}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
                {/* 自由記述プロンプト */}
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="追加指示（任意）例：競合他社Aには言及しない、体験談を多めに入れる"
                  disabled={generating}
                  rows={2}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none"
                />
                {/* 参照URL設定 */}
                <button
                  type="button"
                  onClick={() => setShowUrlFields(v => !v)}
                  className="text-xs text-gray-400 hover:text-gray-600 text-left transition-colors"
                >
                  {showUrlFields ? '▲ 参照URL設定を閉じる' : '▼ 参照URL設定（任意）'}
                </button>
                {showUrlFields && (
                  <div className="flex flex-col gap-2 pl-2 border-l-2 border-gray-100">
                    <textarea
                      value={mustReferenceUrls}
                      onChange={(e) => setMustReferenceUrls(e.target.value)}
                      placeholder={"参照必須URL（1行1URL）\nhttps://example.com/page1\nhttps://example.com/page2"}
                      disabled={generating}
                      rows={3}
                      className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none"
                    />
                    <textarea
                      value={neverReferenceUrls}
                      onChange={(e) => setNeverReferenceUrls(e.target.value)}
                      placeholder={"参照・言及禁止URL（1行1URL）\nhttps://competitor.com"}
                      disabled={generating}
                      rows={2}
                      className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none"
                    />
                  </div>
                )}
              </div>
            )}
          </form>
          {similarJobs.length > 0 && !generating && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-yellow-800 mb-1">類似キーワードの記事があります（カニバリゼーションに注意）</p>
              <ul className="flex flex-col gap-0.5 mb-1.5">
                {similarJobs.map(j => (
                  <li key={j.id} className="text-xs text-yellow-700">
                    ・<button onClick={() => router.push(`/article/${j.id}`)} className="underline hover:text-yellow-900 transition-colors">{j.main_keyword}</button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-yellow-600">内容が重複する可能性があります。このまま生成することもできます。</p>
            </div>
          )}
          {!isPro && profile?.credits_remaining <= 0 && !generating && (
            <p className="text-sm text-red-600 mt-3">
              クレジットが不足しています。
              <Link href="/settings" className="underline ml-1">プランをアップグレード</Link>
            </p>
          )}
          {generating && (
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
              <p className="text-xs font-medium text-blue-700 mb-3 flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                生成中…完了まで数分かかります
              </p>
              <ol className="flex flex-col gap-1.5">
                {STEPS.map((step, i) => {
                  const isDone = currentStepIndex > i
                  const isActive = currentStepIndex === i
                  const isPending = currentStepIndex < i
                  return (
                    <li key={step.key} className="flex items-center gap-2 text-xs">
                      {isDone && <span className="w-4 h-4 flex items-center justify-center rounded-full bg-green-500 text-white text-[10px] shrink-0">✓</span>}
                      {isActive && <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />}
                      {isPending && <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />}
                      <span className={isDone ? 'text-green-600 line-through' : isActive ? 'text-blue-700 font-medium' : 'text-gray-400'}>
                        {step.label}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
          {statusMessage && !generating && (
            <p className={`text-sm mt-3 ${statusMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {statusMessage.text}
            </p>
          )}
        </section>

        {/* Jobs table */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">生成済み記事</h2>
          </div>
          {jobs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-12">まだ記事がありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-3 text-left">キーワード</th>
                  <th className="px-6 py-3 text-left">ステータス</th>
                  <th className="px-6 py-3 text-left">作成日</th>
                  <th className="px-6 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">{job.main_keyword}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusBadge(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(job.created_at).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4">
                      {job.status === 'done' && (
                        <button
                          onClick={() => router.push(`/article/${job.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                          表示
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  )
}
