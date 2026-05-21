const NEW_DESIGN_EMAILS = [
  'ryoka.nishi@lany.co.jp',
]

export function isNewDesignEnabled(email) {
  return NEW_DESIGN_EMAILS.includes(email?.toLowerCase())
}

const ADMIN_EMAILS = [
  'nishi.aworks@gmail.com',
]

export function isAdminEnabled(email) {
  return ADMIN_EMAILS.includes(email?.toLowerCase())
}
