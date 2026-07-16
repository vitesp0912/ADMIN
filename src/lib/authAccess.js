/** Main support admin — full access to restricted pages/actions */
export const SUPPORT_ADMIN_EMAIL = 'support@petrofi.com'

export function isSupportAdminEmail(email) {
  return (email || '').trim().toLowerCase() === SUPPORT_ADMIN_EMAIL
}

/** Sidebar / route paths hidden from non-support admins */
export const SUPPORT_ONLY_PATHS = [
  '/users',
  '/sales',
  '/expenses',
  '/meter-readings',
  '/settings',
  '/audit-logs',
  '/error-logs',
]

export function isSupportOnlyPath(pathname) {
  return SUPPORT_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}
