'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import MainLayout from '@/app/_components/v2/MainLayout'

function sanitizeFilename(filename) {
  const ext = filename.split('.').pop()
  const safe = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .substring(0, 50)
  return `${Date.now()}_${safe}.${ext}`
}

const EMPTY_FORM = { name: '', category: '', url: '', raw_content: '', selling_points_text: '', file_path: '', file_name: '' }

const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv,.docx,.txt'

export default function ServicesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [theme, setTheme] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { mode: 'add'|'edit', form: {...} }
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const fetchProfile = useCallback(async (userId) => {
    const { data } = await getSupabase().from('user_profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }, [])

  const fetchTheme = useCallback(async (userId) => {
    const { data } = await getSupabase().from('tenant_themes').select('*').eq('tenant_id', userId).maybeSingle()
    if (data) setTheme(data)
  }, [])

  async function fetchServices() {
    const { data } = await getSupabase().from('services').select('*').order('created_at', { ascending: false })
    setServices(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      fetchProfile(session.user.id)
      fetchTheme(session.user.id)
      fetchServices()
    })
  }, [fetchProfile, fetchTheme])

  function openAdd() {
    setModal({ mode: 'add', form: { ...EMPTY_FORM } })
    setError('')
  }

  function openEdit(svc) {
    setModal({
      mode: 'edit',
      form: {
        id: svc.id,
        name: svc.name ?? '',
        category: svc.category ?? '',
        url: svc.url ?? '',
        raw_content: svc.raw_content ?? '',
        selling_points_text: (svc.selling_points ?? []).join('\n'),
        file_path: svc.file_path ?? '',
        file_name: svc.file_path ? svc.file_path.split('/').pop().replace(/^\d+_/, '') : '',
      },
    })
    setError('')
  }

  async function handleDelete(id) {
    if (!confirm('このサービスを削除しますか？')) return
    await getSupabase().from('services').delete().eq('id', id)
    fetchServices()
  }

  async function handleFileUpload(file) {
    if (!file) return
    setUploading(true)
    setError('')
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const safeName = sanitizeFilename(file.name)
    const path = `${user.id}/${safeName}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
    if (upErr) { setError('アップロードに失敗しました: ' + upErr.message); setUploading(false); return }
    updateForm('file_path', path)
    updateForm('file_name', file.name)
    setUploading(false)
  }

  async function handleExtract() {
    if (!modal) return
    const { file_path, url, raw_content } = modal.form
    if (!file_path && !url && !raw_content) return
    setExtracting(true)
    setError('')
    try {
      const body = file_path ? { file_path } : url ? { url, text: raw_content } : { text: raw_content }
      const res = await fetch('/api/extract-selling-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.selling_points) {
        setModal(m => ({ ...m, form: { ...m.form, selling_points_text: data.selling_points.join('\n') } }))
      } else {
        setError(data.error ?? '抽出に失敗しました')
      }
    } catch {
      setError('通信エラーが発生しました')
    }
    setExtracting(false)
  }

  async function handleSave() {
    if (!modal) return
    const { mode, form } = modal
    if (!form.name.trim()) { setError('サービス名は必須です'); return }
    setSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const selling_points = form.selling_points_text.split('\n').map(s => s.trim()).filter(Boolean)
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      url: form.url.trim(),
      raw_content: form.raw_content.trim(),
      selling_points,
      file_path: form.file_path || null,
    }
    if (mode === 'add') {
      await supabase.from('services').insert({ ...payload, tenant_id: user.id })
    } else {
      await supabase.from('services').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', form.id)
    }
    setSaving(false)
    setModal(null)
    fetchServices()
  }

  function updateForm(key, value) {
    setModal(m => ({ ...m, form: { ...m.form, [key]: value } }))
  }

  const canExtract = modal && (modal.form.file_path || modal.form.url.trim() || modal.form.raw_content.trim())

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800">サービス管理</h2>
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            ＋ サービスを追加
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
            登録済みサービスがありません
          </div>
        ) : (
          <div className="grid gap-4">
            {services.map(svc => (
              <div key={svc.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800">{svc.name}</span>
                      {svc.category && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{svc.category}</span>
                      )}
                    </div>
                    {svc.url && <p className="text-xs text-blue-600 truncate mb-2">{svc.url}</p>}
                    <p className="text-sm text-gray-500">
                      セールスポイント：{(svc.selling_points ?? []).length}件
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(svc)}
                      className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(svc.id)}
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
                {modal.mode === 'add' ? 'サービスを追加' : 'サービスを編集'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">サービス名 <span className="text-red-500">*</span></label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">URL（任意）</label>
                <input
                  type="url"
                  value={modal.form.url}
                  onChange={e => updateForm('url', e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ファイルアップロード（任意）</label>
                {modal.form.file_name ? (
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                    <span className="text-sm text-gray-700 flex-1 truncate">{modal.form.file_name}</span>
                    <button
                      type="button"
                      onClick={() => { updateForm('file_path', ''); updateForm('file_name', '') }}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      削除
                    </button>
                  </div>
                ) : (
                  <label className={`flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-4 cursor-pointer hover:border-blue-400 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <span className="text-sm text-gray-500">{uploading ? 'アップロード中...' : 'PDF・Excel・CSV・Word・テキストを選択'}</span>
                    <input
                      type="file"
                      accept={ACCEPTED_TYPES}
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">資料テキスト（任意）</label>
                <textarea
                  value={modal.form.raw_content}
                  onChange={e => updateForm('raw_content', e.target.value)}
                  rows={4}
                  placeholder="サービスの説明・特徴などを貼り付け..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {canExtract && (
                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="w-full border border-blue-500 text-blue-600 hover:bg-blue-50 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {extracting ? '抽出中...' : '✨ セールスポイントを自動抽出'}
                </button>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  セールスポイント（1行1項目）
                </label>
                <textarea
                  value={modal.form.selling_points_text}
                  onChange={e => updateForm('selling_points_text', e.target.value)}
                  rows={6}
                  placeholder="・低コストで導入可能&#10;・サポート体制が充実&#10;..."
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
