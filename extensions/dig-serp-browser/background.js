import { readGoogleResults } from './extractor.mjs'
let busy = false
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function capture(query) {
  if (busy) throw new Error('別の検索結果を取得中です。完了後にもう一度お試しください。')
  if (typeof query !== 'string' || !query.trim() || query.length > 300) throw new Error('検索語は1〜300文字で入力してください。')
  busy = true
  let tab
  try {
    const url = new URL('https://www.google.co.jp/search')
    for (const [k, v] of Object.entries({ q: query, hl: 'ja', gl: 'jp', pws: '0' })) url.searchParams.set(k, v)
    tab = await chrome.tabs.create({ url: url.href, active: true })
    let previous = '', stable = 0
    for (let attempt = 0; attempt < 30; attempt++) {
      await wait(1000)
      const current = await chrome.tabs.get(tab.id)
      if (current.status !== 'complete') continue
      if (current.url && !/^https:\/\/www\.google\.(co\.jp|com)\/search\?/.test(current.url)) {
        throw new Error('Googleで認証・同意などの操作が必要です。開いた検索タブで確認してから、DIGでもう一度実行してください。')
      }
      const captured = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readGoogleResults, args: [query] })
      const value = captured[0]?.result
      if (value?.error) throw new Error(value.error)
      if (!value?.snapshot) continue
      const fingerprint = JSON.stringify(value.snapshot.organic_results)
      stable = fingerprint === previous ? stable + 1 : 0
      previous = fingerprint
      if (stable >= 1) {
        await chrome.tabs.remove(tab.id)
        return { snapshot: value.snapshot }
      }
    }
    throw new Error('自然検索結果を確認できませんでした。開いたGoogle画面を確認してください。API結果への置き換えは行っていません。')
  } finally { busy = false }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let origin
  try { origin = new URL(sender.url).origin } catch { return false }
  if (!['https://app.deepintentgraph.com', 'http://localhost:3000'].includes(origin) || sender.frameId !== 0) return false
  if (message.action === 'ping') { sendResponse({ version: '1.0.0' }); return false }
  if (message.action !== 'capture') return false
  capture(message.query).then(sendResponse, error => sendResponse({ error: error.message || '検索画面の取得に失敗しました。' }))
  return true
})
