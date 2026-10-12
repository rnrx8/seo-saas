// Read-only refresh; billing writes remain owned by the generation flow.
export function watchCredits({ read, apply, window, document, intervalMs = 5000 }) {
  let disposed = false
  let pending = false
  async function refresh() {
    if (disposed || pending || document.visibilityState === 'hidden') return
    pending = true
    try {
      const { data, error } = await read()
      if (!disposed && !error && data) apply(data)
    } catch {
      // Keep the last confirmed balance on temporary network failures.
    } finally {
      pending = false
    }
  }
  const timer = window.setInterval(refresh, intervalMs)
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  refresh()
  return () => {
    disposed = true
    window.clearInterval(timer)
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
  }
}
