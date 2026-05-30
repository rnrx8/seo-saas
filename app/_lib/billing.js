// 課金モードの中央設定。
//
// 'metered'      : 従量課金（クレジット追加購入が基本）— 現行のデフォルト。
//                  プランの概念は表に出さず、残りクレジットのみを扱う。
// 'subscription' : 月額制（プラン概念あり）— 一部クライアント向けに将来切り替える想定。
//                  このモードに変えるだけでプラン表示・プラン変更UIが復活する。
//
// クライアントごとに月額制へ切り替える可能性があるため、プラン関連のコードは
// 削除せずこのフラグの裏に残してある。
export const BILLING_MODE = 'metered'

// プラン名の表示・プラン変更UIを出すかどうか。
export const PLAN_UI_ENABLED = BILLING_MODE === 'subscription'

// 従量課金時の残量バーの満タン基準。これ以下になると残数に応じてバーが減る。
export const LOW_CREDIT_THRESHOLD = 10

// 残量バーの充填率(0-100)を返す。
// - 月額制でtotalがある場合: remaining / total
// - それ以外（従量課金）: LOW_CREDIT_THRESHOLD を満タン基準とし、
//   閾値を超えていれば常に100%、閾値以下なら残数に比例して減る。
export function creditBarPct(remaining, total) {
  const r = remaining ?? 0
  if (PLAN_UI_ENABLED && total > 0) {
    return Math.min(100, Math.max(0, Math.round((r / total) * 100)))
  }
  if (r >= LOW_CREDIT_THRESHOLD) return 100
  return Math.min(100, Math.max(0, Math.round((r / LOW_CREDIT_THRESHOLD) * 100)))
}
