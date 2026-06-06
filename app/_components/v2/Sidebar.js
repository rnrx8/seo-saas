'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { creditBarPct } from '@/app/_lib/billing'

const NAV_ITEMS = [
  {
    key: 'dashboard',
    type: 'link',
    label: 'ダッシュボード',
    href: '/dashboard',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  { key: 'section_preset', type: 'section', label: '生成プリセット' },
  { key: 'presets',   type: 'sublink', label: 'プリセット一覧', href: '/settings/presets',   enabled: true },
  { key: 'services',  type: 'sublink', label: 'サービス管理',   href: '/settings/services',  enabled: true },
  { key: 'ctas',      type: 'sublink', label: 'CTA管理',        href: '/settings/ctas',      enabled: true },
  { key: 'companies', type: 'sublink', label: '企業管理',       href: '/settings/companies', enabled: true },
  { key: 'sources',   type: 'sublink', label: '一次情報',       href: '/settings/sources',   enabled: true },
  { key: 'learned',   type: 'sublink', label: '学習ルール',     href: '/settings/learned-rules', enabled: true },
  {
    key: 'account',
    type: 'link',
    label: 'アカウント',
    href: '/settings',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'bugs',
    type: 'link',
    label: '不具合情報',
    href: '/bugs',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
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

  const creditsRemaining = profile?.credits_remaining ?? 0
  const creditPct = creditBarPct(creditsRemaining, profile?.credits_total)

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

  return (
    <aside className="flex flex-col h-screen w-56 flex-shrink-0 glass-panel border-r border-white/40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo-circle.png" alt="logo" width={200} height={200} className="w-[60%] h-auto" />
          <Image src="/logo-text.png" alt="DiG" width={200} height={100} className="w-[50%] h-auto object-contain" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          if (item.type === 'section') {
            if (item.key === 'section_preset') {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPresetOpen(v => !v)}
                  className="flex items-center justify-between px-3 pt-5 pb-1 w-full group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 group-hover:text-gray-500 transition-colors">
                    {item.label}
                  </span>
                  <svg
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                    className={`w-3 h-3 text-gray-300 group-hover:text-gray-400 transition-transform ${presetOpen ? '' : '-rotate-90'}`}
                  >
                    <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )
            }
            return (
              <div key={item.key} className="px-3 pt-5 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{item.label}</span>
              </div>
            )
          }

          if (item.type === 'sublink') {
            if (!presetOpen) return null
            if (!item.enabled) {
              return (
                <div key={item.key} className="flex items-center pl-6 pr-3 py-1.5 rounded-lg text-xs text-gray-300 cursor-not-allowed select-none">
                  {item.label}
                </div>
              )
            }
            const active = isActive(item)
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center pl-6 pr-3 py-1.5 rounded-lg text-xs transition-colors ${
                  active
                    ? 'bg-violet-50 text-violet-700 font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className={`w-1 h-1 rounded-full mr-2.5 flex-shrink-0 ${active ? 'bg-violet-500' : 'bg-gray-300'}`} />
                {item.label}
              </Link>
            )
          }

          if (!item.enabled) {
            return (
              <div key={item.key} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-300 cursor-not-allowed select-none">
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
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-violet-50 text-violet-700 font-medium'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className={active ? 'text-violet-500' : 'text-gray-400'}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Credit card */}
      <div className="mx-3 mb-3 rounded-xl p-4 border border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-500 text-xs">残りクレジット</span>
          <span className="text-gray-700 text-xs font-medium">{creditsRemaining}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${creditPct}%`, background: 'var(--grad)' }}
          />
        </div>
      </div>

      {/* User / Logout */}
      <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
            style={{ background: 'var(--grad)' }}
          >
            {((theme?.company_name ?? profile?.display_name ?? profile?.email ?? '?')[0]).toUpperCase()}
          </div>
          <span className="text-gray-500 text-xs truncate">
            {theme?.company_name ?? profile?.display_name ?? profile?.email ?? ''}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 ml-2"
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
