'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import MainLayout from '@/app/_components/v2/MainLayout'

export default function LearnedRulesPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [theme, setTheme] = useState(null)
  const [rules, setRules] = useState([])
  const [learningEnabled, setLearningEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [editText, setEditText] = useState('')

  const fetchProfile = useCallback(async (userId, email = '') => {
    const { data } = await getSupabase().from('user_profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile({ ...data, email })
      setLearningEnabled(data.learning_enabled !== false)
    }
  }, [])

  const fetchTheme = useCallback(async (userId) => {
    const { data } = await getSupabase().from('tenant_themes').select('*').eq('tenant_id', userId).maybeSingle()
    if (data) setTheme(data)
  }, [])

  async function fetchRules() {
    const { data } = await getSupabase()
      .from('learned_style_rules')
      .select('*')
      .order('created_at', { ascending: false })
    setRules(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      fetchProfile(session.user.id, session.user.email)
      fetchTheme(session.user.id)
      fetchRules()
    })
  }, [fetchProfile, fetchTheme])

  async function toggleLearning() {
    const next = !learningEnabled
    setLearningEnabled(next)
    const { data: { user } } = await getSupabase().auth.getUser()
    await getSupabase().from('user_profiles').update({ learning_enabled: next }).eq('id', user.id)
  }

  async function toggleStatus(rule) {
    const next = rule.status === 'active' ? 'disabled' : 'active'
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: next } : r))
    await getSupabase().from('learned_style_rules').update({ status: next }).eq('id', rule.id)
  }

  function startEdit(rule) {
    setEditId(rule.id)
    setEditText(rule.rule_text)
  }

  async function saveEdit() {
    const text = editText.trim()
    if (!text) return
    setRules(prev => prev.map(r => r.id === editId ? { ...r, rule_text: text } : r))
    await getSupabase().from('learned_style_rules').update({ rule_text: text }).eq('id', editId)
    setEditId(null)
    setEditText('')
  }

  async function handleDelete(id) {
    if (!confirm('この学習ルールを削除しますか？')) return
    await getSupabase().from('learned_style_rules').delete().eq('id', id)
    fetchRules()
  }

  return (
    <MainLayout profile={profile} theme={theme}>
      <div className="max-w-4xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-gray-600">学習ルール</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          記事の校正モードで保存した修正から学習した執筆ルールです。有効なルールは次回以降の記事生成に反映されます。
        </p>

        {/* 学習オンオフ */}
        <div className="glass-panel rounded-xl p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">校正からの学習</p>
            <p className="text-xs text-gray-500 mt-0.5">オフにすると、校正保存時にルールの抽出・保存を行いません。</p>
          </div>
          <button
            onClick={toggleLearning}
            className={`relative w-12 h-6 rounded-full transition-colors ${learningEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            aria-pressed={learningEnabled}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${learningEnabled ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="glass-panel rounded-xl p-12 text-center text-gray-400 text-sm">
            学習したルールはまだありません。記事の校正モードで修正を保存すると追加されます。
          </div>
        ) : (
          <div className="grid gap-3">
            {rules.map(rule => (
              <div key={rule.id} className={`glass-panel rounded-xl p-5 ${rule.status !== 'active' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {editId === rule.id ? (
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    ) : (
                      <p className="text-sm text-gray-700 leading-relaxed">{rule.rule_text}</p>
                    )}
                    {editId !== rule.id && (rule.before_example || rule.after_example) && (
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        {rule.before_example && <>例：<span className="line-through">{rule.before_example}</span> → </>}
                        {rule.after_example}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${rule.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {rule.status === 'active' ? '有効' : '無効'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(rule.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {editId === rule.id ? (
                      <>
                        <button
                          onClick={saveEdit}
                          className="btn-gradient text-sm px-3 py-1.5 rounded-lg transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => { setEditId(null); setEditText('') }}
                          className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleStatus(rule)}
                          className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {rule.status === 'active' ? '無効化' : '有効化'}
                        </button>
                        <button
                          onClick={() => startEdit(rule)}
                          className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="border border-red-200 text-red-600 hover:bg-red-50 text-sm px-3 py-1.5 rounded-lg transition-colors"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
