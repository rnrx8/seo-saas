'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import MainLayout from '@/app/_components/v2/MainLayout'

const EMPTY_FORM = { name: '', category: '', body: '', button_text: '', url: '', preset_id: '' }

export default function CtasPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [theme, setTheme] = useState(null)
  const [ctas, setCtas] = useState([])
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

  async function fetchCtas() {
    const { data } = await getSupabase().from('cta_blocks').select('*').order('created_at', { ascending: false })
    setCtas(data ?? [])
    setLoading(false)
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
      fetchCtas()
      fetchPresets()
    })
  }, [fetchProfile, fetchTheme])

  function openAdd() {
    setModal({ mode: 'add', form: { ...EMPTY_FORM } })
    setError('')
  }

  function openEdit(cta) {
    setModal({
      mode: 'edit',
      form: {
        id: cta.id,
        name: cta.name ?? '',
        category: cta.category ?? '',
        body: cta.body ?? '',
        button_text: cta.button_text ?? '',
        url: cta.url ?? '',
        preset_id: cta.preset_id ?? '',
      },
    })
    setError('')
  }

  async function handleDelete(id) {
    if (!confirm('このCTAを削除しますか？')) return
    await getSupabase().from('cta_blocks').delete().eq('id', id)
    fetchCtas()
  }

  async function handleSave() {
    if (!modal) return
    const { mode, form } = modal
    if (!form.name.trim()) { setError('名前は必須です'); return }
    setSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      body: form.body.trim(),
      button_text: form.button_text.trim(),
      url: form.url.trim(),
      preset_id: form.preset_id || null,
    }
    if (mode === 'add') {
      await supabase.from('cta_blocks').insert({ ...payload, tenant_id: user.id })
    } else {
      await supabase.from('cta_blocks').update(payload).eq('id', form.id)
    }
    setSaving(false)
    setModal(null)
    fetchCtas()
  }

  function updateForm(key, value) {
    setModal(m => ({ ...m, form: { ...m.form, [key]: value } }))
  }

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">CTA管理</h2>
          <button
            onClick={openAdd}
            className="btn-gradient text-sm px-4 py-2 rounded-lg transition-colors"
          >
            ＋ CTAを追加
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ctas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
            登録済みCTAがありません
          </div>
        ) : (
          <div className="grid gap-4">
            {ctas.map(cta => (
              <div key={cta.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800">{cta.name}</span>
                      {cta.category && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{cta.category}</span>
                      )}
                    </div>
                    {cta.body && <p className="text-sm text-gray-600 mb-1 line-clamp-2">{cta.body}</p>}
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      {cta.button_text && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{cta.button_text}</span>}
                      {cta.url && <span className="text-xs text-blue-600 truncate max-w-xs">{cta.url}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(cta)}
                      className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(cta.id)}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">
                {modal.mode === 'add' ? 'CTAを追加' : 'CTAを編集'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">名前（管理用）<span className="text-red-500">*</span></label>
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">誘導文</label>
                <textarea
                  value={modal.form.body}
                  onChange={e => updateForm('body', e.target.value)}
                  rows={3}
                  placeholder="無料で試してみませんか？"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ボタンテキスト</label>
                <input
                  type="text"
                  value={modal.form.button_text}
                  onChange={e => updateForm('button_text', e.target.value)}
                  placeholder="無料で始める"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">遷移先URL</label>
                <input
                  type="url"
                  value={modal.form.url}
                  onChange={e => updateForm('url', e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
