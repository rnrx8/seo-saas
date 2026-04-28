'use client'

import { useRouter, usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'ダッシュボード',
    href: '/dashboard',
    active: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: 'generate',
    label: '記事生成',
    href: '/dashboard',
    active: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'articles',
    label: '生成済み記事',
    href: '/dashboard',
    active: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M9 12h6M9 8h6M9 16h4M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
      </svg>
    ),
  },
  {
    key: 'keyword',
    label: 'キーワード調査',
    href: null,
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'competitor',
    label: '競合分析',
    href: null,
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M3 12l5-5 4 4 5-5 4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'audit',
    label: 'コンテンツ監査',
    href: null,
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'projects',
    label: 'プロジェクト',
    href: null,
    active: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: '設定',
    href: '/settings',
    active: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
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

  function isNavActive(item) {
    if (!item.active) return false
    if (item.href === '/dashboard') return pathname === '/dashboard' || pathname?.startsWith('/article')
    return pathname === item.href
  }

  const planLabel = { free: 'フリープラン', standard: 'スタンダード', pro: 'プロプラン' }[profile?.plan] ?? 'フリープラン'
  const creditsRemaining = profile?.credits_remaining ?? 0
  const creditsTotal = profile?.credits_total ?? 5
  const creditPct = creditsTotal > 0 ? Math.round((creditsRemaining / creditsTotal) * 100) : 0

  return (
    <aside
      className="flex flex-col h-screen w-56 flex-shrink-0 select-none"
      style={{ backgroundColor: sidebarBg }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {logoText.slice(0, 2)}
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">{logoText}</div>
            <div className="text-white/50 text-[10px] leading-none mt-0.5">{logoSubtitle}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item)
          return (
            <button
              key={item.key}
              onClick={() => item.active && item.href && router.push(item.href)}
              disabled={!item.active}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                active
                  ? 'text-white font-medium'
                  : item.active
                  ? 'text-white/60 hover:text-white/80 hover:bg-white/5'
                  : 'text-white/25 cursor-not-allowed'
              }`}
              style={active ? { backgroundColor: primaryColor } : {}}
            >
              <span className={active ? 'text-white' : item.active ? 'text-white/50' : 'text-white/20'}>
                {item.icon}
              </span>
              {item.label}
            </button>
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

      {/* User */}
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
