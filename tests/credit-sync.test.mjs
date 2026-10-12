import test from 'node:test'
import assert from 'node:assert/strict'
import { watchCredits } from '../lib/credit-sync.mjs'

const flush = () => new Promise(resolve => setImmediate(resolve))
function surface() {
  const events = new Map()
  const document = { visibilityState: 'visible',
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: name => events.delete(name) }
  const window = { ...document,
    setInterval: fn => { events.set('tick', fn); return 1 },
    clearInterval: () => events.delete('tick') }
  return { window, document, events }
}

test('updates persisted balance on polling and returning to the tab', async () => {
  const ui = surface()
  let balance = 10
  const values = []
  const stop = watchCredits({ ...ui,
    read: async () => ({ data: { credits_remaining: balance } }),
    apply: data => values.push(data.credits_remaining) })
  await flush()
  balance = 8.8
  await ui.events.get('tick')()
  ui.document.visibilityState = 'hidden'
  balance = 8.3
  await ui.events.get('tick')()
  assert.deepEqual(values, [10, 8.8])
  ui.document.visibilityState = 'visible'
  await ui.events.get('visibilitychange')()
  balance = 7.3
  await ui.events.get('focus')()
  assert.deepEqual(values, [10, 8.8, 8.3, 7.3])
  stop()
  assert.equal(ui.events.size, 0)
})

test('failed reads preserve balance and later reads recover', async () => {
  const ui = surface()
  let result = { error: new Error('offline') }
  const values = []
  const stop = watchCredits({ ...ui, read: async () => result, apply: data => values.push(data) })
  await flush()
  assert.equal(values.length, 0)
  result = { data: { credits_remaining: 4 } }
  await ui.events.get('tick')()
  assert.deepEqual(values, [result.data])
  stop()
})

test('does not overlap requests or apply a late response after cleanup', async () => {
  const ui = surface()
  let resolveRead
  let reads = 0
  const values = []
  const stop = watchCredits({ ...ui,
    read: () => { reads++; return new Promise(resolve => { resolveRead = resolve }) },
    apply: data => values.push(data) })
  await ui.events.get('tick')()
  await ui.events.get('focus')()
  assert.equal(reads, 1)
  stop()
  resolveRead({ data: { credits_remaining: 3 } })
  await flush()
  assert.deepEqual(values, [])
})
