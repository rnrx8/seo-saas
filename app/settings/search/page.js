'use client'

import { useState, useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import Link from 'next/link'
import MainLayout from '@/app/_components/v2/MainLayout'
import { checkBrowserConnection, captureBrowserSerp } from '@/app/_lib/browser-serp'

export default function SearchSettings() {
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    let active = true
    getSupabase().auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data } = await getSupabase().from('user_profiles').select('*').eq('id', session.user.id).single()
      if (active && data) setProfile({ ...data, email: session.user.email })
    })
    return () => { active = false }
  }, [])
  const [query, setQuery] = useState('既婚者クラブ ヒールメイト')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [snapshot, setSnapshot] = useState(null)
  async function test(capture) {
    setBusy(true); setMessage(''); setSnapshot(null)
    try {
      if (capture) { setSnapshot(await captureBrowserSerp(query.trim())); setMessage('Google検索画面から取得できました。記事の作成やクレジット消費はしていません。') }
      else { await checkBrowserConnection(); setMessage('Chromeとの接続を確認しました。') }
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  return <MainLayout profile={profile}><div className="max-w-3xl mx-auto p-6 space-y-6">
    <Link href="/dashboard" className="text-blue-700 text-sm">← ダッシュボード</Link>
    <h1 className="text-2xl font-bold">検索結果の取得設定</h1>
    <p className="text-gray-700">記事生成時に、このChromeでGoogle検索を開き、表示された自然検索結果を使います。取得できなかった場合は生成を開始しません。</p>
    <section className="border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold">初回の接続</h2>
      <p className="text-sm text-gray-600">専用のChrome拡張機能を一度だけ追加してください。取得対象は、生成時に開くGoogle検索画面です。</p>
      <ol className="list-decimal ml-5 space-y-2 text-sm">
        <li><a href="/downloads/dig-serp-browser.zip" className="text-blue-700 underline" download>取得機能をダウンロード</a>し、ZIPを展開します。</li>
        <li>Chromeの拡張機能画面（chrome://extensions）でデベロッパーモードを有効にします。</li>
        <li>「パッケージ化されていない拡張機能を読み込む」で展開したフォルダを選び、このページを再読み込みします。</li>
      </ol>
      <button onClick={() => test(false)} disabled={busy} className="rounded-lg bg-blue-700 text-white px-4 py-2 disabled:opacity-50">接続を確認</button>
    </section>
    <section className="border rounded-xl p-5 space-y-3">
      <h2 className="font-semibold">検索結果をテスト</h2>
      <label className="block text-sm" htmlFor="search-test-query">検索キーワード</label>
      <input id="search-test-query" value={query} onChange={e => setQuery(e.target.value)} className="w-full border rounded-lg p-3" disabled={busy} />
      <button onClick={() => test(true)} disabled={busy || !query.trim()} className="rounded-lg bg-blue-700 text-white px-4 py-2 disabled:opacity-50">{busy ? '確認中…' : 'Google検索画面から取得'}</button>
      {message && <p role="status" className="text-sm text-gray-700">{message}</p>}
      {snapshot && <div className="space-y-3"><p className="text-sm">{snapshot.organic_results.length}件取得・{new Date(snapshot.observed_at).toLocaleString('ja-JP')} <a className="text-blue-700 underline" href={snapshot.search_url} target="_blank" rel="noreferrer">検索画面を開く</a></p><ol className="list-decimal ml-5 space-y-3">{snapshot.organic_results.map(r => <li key={r.link}><a className="text-blue-700" href={r.link} target="_blank" rel="noreferrer">{r.title}</a><p className="text-xs text-gray-500 break-all">{r.link}</p></li>)}</ol></div>}
    </section>
  </div></MainLayout>
}
