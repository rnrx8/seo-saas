import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHTML } from 'linkedom'
import { readGoogleResults } from '../extensions/dig-serp-browser/extractor.mjs'

function page(extra = '', params = '') {
  const card = (url, title) => `<div class="yuRUbf"><a href="${url}"><h3>${title}</h3></a></div>`
  const { document } = parseHTML(`<html><body><input name="q" value="比較 検索"><div id="tads">${card('https://ad.jp/', '広告')}</div><div id="rso"><section><h2>AI による概要</h2><a href="https://ai.jp/"><h3>AI引用</h3></a></section>${card('https://one.jp/', '1位')}${extra}${card('https://two.jp/', '2位')}${card('https://three.jp/', '3位')}<section>自分にのみ表示<a href="https://search.google.com/search-console/"><h3>個人のデータ</h3></a></section></div></body></html>`)
  for (const element of document.querySelectorAll('h3')) element.getClientRects = () => element.closest('[hidden]') ? [] : [{}]
  globalThis.document = document
  globalThis.location = { href: 'https://www.google.co.jp/search?q=' + encodeURIComponent('比較 検索') + params }
  globalThis.getComputedStyle = () => ({ visibility: 'visible' })
  return document
}

test('only ordinary visible web cards are used, in their original order', () => {
  page('<div hidden class="yuRUbf"><a href="https://hidden.jp/"><h3>非表示</h3></a></div><div data-text-ad class="yuRUbf"><a href="https://ad2.jp/"><h3>広告</h3></a></div>')
  const { snapshot } = readGoogleResults('比較 検索')
  assert.deepEqual(snapshot.organic_results.map(r => [r.position, r.title, r.link]), [[1,'1位','https://one.jp/'],[2,'2位','https://two.jp/'],[3,'3位','https://three.jp/']])
})
test('duplicate sitelinks do not create extra ranks', () => {
  page('<div class="yuRUbf"><a href="https://one.jp/"><h3>重複</h3></a></div>')
  assert.equal(readGoogleResults('比較 検索').snapshot.organic_results.length, 3)
})
test('wrong query, page two and non-standard modes fail closed', () => {
  for (const params of ['&start=10', '&tbs=li:1', '&udm=2']) { page('', params); assert.ok(readGoogleResults('比較 検索').error) }
  page(); assert.ok(readGoogleResults('別の検索').error)
})
test('changed Google markup never falls back to AI links or ads', () => {
  const document = page()
  for (const card of document.querySelectorAll('.yuRUbf')) card.remove()
  assert.deepEqual(readGoogleResults('比較 検索'), { pending: true })
})
