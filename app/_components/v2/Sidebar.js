'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'ダッシュボード',
    href: '/dashboard',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: 'projects',
    label: 'プロジェクト',
    href: null,
    enabled: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
        <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    ),
  },
  {
    key: 'bugs',
    label: 'バグ管理',
    href: '/bugs',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
        <path d="M9 9a3 3 0 116 0v1H9V9z" />
        <path d="M6.5 10H4a1 1 0 00-1 1v1a5 5 0 005 5h4a5 5 0 005-5v-1a1 1 0 00-1-1h-2.5" strokeLinecap="round" />
        <path d="M12 17v3M8.5 8.5L6 6M15.5 8.5L18 6M6 20l2-2M18 20l-2-2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: '設定',
    href: '/settings',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

export default function Sidebar({ profile, theme }) {
  const router = useRouter()
  const pathname = usePathname()

  const sidebarBg = theme?.sidebar_bg || '#0c1832'
  const primaryColor = theme?.primary_color || '#2563eb'
  const logoText = theme?.logo_text || 'DIG'
  const logoSubtitle = theme?.logo_subtitle || 'SEO Platform'
  const companyName = theme?.company_name || 'DIG'

  async function handleLogout() {
    await getSupabase().auth.signOut()
    router.replace('/login')
  }

  function isActive(item) {
    if (!item.enabled || !item.href) return false
    // ダッシュボードと生成済み記事はどちらも /dashboard だが、
    // article ページでは「生成済み記事」を active に、dashboard では「ダッシュボード」を active にする
    if (item.key === 'dashboard') return pathname === '/dashboard'
    if (item.key === 'bugs') return pathname === '/bugs'
    return pathname === item.href
  }

  const planLabel = { free: 'フリープラン', standard: 'スタンダード', pro: 'プロプラン' }[profile?.plan] ?? 'フリープラン'
  const creditsRemaining = profile?.credits_remaining ?? 0
  const creditsTotal = profile?.credits_total ?? 5
  const creditPct = creditsTotal > 0 ? Math.min(100, Math.round((creditsRemaining / creditsTotal) * 100)) : 0

  return (
    <aside
      className="flex flex-col h-screen w-56 flex-shrink-0"
      style={{ backgroundColor: sidebarBg }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {logoText.slice(0, 2)}
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-none truncate">{logoText}</div>
            <div className="text-white/50 text-[10px] leading-none mt-0.5 truncate">{logoSubtitle}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item)

          if (!item.enabled) {
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/25 cursor-not-allowed select-none"
              >
                {item.icon}
                {item.label}
              </div>
            )
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'text-white font-medium'
                  : 'text-white/60 hover:text-white/90 hover:bg-white/8'
              }`}
              style={active ? { backgroundColor: primaryColor } : {}}
            >
              <span className={active ? 'text-white' : 'text-white/50'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Plan card */}
      <div className="mx-3 mb-3 rounded-xl p-4 border border-white/10 bg-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/70 text-xs">{planLabel}</span>
          <span className="text-white text-xs font-medium">{creditsRemaining}/{creditsTotal}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${creditPct}%`, backgroundColor: primaryColor }}
          />
        </div>
        <p className="text-white/40 text-[10px] mt-2">残りクレジット</p>
      </div>

      {/* User / Logout */}
      <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {(companyName[0] ?? 'U').toUpperCase()}
          </div>
          <span className="text-white/60 text-xs truncate">{companyName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0 ml-2"
          title="ログアウト"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </aside>
  )
}
