'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import MainLayout from '@/app/_components/v2/MainLayout'

const EMPTY_FORM = { name: '', category: '', recommend_level: 3, affiliate_url: '', notes: '', preset_id: '', must_include: '', must_exclude: '' }

const LEVEL_LABELS = {
  5: '5：最強おすすめ（比較表1位・強い推薦文・CTA誘導）',
  4: '4：おすすめ（比較表上位・推薦文あり）',
  3: '3：条件付きおすすめ（〜な人向けとして紹介）',
  2: '2：消極的紹介（特定ニーズがある人のみ）',
  1: '1：比較用掲載（名前のみ・他社を引き立てる用途）',
  0: '0：掲載しない',
}

function StarDisplay({ level }) {
  if (level === 0) return <span className="text-xs text-gray-400">掲載しない</span>
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= level ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

export default function CompaniesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [theme, setTheme] = useState(null)
  const [companies, setCompanies] = useState([])
  const [presets, setPresets] = useState([])
  const [categorySettings, setCategorySettings] = useState({}) // { [category]: 'registered_only'|'ai' }
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

  async function fetchCompanies() {
    const { data } = await getSupabase()
      .from('company_settings')
      .select('*')
      .order('recommend_level', { ascending: false })
    setCompanies(data ?? [])
    setLoading(false)
  }

  async function fetchCategorySettings() {
    const { data } = await getSupabase()
      .from('category_settings')
      .select('category, company_restriction')
    if (data) {
      const map = {}
      data.forEach(row => { map[row.category] = row.company_restriction })
      setCategorySettings(map)
    }
  }

  async function fetchPresets() {
    const { data } = await getSupabase().from('presets').select('id, name').order('name')
    if (data) setPresets(data)
  }

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      fetchProfile(session.user.id)
      fetchTheme(session.user.id)
      Promise.all([fetchCompanies(), fetchCategorySettings(), fetchPresets()])
    })
  }, [fetchProfile, fetchTheme])

  async function handleCategoryRestriction(category, value) {
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('category_settings').upsert(
      { tenant_id: user.id, category, company_restriction: value },
      { onConflict: 'tenant_id,category' }
    )
    setCategorySettings(prev => ({ ...prev, [category]: value }))
  }

  function openAdd() {
    setModal({ mode: 'add', form: { ...EMPTY_FORM } })
    setError('')
  }

  function openEdit(company) {
    setModal({
      mode: 'edit',
      form: {
        id: company.id,
        name: company.name ?? '',
        category: company.category ?? '',
        recommend_level: company.recommend_level ?? 3,
        affiliate_url: company.affiliate_url ?? '',
        notes: company.notes ?? '',
        preset_id: company.preset_id ?? '',
        must_include: company.must_include ?? '',
        must_exclude: company.must_exclude ?? '',
      },
    })
    setError('')
  }

  async function handleDelete(id) {
    if (!confirm('この企業設定を削除しますか？')) return
    await getSupabase().from('company_settings').delete().eq('id', id)
    fetchCompanies()
  }

  async function handleSave() {
    if (!modal) return
    const { mode, form } = modal
    if (!form.name.trim()) { setError('会社名は必須です'); return }
    setSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      recommend_level: Number(form.recommend_level),
      affiliate_url: form.affiliate_url.trim(),
      notes: form.notes.trim(),
      preset_id: form.preset_id || null,
      must_include: form.must_include.trim() || null,
      must_exclude: form.must_exclude.trim() || null,
    }
    if (mode === 'add') {
      await supabase.from('company_settings').insert({ ...payload, tenant_id: user.id })
    } else {
      await supabase.from('company_settings').update(payload).eq('id', form.id)
    }
    setSaving(false)
    setModal(null)
    fetchCompanies()
  }

  function updateForm(key, value) {
    setModal(m => ({ ...m, form: { ...m.form, [key]: value } }))
  }

  // 登録済みカテゴリ（重複排除・空除外）
  const categories = [...new Set(companies.map(c => c.category).filter(Boolean))]

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="max-w-4xl mx-auto px-8 py-8 flex flex-col gap-6">

        {/* カテゴリ別設定 */}
        {!loading && categories.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">カテゴリ別設定</h2>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {categories.map(cat => {
                  const current = categorySettings[cat] ?? 'ai'
                  return (
                    <tr key={cat} className="px-6">
                      <td className="px-6 py-4 font-medium text-gray-700 w-40">{cat}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`restriction-${cat}`}
                              value="registered_only"
                              checked={current === 'registered_only'}
                              onChange={() => handleCategoryRestriction(cat, 'registered_only')}
                              className="accent-blue-600"
                            />
                            登録企業のみ
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`restriction-${cat}`}
                              value="ai"
                              checked={current === 'ai'}
                              onChange={() => handleCategoryRestriction(cat, 'ai')}
                              className="accent-blue-600"
                            />
                            AIに任せる
                          </label>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* 企業一覧 */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">企業管理</h2>
            <button
              onClick={openAdd}
              className="btn-gradient text-sm px-4 py-2 rounded-lg transition-colors"
            >
              ＋ 企業を追加
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : companies.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
              登録済み企業がありません
            </div>
          ) : (
            <div className="grid gap-4">
              {companies.map(company => (
                <div key={company.id} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-800">{company.name}</span>
                        {company.category && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{company.category}</span>
                        )}
                        <StarDisplay level={company.recommend_level} />
                      </div>
                      {company.affiliate_url && (
                        <p className="text-xs text-blue-600 truncate mb-1">{company.affiliate_url}</p>
                      )}
                      {company.notes && (
                        <p className="text-sm text-gray-500 line-clamp-2">{company.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(company)}
                        className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(company.id)}
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
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                {modal.mode === 'add' ? '企業を追加' : '企業を編集'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">適用プリセット</label>
                <div className="flex gap-2">
                  <select
                    value={modal.form.preset_id}
                    onChange={e => updateForm('preset_id', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">指定なし</option>
                    {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Link href="/settings/presets" className="flex items-center gap-1 border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs px-3 py-2 rounded-lg transition-colors whitespace-nowrap">
                    ＋ 新規作成
                  </Link>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">会社名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={modal.form.name}
                  onChange={e => updateForm('name', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                <input
                  type="text"
                  value={modal.form.category}
                  onChange={e => updateForm('category', e.target.value)}
                  placeholder="転職エージェント、クレジットカード など"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">おすすめレベル</label>
                <select
                  value={modal.form.recommend_level}
                  onChange={e => updateForm('recommend_level', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[5, 4, 3, 2, 1, 0].map(level => (
                    <option key={level} value={level}>{LEVEL_LABELS[level]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">アフィリエイトURL（任意）</label>
                <input
                  type="url"
                  value={modal.form.affiliate_url}
                  onChange={e => updateForm('affiliate_url', e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">notes（任意）</label>
                <textarea
                  value={modal.form.notes}
                  onChange={e => updateForm('notes', e.target.value)}
                  rows={2}
                  placeholder="40代以上に特化している点を強調する&#10;スカウト機能が強みなのでそこを推す"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">絶対入れる表現</label>
                <textarea
                  value={modal.form.must_include}
                  onChange={e => updateForm('must_include', e.target.value)}
                  rows={2}
                  placeholder="例：「業界最安値」「無料相談」など必ず記載する表現"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">絶対入れない表現</label>
                <textarea
                  value={modal.form.must_exclude}
                  onChange={e => updateForm('must_exclude', e.target.value)}
                  rows={2}
                  placeholder="例：「手数料が高い」「評判が悪い」など記載を避ける表現"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-4 py-2 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-gradient text-sm px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
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
