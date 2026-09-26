import { getSupabase } from '@/lib/supabase'

const pendingSnapshots = new Map()

function browserRequest(action, query, timeoutMs) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    const timer = setTimeout(() => finish(new Error(action === 'ping'
      ? 'Google検索画面の取得機能が未接続です。「検索結果の取得設定」から接続してください。'
      : '検索結果の取得が時間切れになりました。Googleのタブを確認して再実行してください。')), timeoutMs)
    function finish(error, value) {
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      error ? reject(error) : resolve(value)
    }
    function onMessage(event) {
      if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'dig-serp-response' || event.data.id !== id) return
      finish(event.data.error ? new Error(event.data.error) : null, event.data)
    }
    window.addEventListener('message', onMessage)
    window.postMessage({ channel: 'dig-serp-request', id, action, query }, location.origin)
  })
}

export const checkBrowserConnection = () => browserRequest('ping', null, 2000)

export async function captureBrowserSerp(query) {
  await checkBrowserConnection()
  const { snapshot } = await browserRequest('capture', query, 45000)
  if (snapshot?.query !== query || !Array.isArray(snapshot.organic_results) || snapshot.organic_results.length < 3) {
    throw new Error('検索画面の結果を確認できませんでした。記事は作成していません。')
  }
  return snapshot
}

// Capture before inserting a queued job: the watchdog must never start a job
// while its browser acquisition is still waiting on a CAPTCHA or user setup.
export async function createBrowserJob(supabase, params) {
  try {
    const snapshot = await captureBrowserSerp(params.main_keyword)
    const result = await supabase.from('jobs').insert(params).select().single()
    if (result.data) pendingSnapshots.set(result.data.id, snapshot)
    return result
  } catch (error) { return { data: null, error } }
}

export async function startBrowserGeneration(job, { refresh = false } = {}) {
  if (refresh) pendingSnapshots.set(job.id, await captureBrowserSerp(job.main_keyword))
  const snapshot = pendingSnapshots.get(job.id)
  if (!snapshot) throw new Error('検索画面をもう一度取得してから実行してください。')
  const supabase = getSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('ログインし直してください。')
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ job_id: job.id, keyword: job.main_keyword, browser_serp: snapshot }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(typeof body.detail === 'string' ? body.detail : body.error || '生成を開始できませんでした。')
    error.status = response.status
    if (response.status >= 400 && response.status < 500) {
      await supabase.from('jobs').update({ status: 'failed', error_message: error.message }).eq('id', job.id).eq('status', 'queued')
    }
    throw error
  }
  return body
}
