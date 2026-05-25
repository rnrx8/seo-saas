'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import MainLayout from '@/app/_components/v2/MainLayout'

const EMPTY_FORM = {
  name: '',
  category: '',
  purpose_filter: '',
  site_url: '',
  word_count_type: 'absolute',
  word_count_value: '',
  article_purpose: '',
  target_audience: '',
  custom_prompt: '',
  must_reference_urls: '',
  never_reference_urls: '',
  company_restriction: 'ai',
}

const RESTRICTION_OPTIONS = [
  { value: 'ai', label: 'AIおまかせ', desc: 'リスト外の企業も状況に応じて紹介' },
  { value: 'registered_plus', label: '登録企業＋AIおすすめ', desc: '登録企業を優先しつつAIが適切と判断した企業も紹介' },
  { value: 'registered_only', label: '登録企業のみ', desc: '登録した企業以外は一切紹介しない' },
]

const ARTICLE_PURPOSE_OPTIONS = [
  { value: '', label: '指定なし' },
  { value: 'inbound', label: '誘導記事（SEO流入→回遊）' },
  { value: 'cv', label: '自社商品・サービスのCV' },
  { value: 'line', label: 'LINE・メルマガ登録' },
  { value: 'whitepaper', label: 'ホワイトペーパー・資料DL' },
  { value: 'branding', label: 'ブランディング・認知拡大' },
  { value: 'other', label: 'その他（自由記述）' },
]

const SETTINGS_NAV = [
  { label: 'サービス管理', href: '/settings/services' },
  { label: 'CTA管理', href: '/settings/ctas' },
  { label: '企業管理', href: '/settings/companies' },
  { label: '一次情報', href: '/settings/sources' },
]

function Tag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
      {label}
      {onRemove && (
        <button onClick={onRemove} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
      )}
    </span>
  )
}

function ConditionTags({ preset }) {
  const tags = []
  if (preset.category) tags.push(`カテゴリ: ${preset.category}`)
  if (preset.purpose_filter) tags.push(`目的: ${preset.purpose_filter}`)
  if (preset.site_url) tags.push(`サイト: ${preset.site_url}`)
  if (!tags.length) return <span className="text-xs text-gray-400">条件なし（汎用）</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(t => <Tag key={t} label={t} />)}
    </div>
  )
}

export default function PresetsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [theme, setTheme] = useState(null)
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { mode: 'add'|'edit', form: {...} }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await getSupabase().from('user_profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }, [])

  const fetchTheme = useCallback(async (userId) => {
    const { data } = await getSupabase().from('tenant_themes').select('*').eq('tenant_id', userId).maybeSingle()
    if (data) setTheme(data)
  }, [])

  async function fetchPresets() {
    const { data } = await getSupabase()
      .from('presets')
      .select('*')
      .order('created_at', { ascending: true })
    setPresets(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      fetchProfile(session.user.id)
      fetchTheme(session.user.id)
      fetchPresets()
    })
  }, [fetchProfile, fetchTheme])

  function openAdd() {
    setModal({ mode: 'add', form: { ...EMPTY_FORM } })
    setError('')
  }

  function openEdit(preset) {
    const wcs = preset.word_count_setting ?? ''
    const wct = wcs.startsWith('競合') ? 'relative' : 'absolute'
    setModal({
      mode: 'edit',
      form: {
        id: preset.id,
        name: preset.name ?? '',
        category: preset.category ?? '',
        purpose_filter: preset.purpose_filter ?? '',
        site_url: preset.site_url ?? '',
        word_count_type: wct,
        word_count_value: wcs,
        article_purpose: preset.article_purpose ?? '',
        target_audience: preset.target_audience ?? '',
        custom_prompt: preset.custom_prompt ?? '',
        must_reference_urls: preset.must_reference_urls ?? '',
        never_reference_urls: preset.never_reference_urls ?? '',
        company_restriction: preset.company_restriction ?? 'ai',
      },
    })
    setError('')
  }

  async function handleDelete(id) {
    if (!confirm('このプリセットを削除しますか？\n紐付いている企業・サービス・CTAの preset_id はクリアされます。')) return
    await getSupabase().from('presets').delete().eq('id', id)
    fetchPresets()
  }

  async function handleSave() {
    if (!modal) return
    const { mode, form } = modal
    if (!form.name.trim()) { setError('プリセット名は必須です'); return }
    setSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      purpose_filter: form.purpose_filter.trim() || null,
      site_url: form.site_url.trim() || null,
      word_count_setting: form.word_count_value || null,
      article_purpose: form.article_purpose || null,
      target_audience: form.target_audience.trim() || null,
      custom_prompt: form.custom_prompt.trim() || null,
      must_reference_urls: form.must_reference_urls.trim() || null,
      never_reference_urls: form.never_reference_urls.trim() || null,
      company_restriction: form.company_restriction,
      updated_at: new Date().toISOString(),
    }
    if (mode === 'add') {
      const { error: e } = await supabase.from('presets').insert({ ...payload, tenant_id: user.id })
      if (e) { setError(e.message); setSaving(false); return }
    } else {
      const { error: e } = await supabase.from('presets').update(payload).eq('id', form.id)
      if (e) { setError(e.message); setSaving(false); return }
    }
    setSaving(false)
    setModal(null)
    fetchPresets()
  }

  function updateForm(key, value) {
    setModal(m => ({ ...m, form: { ...m.form, [key]: value } }))
  }

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">プリセット一覧</h1>
            <p className="text-xs text-gray-500 mt-0.5">記事生成の設定をプリセットとして保存・呼び出せます</p>
          </div>
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            ＋ プリセットを追加
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : presets.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
            プリセットがありません。「＋ プリセットを追加」から作成してください。
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {presets.map(preset => (
              <div key={preset.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 mb-2">{preset.name}</p>
                    <ConditionTags preset={preset} />
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                      {preset.word_count_setting && <span>文字数: {preset.word_count_setting}</span>}
                      {preset.article_purpose && <span>目的: {preset.article_purpose}</span>}
                      {preset.target_audience && <span>ターゲット: {preset.target_audience}</span>}
                      {preset.company_restriction === 'registered_only' && (
                        <span className="text-orange-600">登録企業のみ</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(preset)}
                      className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(preset.id)}
                      className="border border-red-200 text-red-600 hover:bg-red-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-gray-800">
                {modal.mode === 'add' ? 'プリセットを追加' : 'プリセットを編集'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}

              {/* 基本情報 */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">基本情報</h4>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">プリセット名 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={modal.form.name}
                      onChange={e => updateForm('name', e.target.value)}
                      placeholder="例：転職×アフィリエイト標準"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </section>

              {/* 条件ラベル */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">条件ラベル（絞り込み・整理用）</h4>
                <p className="text-xs text-gray-400 mb-3">記事生成時のプリセット選択で絞り込みに使います。未入力は全条件に対応。</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                    <input
                      type="text"
                      value={modal.form.category}
                      onChange={e => updateForm('category', e.target.value)}
                      placeholder="例：転職、クレジットカード"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">サイトURL（将来対応）</label>
                    <input
                      type="text"
                      value={modal.form.site_url}
                      onChange={e => updateForm('site_url', e.target.value)}
                      placeholder="例：https://example.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 opacity-50"
                      disabled
                    />
                  </div>
                </div>
              </section>

              {/* 生成設定 */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">生成設定</h4>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">目標文字数</label>
                    <div className="flex gap-2">
                      <select
                        value={modal.form.word_count_type}
                        onChange={e => { updateForm('word_count_type', e.target.value); updateForm('word_count_value', '') }}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      >
                        <option value="absolute">絶対値</option>
                        <option value="relative">競合比（相対値）</option>
                      </select>
                      <select
                        value={modal.form.word_count_value}
                        onChange={e => updateForm('word_count_value', e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      >
                        <option value="">指定なし</option>
                        {modal.form.word_count_type === 'absolute' ? (
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">記事目的</label>
                    <select
                      value={modal.form.article_purpose}
                      onChange={e => updateForm('article_purpose', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    >
                      {ARTICLE_PURPOSE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ターゲット層</label>
                    <input
                      type="text"
                      value={modal.form.target_audience}
                      onChange={e => updateForm('target_audience', e.target.value)}
                      placeholder="例：30代転職検討中のビジネスパーソン"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">カスタムプロンプト</label>
                    <textarea
                      value={modal.form.custom_prompt}
                      onChange={e => updateForm('custom_prompt', e.target.value)}
                      rows={3}
                      placeholder="例：リード文の冒頭は必ず読者の悩みから始めること"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">参照必須URL</label>
                    <textarea
                      value={modal.form.must_reference_urls}
                      onChange={e => updateForm('must_reference_urls', e.target.value)}
                      rows={2}
                      placeholder="https://example.com/research"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">参照・言及禁止URL</label>
                    <textarea
                      value={modal.form.never_reference_urls}
                      onChange={e => updateForm('never_reference_urls', e.target.value)}
                      rows={2}
                      placeholder="https://competitor.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* 企業紹介設定 */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">企業紹介設定</h4>
                <div className="flex flex-col gap-2">
                  {RESTRICTION_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                        modal.form.company_restriction === opt.value
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="company_restriction"
                        value={opt.value}
                        checked={modal.form.company_restriction === opt.value}
                        onChange={() => updateForm('company_restriction', opt.value)}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-700">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
              {/* 紐付き設定（各設定ページへのリンク） */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">紐付き設定</h4>
                <p className="text-xs text-gray-400 mb-3">各設定ページでこのプリセットを指定すると、生成時に自動参照されます。</p>
                <div className="grid grid-cols-2 gap-2">
                  {SETTINGS_NAV.map(nav => (
                    <Link
                      key={nav.href}
                      href={nav.href}
                      className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2.5 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                    >
                      <span className="text-sm text-gray-700 group-hover:text-blue-700">{nav.label}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setModal(null)}
                className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
