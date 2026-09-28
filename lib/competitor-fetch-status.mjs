export function competitorFetchNotice(details = {}) {
  if (details.fetch_status !== 'failed') {
    return details.fetch_method === 'browser' ? '99％モード：ブラウザで本文を再取得しました。' : ''
  }
  if (details.browser_attempted) {
    return '99％モードでブラウザ再取得も試しましたが、本文は未確認です。アクセス制限や通信状況などにより取得できない場合があります。'
  }
  const reason = {
    dynamic_content: 'JavaScriptによる表示の可能性があり、本文は未確認です。',
    access_restricted: 'アクセス制限のため、本文は未確認です。',
    not_found: 'ページが見つからず、本文は未確認です。',
    timeout: '通信が時間内に完了せず、本文は未確認です。',
  }[details.failure_code] || '本文を取得できなかったため、未確認です。'
  if (details.failure_code === 'not_found') return reason
  return `${reason} 99％モードで生成すると、ブラウザでの再取得を試せます。サイトによっては取得できない場合があります。`
}
