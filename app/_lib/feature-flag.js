export function isNewDesignEnabled(email) {
  return true
}

const ADMIN_EMAILS = [
  'nishi.aworks@gmail.com',
]

export function isAdminEnabled(email) {
  return ADMIN_EMAILS.includes(email?.toLowerCase())
}
