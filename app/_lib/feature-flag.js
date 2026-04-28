const NEW_DESIGN_EMAILS = [
  'ryoka.nishi@lany.co.jp',
]

export function isNewDesignEnabled(email) {
  return NEW_DESIGN_EMAILS.includes(email?.toLowerCase())
}
