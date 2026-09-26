// Only the exact DIG origin (or its local development server) can request a capture.
window.addEventListener('message', async event => {
  if (event.source !== window || event.origin !== location.origin) return
  const m = event.data
  if (m?.channel !== 'dig-serp-request' || typeof m.id !== 'string' || m.id.length > 100) return
  if (!['ping', 'capture'].includes(m.action)) return
  let response
  try { response = await chrome.runtime.sendMessage({ action: m.action, query: m.query }) }
  catch { response = { error: '取得機能を再読み込みしてください。Chromeの拡張機能とDIGのページを更新して再試行できます。' } }
  window.postMessage({ channel: 'dig-serp-response', id: m.id, ...response }, location.origin)
})
