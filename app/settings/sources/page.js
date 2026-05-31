'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv,.docx,.txt'

function fileTypeLabel(fileType) {
  const map = { pdf: 'PDF', excel: 'Excel', csv: 'CSV', docx: 'Word', text: 'テキスト' }
  return map[fileType] ?? fileType ?? '—'
}

function fileTypeBadgeColor(fileType) {
  const map = {
    pdf: 'bg-red-100 text-red-700',
    excel: 'bg-green-100 text-green-700',
    csv: 'bg-teal-100 text-teal-700',
    docx: 'bg-blue-100 text-blue-700',
    text: 'bg-gray-100 text-gray-600',
  }
  return map[fileType] ?? 'bg-gray-100 text-gray-600'
}

function guessFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (['xlsx', 'xls'].includes(ext)) return 'excel'
  if (ext === 'csv') return 'csv'
  if (ext === 'docx') return 'docx'
  return 'text'
}

export default function SourcesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [theme, setTheme] = useState(null)
  const [sources, setSources] = useState([])
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | { form: {...}, editId?: string }
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
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

  async function fetchSources() {
    const { data } = await getSupabase()
      .from('primary_sources')
      .select('*')
      .order('created_at', { ascending: false })
    setSources(data ?? [])
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
      fetchSources()
      fetchPresets()
    })
  }, [fetchProfile, fetchTheme])

  function openAdd() {
    setModal({ form: { title: '', category: '', file_path: '', file_name: '', file_type: '', content_text: '', preset_id: '' } })
    setError('')
  }

  function openEdit(src) {
    setModal({
      editId: src.id,
      form: {
        title: src.title ?? '',
        category: src.category ?? '',
        file_path: src.file_path ?? '',
        file_name: src.file_path?.split('/').pop() ?? '',
        file_type: src.file_type ?? '',
        content_text: src.content_text ?? '',
        preset_id: src.preset_id ?? '',
      },
    })
    setError('')
  }

  async function handleDelete(id) {
    if (!confirm('この資料を削除しますか？')) return
    await getSupabase().from('primary_sources').delete().eq('id', id)
    fetchSources()
  }

  async function handleFileUpload(file) {
    if (!file) return
    setUploading(true)
    setError('')
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const safeName = sanitizeFilename(file.name)
    const path = `${user.id}/sources/${safeName}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
    if (upErr) { setError('アップロードに失敗しました: ' + upErr.message); setUploading(false); return }
    const fileType = guessFileType(file.name)
    setModal(m => ({
      ...m,
      form: { ...m.form, file_path: path, file_name: file.name, file_type: fileType, content_text: '' },
    }))
    setUploading(false)
  }

  async function handleExtractText() {
    if (!modal?.form.file_path) return
    setExtracting(true)
    setError('')
    try {
      const res = await fetch('/api/extract-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: modal.form.file_path }),
      })
      const data = await res.json()
      if (data.text) {
        setModal(m => ({ ...m, form: { ...m.form, content_text: data.text } }))
      } else {
        setError(data.error ?? 'テキスト抽出に失敗しました')
      }
    } catch {
      setError('通信エラーが発生しました')
    }
    setExtracting(false)
  }

  async function handleSave() {
    if (!modal) return
    const { form, editId } = modal
    if (!form.title.trim()) { setError('タイトルは必須です'); return }
    if (!editId && !form.file_path) { setError('ファイルをアップロードしてください'); return }
    setSaving(true)
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (editId) {
      await supabase.from('primary_sources').update({
        title: form.title.trim(),
        category: form.category.trim(),
        content_text: form.content_text,
        preset_id: form.preset_id || null,
      }).eq('id', editId).eq('tenant_id', user.id)
    } else {
      await supabase.from('primary_sources').insert({
        tenant_id: user.id,
        title: form.title.trim(),
        category: form.category.trim(),
        file_path: form.file_path,
        file_type: form.file_type,
        content_text: form.content_text,
        preset_id: form.preset_id || null,
      })
    }
    setSaving(false)
    setModal(null)
    fetchSources()
  }

  function updateForm(key, value) {
    setModal(m => ({ ...m, form: { ...m.form, [key]: value } }))
  }

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-600">一次情報管理</h2>
          <button
            onClick={openAdd}
            className="btn-gradient text-sm px-4 py-2 rounded-lg transition-colors"
          >
            ＋ 資料を追加
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sources.length === 0 ? (
          <div className="glass-panel rounded-xl p-12 text-center text-gray-400 text-sm">
            登録済み資料がありません
          </div>
        ) : (
          <div className="grid gap-4">
            {sources.map(src => (
              <div key={src.id} className="glass-panel rounded-xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-600">{src.title}</span>
                      {src.category && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{src.category}</span>
                      )}
                      {src.file_type && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fileTypeBadgeColor(src.file_type)}`}>
                          {fileTypeLabel(src.file_type)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-gray-400">
                        {new Date(src.created_at).toLocaleDateString('ja-JP')}
                      </p>
                      {src.preset_id && (
                        <p className="text-xs text-blue-600">
                          プリセット: {presets.find(p => p.id === src.preset_id)?.name ?? '—'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(src)}
                      className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(src.id)}
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
              <h3 className="font-semibold text-gray-600">{modal.editId ? '資料を編集' : '資料を追加'}</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">適用プリセット</label>
                <div className="flex gap-2">
                  <select
                    value={modal.form.preset_id}
                    onChange={e => setModal(m => ({ ...m, form: { ...m.form, preset_id: e.target.value } }))}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル（管理用）<span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={modal.form.title}
                  onChange={e => updateForm('title', e.target.value)}
                  placeholder="2024年転職市場レポート など"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                <input
                  type="text"
                  value={modal.form.category}
                  onChange={e => updateForm('category', e.target.value)}
                  placeholder="転職、クレジットカード など"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ファイル{!modal.editId && <span className="text-red-500"> *</span>}</label>
                {modal.editId ? (
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fileTypeBadgeColor(modal.form.file_type)}`}>
                      {fileTypeLabel(modal.form.file_type)}
                    </span>
                    <span className="text-sm text-gray-500 flex-1 truncate">{modal.form.file_name}</span>
                  </div>
                ) : modal.form.file_name ? (
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fileTypeBadgeColor(modal.form.file_type)}`}>
                      {fileTypeLabel(modal.form.file_type)}
                    </span>
                    <span className="text-sm text-gray-700 flex-1 truncate">{modal.form.file_name}</span>
                    <button
                      type="button"
                      onClick={() => setModal(m => ({ ...m, form: { ...m.form, file_path: '', file_name: '', file_type: '', content_text: '' } }))}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      削除
                    </button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-lg px-3 py-6 cursor-pointer hover:border-blue-400 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <span className="text-sm text-gray-500">{uploading ? 'アップロード中...' : 'クリックしてファイルを選択'}</span>
                    <span className="text-xs text-gray-400">PDF・Excel・CSV・Word・テキスト対応</span>
                    <input
                      type="file"
                      accept={ACCEPTED_TYPES}
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                  </label>
                )}
              </div>

              {modal.form.file_path && (
                <button
                  onClick={handleExtractText}
                  disabled={extracting}
                  className="w-full border border-blue-500 text-blue-600 hover:bg-blue-50 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {extracting ? 'テキスト抽出中...' : '📄 テキストを抽出'}
                </button>
              )}

              {modal.form.content_text && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">抽出結果プレビュー</label>
                  <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {modal.form.content_text.slice(0, 500)}
                    {modal.form.content_text.length > 500 && '…'}
                  </div>
                </div>
              )}
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
