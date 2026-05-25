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

function calcSimilarity(kw1, kw2) {
  const t1 = kw1.toLowerCase().split(/\s+/).filter(Boolean)
  const t2 = kw2.toLowerCase().split(/\s+/).filter(Boolean)
  if (!t1.length || !t2.length) return 0
  let matches = 0
  for (const a of t1) for (const b of t2) if (a === b || a.includes(b) || b.includes(a)) { matches++; break }
  return matches / Math.max(t1.length, t2.length)
}

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
  if (idx < 0) return null
  return (
    <div className="flex items-center gap-1 mt-1.5">
      {STEPS.map((s, i) => (
        <div
          key={s.key}
          className="h-1 rounded-full flex-1 transition-all"
          style={{ backgroundColor: i < idx ? '#2563eb' : i === idx ? '#93c5fd' : '#e2e8f0' }}
          title={s.label}
        />
      ))}
      <span className="ml-1 text-[10px] text-blue-600 whitespace-nowrap flex-shrink-0">
        {STEPS[idx].label}
      </span>
    </div>
  )
}

function formatDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function NewDashboardPage() {
  const router = useRouter()

  // --- Form state ---
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [companyRestriction, setCompanyRestriction] = useState('preset')
  const [deliveryType, setDeliveryType] = useState('full')
  const [articlePurpose, setArticlePurpose] = useState('')
  const [articlePurposeOther, setArticlePurposeOther] = useState('')
  const [wordCountType, setWordCountType] = useState('absolute')
  const [wordCountValue, setWordCountValue] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [mustReferenceUrls, setMustReferenceUrls] = useState('')
  const [neverReferenceUrls, setNeverReferenceUrls] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)

  // --- Preset state ---
  const [presets, setPresets] = useState([])
  const [selectedPresetId, setSelectedPresetId] = useState(null)
  const [presetModified, setPresetModified] = useState(false)
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [savePresetName, setSavePresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)

  // --- Linked items state ---
  const [allServices, setAllServices] = useState([])
  const [allCtas, setAllCtas] = useState([])
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [selectedCtaId, setSelectedCtaId] = useState(null)
  const [bulkKeywords, setBulkKeywords] = useState('')

  // --- App state ---
  const [jobs, setJobs] = useState([])
  const [profile, setProfile] = useState(null)
  const [theme, setTheme] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [pollingId, setPollingId] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  // --- Table filters ---
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setAuthChecked(true)
        fetchJobs()
        fetchProfile(session.user.id)
        fetchTheme(session.user.id)
        fetchPresets()
        fetchAllServices()
        fetchAllCtas()
      }
    })
  }, [])

  useEffect(() => () => { if (pollingId) clearInterval(pollingId) }, [pollingId])

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await getSupabase().from('user_profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }, [])

  const fetchTheme = useCallback(async (userId) => {
    const { data } = await getSupabase().from('tenant_themes').select('*').eq('tenant_id', userId).maybeSingle()
    if (data) setTheme(data)
  }, [])

  const fetchPresets = useCallback(async () => {
    const { data } = await getSupabase().from('presets').select('*').order('name')
    if (data) setPresets(data)
  }, [])

  const fetchAllServices = useCallback(async () => {
    const { data } = await getSupabase().from('services').select('id, name, preset_id').order('name')
    if (data) setAllServices(data)
  }, [])

  const fetchAllCtas = useCallback(async () => {
    const { data } = await getSupabase().from('cta_blocks').select('id, name, preset_id').order('name')
    if (data) setAllCtas(data)
  }, [])

  const fetchJobs = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from('jobs')
      .select('id, main_keyword, status, created_at, current_step, category')
      .order('created_at', { ascending: false })
    if (!error && data) setJobs(data)
  }, [])

  function resolveJobParams(kw) {
    let resolvedRestriction = companyRestriction
    if (companyRestriction === 'preset') {
      const preset = presets.find(p => p.id === selectedPresetId)
      resolvedRestriction = preset?.company_restriction ?? 'ai'
    }
    const resolvedPurpose = articlePurpose === 'other' ? (articlePurposeOther.trim() || null) : (articlePurpose || null)
    return {
      main_keyword: kw,
      status: 'queued',
      category: category.trim() || null,
      company_restriction: resolvedRestriction,
      delivery_type: deliveryType,
      article_purpose: resolvedPurpose,
      word_count_setting: wordCountValue || null,
      target_audience: targetAudience.trim() || null,
      custom_prompt: customPrompt.trim() || null,
      must_reference_urls: mustReferenceUrls.trim() || null,
      never_reference_urls: neverReferenceUrls.trim() || null,
      service_id: selectedServiceId ?? null,
      cta_id: selectedCtaId ?? null,
    }
  }

  function markModified() {
    if (selectedPresetId) setPresetModified(true)
  }

  function applyPreset(preset) {
    if (!preset) {
      setSelectedPresetId(null)
      setPresetModified(false)
      setShowSavePreset(false)
      return
    }
    setSelectedPresetId(preset.id)
    setPresetModified(false)
    setShowSavePreset(false)
    if (preset.category != null) setCategory(preset.category ?? '')
    if (preset.delivery_type) setDeliveryType(preset.delivery_type)
    if (preset.article_purpose) setArticlePurpose(preset.article_purpose)
    if (preset.word_count_setting) {
      setWordCountType(preset.word_count_setting.startsWith('競合') ? 'relative' : 'absolute')
      setWordCountValue(preset.word_count_setting)
    } else {
      setWordCountValue('')
    }
    setTargetAudience(preset.target_audience ?? '')
    setCustomPrompt(preset.custom_prompt ?? '')
    setMustReferenceUrls(preset.must_reference_urls ?? '')
    setNeverReferenceUrls(preset.never_reference_urls ?? '')
    // 企業制限は「プリセット設定に従う」のまま（resolveJobParamsでpresetを参照）
    setCompanyRestriction('preset')
    // プリセットに紐付いたサービス・CTAを自動選択
    const linkedSvc = allServices.find(s => s.preset_id === preset.id)
    const linkedCta = allCtas.find(c => c.preset_id === preset.id)
    setSelectedServiceId(linkedSvc?.id ?? null)
    setSelectedCtaId(linkedCta?.id ?? null)
  }

  async function handleSaveNewPreset() {
    if (!savePresetName.trim()) return
    setSavingPreset(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const resolvedPurpose = articlePurpose === 'other' ? (articlePurposeOther.trim() || null) : (articlePurpose || null)
    await supabase.from('presets').insert({
      tenant_id: user.id,
      name: savePresetName.trim(),
      category: category.trim() || null,
      delivery_type: deliveryType,
      article_purpose: resolvedPurpose,
      word_count_setting: wordCountValue || null,
      target_audience: targetAudience.trim() || null,
      custom_prompt: customPrompt.trim() || null,
      must_reference_urls: mustReferenceUrls.trim() || null,
      never_reference_urls: neverReferenceUrls.trim() || null,
      company_restriction: companyRestriction === 'category' ? null : companyRestriction,
    })
    await fetchPresets()
    setSavingPreset(false)
    setShowSavePreset(false)
    setPresetModified(false)
    setSavePresetName('')
  }

  async function handleBulkGenerate(e) {
    e.preventDefault()
    const keywords = bulkKeywords.split('\n').map(k => k.trim()).filter(Boolean)
    if (!keywords.length || generating) return

    setGenerating(true)
    setStatusMessage(null)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    let successCount = 0
    for (let i = 0; i < keywords.length; i++) {
      setStatusMessage({ type: 'info', text: `登録中… (${i + 1}/${keywords.length}) ${keywords[i]}` })
      const { data: job, error } = await supabase
        .from('jobs')
        .insert({ ...resolveJobParams(keywords[i]), tenant_id: user.id })
        .select().single()
      if (!error && job) {
        fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: job.id, keyword: job.main_keyword, word_count_setting: job.word_count_setting }) }).catch(() => {})
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

    const creditCost = (deliveryType === 'outline_only' || deliveryType === 'research_only') ? 0.5 : 1
    if (profile?.plan !== 'pro' && profile?.credits_remaining < creditCost) {
      setStatusMessage({ type: 'error', text: 'クレジットが不足しています。設定ページからプランをアップグレードしてください。' })
      return
    }

    setGenerating(true)
    setStatusMessage(null)

    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: job, error: insertError } = await supabase
      .from('jobs')
      .insert({ ...resolveJobParams(keyword.trim()), tenant_id: user.id })
      .select().single()

    if (insertError || !job) {
      setStatusMessage({ type: 'error', text: 'ジョブの作成に失敗しました: ' + (insertError?.message ?? '') })
      setGenerating(false)
      return
    }

    await fetchJobs()
    setKeyword('')

    // fire-and-forget: Railway が cold start でタイムアウトしても job は DB に残るので polling で追跡できる
    const callGenerate = () => fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: job.id, keyword: job.main_keyword, word_count_setting: job.word_count_setting }),
    }).catch(() => {})

    callGenerate()

    // queued のまま2分経過したら /api/generate を再送信（Railway cold start 対策、最大3回）
    let queuedSince = Date.now()
    let retryCount = 0
    const RETRY_AFTER_MS = 2 * 60 * 1000
    const MAX_RETRIES = 3

    const id = setInterval(async () => {
      const { data } = await getSupabase().from('jobs').select('status, current_step').eq('id', job.id).single()
      if (data?.current_step !== undefined) setCurrentStep(data.current_step)

      if (data?.status === 'queued') {
        if (Date.now() - queuedSince > RETRY_AFTER_MS) {
          if (retryCount < MAX_RETRIES) {
            retryCount++
            queuedSince = Date.now()
            callGenerate()
          } else {
            clearInterval(id); setPollingId(null); setGenerating(false); setCurrentStep(null); fetchJobs()
            setStatusMessage({ type: 'error', text: '生成を開始できませんでした。ページを更新して再度お試しください。' })
          }
        }
      } else if (data?.status === 'running') {
        queuedSince = Date.now()
      } else if (data?.status === 'done') {
        clearInterval(id); setPollingId(null); setGenerating(false); setCurrentStep(null); fetchJobs()
        if (profile?.plan !== 'pro') {
          await getSupabase().from('user_profiles').update({ credits_remaining: profile.credits_remaining - creditCost }).eq('id', profile.id)
          await fetchProfile(profile.id)
        }
        setStatusMessage({ type: 'success', text: '生成完了！' })
      } else if (data?.status === 'failed') {
        clearInterval(id); setPollingId(null); setGenerating(false); setCurrentStep(null); fetchJobs()
        setStatusMessage({ type: 'error', text: '生成に失敗しました' })
      }
    }, 5000)
    setPollingId(id)
  }

  if (!authChecked) return null

  const isPro = profile?.plan === 'pro'
  const creditsRemaining = profile?.credits_remaining ?? 0

  const similarJobs = keyword.trim()
    ? jobs.filter(j => j.status === 'done' && calcSimilarity(keyword.trim(), j.main_keyword) >= 0.5)
    : []

  const filteredJobs = jobs.filter(j => {
    const matchSearch = !searchFilter || j.main_keyword?.toLowerCase().includes(searchFilter.toLowerCase())
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="px-8 py-8">
        {/* Generate form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} className="w-3.5 h-3.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="font-semibold text-gray-800">新規記事生成</h2>
          </div>

          <form onSubmit={bulkMode ? handleBulkGenerate : handleGenerate} className="flex flex-col gap-3">

            {/* 納品物選択 */}
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
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-50 flex flex-col items-center ${
                    deliveryType === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                  <span className={`text-[10px] font-normal mt-0.5 ${deliveryType === opt.value ? 'text-blue-200' : 'text-gray-400'}`}>
                    {opt.time}
                  </span>
                </button>
              ))}
            </div>

            {/* 単体 / 一括 */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                {[{ v: false, label: '単体' }, { v: true, label: '一括' }].map(opt => (
                  <button
                    key={String(opt.v)}
                    type="button"
                    onClick={() => setBulkMode(opt.v)}
                    disabled={generating}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                      bulkMode === opt.v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {bulkMode && <span className="text-xs text-gray-400">1行1キーワード</span>}
            </div>

            {/* キーワード入力 */}
            <div className="flex gap-3">
              {bulkMode ? (
                <textarea
                  value={bulkKeywords}
                  onChange={e => setBulkKeywords(e.target.value)}
                  placeholder={"保険 30代 おすすめ\nクレジットカード 比較\n転職 エージェント おすすめ"}
                  disabled={generating}
                  rows={4}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 bg-gray-50 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="メインキーワードを入力（例：転職エージェント おすすめ 30代）"
                  disabled={generating}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 bg-gray-50"
                />
              )}
              <button
                type="submit"
                disabled={generating || (bulkMode ? !bulkKeywords.trim() : (!keyword.trim() || (!isPro && creditsRemaining <= 0)))}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors disabled:opacity-50 whitespace-nowrap self-start"
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
              <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
                {/* プリセット選択 */}
                <div className="flex gap-2 items-center">
                  <select
                    value={selectedPresetId ?? ''}
                    onChange={e => {
                      const id = e.target.value
                      if (!id) { applyPreset(null); return }
                      const preset = presets.find(p => p.id === id)
                      if (preset) applyPreset(preset)
                    }}
                    disabled={generating}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700 bg-gray-50"
                  >
                    <option value="">プリセットを選択（任意）</option>
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.category ? ` [${p.category}]` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedPresetId && (
                    <button
                      type="button"
                      onClick={() => applyPreset(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
                    >
                      クリア
                    </button>
                  )}
                </div>

                {/* 変更通知 + 新規プリセット登録 */}
                {presetModified && !showSavePreset && (
                  <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-yellow-700 flex-1">プリセットから設定を変更しました</span>
                    <button
                      type="button"
                      onClick={() => { setSavePresetName(''); setShowSavePreset(true) }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
                    >
                      ＋ 新規プリセット登録
                    </button>
                  </div>
                )}
                {showSavePreset && (
                  <div className="flex gap-2 items-center bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <input
                      type="text"
                      value={savePresetName}
                      onChange={e => setSavePresetName(e.target.value)}
                      placeholder="新しいプリセット名"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveNewPreset}
                      disabled={savingPreset || !savePresetName.trim()}
                      className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {savingPreset ? '保存中...' : '保存'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSavePreset(false)}
                      className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* 企業制限 */}
                <select
                  value={companyRestriction}
                  onChange={e => { setCompanyRestriction(e.target.value); markModified() }}
                  disabled={generating}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700 bg-gray-50"
                >
                  <option value="preset">プリセット設定に従う</option>
                  <option value="registered_only">登録企業のみ</option>
                  <option value="registered_plus">登録企業＋AIおすすめ</option>
                  <option value="ai">AIおまかせ</option>
                </select>

                {/* 記事目的 */}
                <div className="flex gap-3">
                  <select
                    value={articlePurpose}
                    onChange={e => { setArticlePurpose(e.target.value); markModified() }}
                    disabled={generating}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700 bg-gray-50"
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
                      onChange={e => { setArticlePurposeOther(e.target.value); markModified() }}
                      placeholder="記事目的を入力..."
                      disabled={generating}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 bg-gray-50"
                    />
                  )}
                </div>

                {/* 文字数指定 */}
                <div className="flex gap-3">
                  <select
                    value={wordCountType}
                    onChange={e => { setWordCountType(e.target.value); setWordCountValue(''); markModified() }}
                    disabled={generating}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700 bg-gray-50"
                  >
                    <option value="absolute">絶対値</option>
                    <option value="relative">競合比（相対値）</option>
                  </select>
                  <select
                    value={wordCountValue}
                    onChange={e => { setWordCountValue(e.target.value); markModified() }}
                    disabled={generating}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700 bg-gray-50"
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
                  onChange={e => { setTargetAudience(e.target.value); markModified() }}
                  placeholder="ターゲット層（任意）例：30代会社員・副業初心者"
                  disabled={generating}
                  className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 bg-gray-50"
                />

                {/* 自由記述プロンプト */}
                <textarea
                  value={customPrompt}
                  onChange={e => { setCustomPrompt(e.target.value); markModified() }}
                  placeholder="追加指示（任意）例：競合他社Aには言及しない、体験談を多めに入れる"
                  disabled={generating}
                  rows={2}
                  className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 bg-gray-50 resize-none"
                />

                {/* 参照URL設定 */}
                <div className="flex flex-col gap-2">
                  <textarea
                    value={mustReferenceUrls}
                    onChange={e => { setMustReferenceUrls(e.target.value); markModified() }}
                    placeholder={"参照必須URL（1行1URL）\nhttps://example.com/page1"}
                    disabled={generating}
                    rows={2}
                    className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 bg-gray-50 resize-none"
                  />
                  <textarea
                    value={neverReferenceUrls}
                    onChange={e => { setNeverReferenceUrls(e.target.value); markModified() }}
                    placeholder={"参照・言及禁止URL（1行1URL）\nhttps://competitor.com"}
                    disabled={generating}
                    rows={2}
                    className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 bg-gray-50 resize-none"
                  />
                </div>

                {/* サービス・CTA参照 */}
                {(allServices.length > 0 || allCtas.length > 0) && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500">サービス・CTA（任意）</p>
                    {allServices.length > 0 && (
                      <select
                        value={selectedServiceId ?? ''}
                        onChange={e => { setSelectedServiceId(e.target.value || null); markModified() }}
                        disabled={generating}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700 bg-gray-50"
                      >
                        <option value="">サービスを選択（任意）</option>
                        {allServices.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                    {allCtas.length > 0 && (
                      <select
                        value={selectedCtaId ?? ''}
                        onChange={e => { setSelectedCtaId(e.target.value || null); markModified() }}
                        disabled={generating}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 text-gray-700 bg-gray-50"
                      >
                        <option value="">CTAを選択（任意）</option>
                        {allCtas.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 生成中プログレス */}
            {generating && currentStep && <StepProgress currentStep={currentStep} />}

            {/* ステータスメッセージ */}
            {statusMessage && (
              <div className={`text-sm px-4 py-2.5 rounded-xl ${
                statusMessage.type === 'error'   ? 'bg-red-50 text-red-700'
                : statusMessage.type === 'success' ? 'bg-green-50 text-green-700'
                : 'bg-blue-50 text-blue-700'
              }`}>
                {statusMessage.text}
              </div>
            )}

            {/* カニバリゼーション警告 */}
            {similarJobs.length > 0 && !generating && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-yellow-800 mb-1">類似キーワードの記事があります（カニバリゼーションに注意）</p>
                <ul className="flex flex-col gap-0.5 mb-1.5">
                  {similarJobs.map(j => (
                    <li key={j.id} className="text-xs text-yellow-700">
                      ・<button type="button" onClick={() => router.push(`/article/${j.id}`)} className="underline hover:text-yellow-900">{j.main_keyword}</button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-yellow-600">内容が重複する可能性があります。このまま生成することもできます。</p>
              </div>
            )}

            {!isPro && creditsRemaining <= 0 && !generating && (
              <p className="text-sm text-red-600">
                クレジットが不足しています。
                <Link href="/settings" className="underline ml-1">プランをアップグレード</Link>
              </p>
            )}
          </form>
        </div>

        {/* Jobs table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-gray-800">生成済み記事一覧</h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="キーワードで検索..."
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 bg-gray-50"
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 text-gray-600"
              >
                <option value="all">すべて</option>
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
                filteredJobs.map(job => (
                  <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800">{job.main_keyword}</div>
                      {job.status === 'running' && job.current_step && <StepProgress currentStep={job.current_step} />}
                    </td>
                    <td className="px-4 py-4"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-4 text-xs text-gray-400">{formatDate(job.created_at)}</td>
                    <td className="px-4 py-4 text-xs text-gray-400">{job.category ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      {job.status === 'done' ? (
                        <Link href={`/article/${job.id}`} className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
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
