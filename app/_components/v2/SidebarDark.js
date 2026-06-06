'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

// type: 'link' | 'section' | 'sublink'
const NAV_ITEMS = [
  {
    key: 'dashboard',
    type: 'link',
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

  // ── 生成プリセット セクション ──
  { key: 'section_preset', type: 'section', label: '生成プリセット' },
  { key: 'presets',   type: 'sublink', label: 'プリセット一覧', href: '/settings/presets',   enabled: true },
  { key: 'services',  type: 'sublink', label: 'サービス管理',   href: '/settings/services',  enabled: true },
  { key: 'ctas',      type: 'sublink', label: 'CTA管理',        href: '/settings/ctas',      enabled: true },
  { key: 'companies', type: 'sublink', label: '企業管理',       href: '/settings/companies', enabled: true },
  { key: 'sources',   type: 'sublink', label: '一次情報',       href: '/settings/sources',   enabled: true },
  { key: 'learned',   type: 'sublink', label: '学習ルール',     href: '/settings/learned-rules', enabled: true },

  // ── アカウント ──
  {
    key: 'account',
    type: 'link',
    label: 'アカウント',
    href: '/settings',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
      </svg>
    ),
  },

  // ── 不具合情報 ──
  {
    key: 'bugs',
    type: 'link',
    label: '不具合情報',
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
]

export default function Sidebar({ profile, theme }) {
  const router = useRouter()
  const pathname = usePathname()
  const [presetOpen, setPresetOpen] = useState(true)

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
    if (!item.href) return false
    if (item.key === 'dashboard') return pathname === '/dashboard'
    if (item.key === 'account') return pathname === '/settings'
    if (item.type === 'sublink') return pathname.startsWith(item.href)
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
          // セクションヘッダー
          if (item.type === 'section') {
            if (item.key === 'section_preset') {
              const anyActive = NAV_ITEMS.filter(i => i.type === 'sublink').some(i => isActive(i))
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPresetOpen(v => !v)}
                  className="flex items-center justify-between px-3 pt-5 pb-1 w-full group"
                >
                  <span className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    anyActive ? 'text-white/60' : 'text-white/30 group-hover:text-white/50'
                  }`}>
                    {item.label}
                  </span>
                  <svg
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                    className={`w-3 h-3 text-white/30 group-hover:text-white/50 transition-transform ${presetOpen ? '' : '-rotate-90'}`}
                  >
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )
            }
            return (
              <div key={item.key} className="px-3 pt-5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{item.label}</span>
              </div>
            )
          }

          // サブリンク（インデント・アイコンなし）
          if (item.type === 'sublink') {
            if (!presetOpen) return null
            if (!item.enabled) {
              return (
                <div key={item.key} className="flex items-center pl-6 pr-3 py-2 rounded-lg text-xs text-white/20 cursor-not-allowed select-none">
                  {item.label}
                </div>
              )
            }
            const active = isActive(item)
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center pl-6 pr-3 py-2 rounded-lg text-xs transition-colors ${
                  active ? 'text-white font-medium' : 'text-white/50 hover:text-white/80 hover:bg-white/8'
                }`}
                style={active ? { backgroundColor: `${primaryColor}33` } : {}}
              >
                <span
                  className="w-1 h-1 rounded-full mr-2.5 flex-shrink-0"
                  style={{ backgroundColor: active ? primaryColor : 'rgba(255,255,255,0.3)' }}
                />
                {item.label}
              </Link>
            )
          }

          // 通常リンク
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

          const active = isActive(item)
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? 'text-white font-medium' : 'text-white/60 hover:text-white/90 hover:bg-white/8'
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
