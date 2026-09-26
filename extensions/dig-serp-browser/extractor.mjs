// This function is serialized by chrome.scripting; keep it self-contained.
export function readGoogleResults(expectedQuery) {
  const page = new URL(location.href)
  const normalize = value => (value || '').trim().replace(/\s+/g, ' ')
  if (!['www.google.co.jp', 'www.google.com'].includes(page.hostname) || page.pathname !== '/search') {
    return { error: 'Googleの検索画面を取得できません。認証や同意画面が表示されている場合は先に操作してください。' }
  }
  if (normalize(page.searchParams.get('q')) !== normalize(expectedQuery) || ['tbs', 'tbm', 'udm'].some(p => page.searchParams.has(p)) || Number(page.searchParams.get('start') || 0) !== 0) {
    return { error: '通常検索の1ページ目と検索語が一致しません。生成は開始していません。' }
  }
  const input = document.querySelector('[name="q"]')
  if (input && normalize(input.value) !== normalize(expectedQuery)) return { error: '検索語が変更されています。生成は開始していません。' }
  const region = document.querySelector('#rso')
  if (!region) return { pending: true }
  const results = [], seen = new Set()
  // Positive identification of ordinary web cards. Do not fall back to all links:
  // that includes advertisements, AI citations and private Search Console cards.
  for (const heading of region.querySelectorAll('.yuRUbf h3')) {
    if (!heading.getClientRects().length || getComputedStyle(heading).visibility === 'hidden') continue
    const anchor = heading.closest('a')
    if (!anchor || heading.closest('[data-text-ad], #tads, #bottomads, [aria-hidden="true"]')) continue
    let target
    try {
      target = new URL(anchor.href)
      if (['www.google.co.jp', 'www.google.com'].includes(target.hostname) && ['/url', '/goto'].includes(target.pathname)) {
        target = new URL(target.searchParams.get('url') || target.searchParams.get('q'))
      }
    } catch { continue }
    if (!['https:', 'http:'].includes(target.protocol) || /(^|\.)(google\.(com|co\.jp)|googleadservices\.com)$/.test(target.hostname)) continue
    const title = heading.textContent.trim()
    const canonical = target.hostname.replace(/^www\./, '') + target.pathname.replace(/\/$/, '') + target.search
    if (!title || seen.has(canonical)) continue
    seen.add(canonical)
    results.push({ position: results.length + 1, title, link: target.href, snippet: '' })
    if (results.length === 10) break
  }
  if (results.length < 3) return { pending: true }
  return { snapshot: {
    query: expectedQuery, observed_at: new Date().toISOString(),
    search_url: page.href, organic_results: results,
    people_also_ask: [], related_searches: [], capture_method: 'chrome_extension', collector_version: '1.0.0'
  } }
}
