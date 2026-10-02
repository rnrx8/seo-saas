import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkBreakTags } from '../lib/remark-break-tags.mjs'
const render = value => renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkBreakTags] }, value))

test('generated table line breaks render as breaks without literal tags', () => {
  const html=render('| 条件 |\n|---|\n| 男性<br>有料<br />女性<BR/>無料 |')
  assert.equal((html.match(/<br\/>/g) || []).length, 3)
  assert.ok(!html.includes('&lt;br'))
  assert.ok(html.includes('<table>'))
})
test('HTML scripts and event handlers are never enabled by break support', () => {
  for (const source of ['<script>alert(1)</script>', '<br onclick="alert(1)">', '<img src=x onerror="alert(1)">']) {
    const html=render(source)
    assert.ok(!html.includes('<script>'))
    assert.ok(!html.includes('<br onclick'))
    assert.ok(!html.includes('<img src'))
  }
})
