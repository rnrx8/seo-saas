'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { isAdminEnabled } from '@/app/_lib/feature-flag'

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'ダッシュボード',
    href: '/admin/dashboard',
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
    key: 'users',
    label: 'ユーザー管理',
    href: '/admin/users',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'jobs',
    label: 'ジョブ監視',
    href: '/admin/jobs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'services',
    label: 'サービス状況',
    href: '/admin/services',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const SIDEBAR_BG = '#1a0505'
const ACCENT = '#dc2626'

export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      if (!isAdminEnabled(session.user.email)) { router.replace('/dashboard'); return }
      setAdminEmail(session.user.email ?? '')
      setReady(true)
    })
  }, [])

  if (!ready) return null

  function isActive(item) {
    if (item.key === 'dashboard') return pathname === '/admin/dashboard'
    if (item.key === 'users') return pathname?.startsWith('/admin/users')
    if (item.key === 'jobs') return pathname === '/admin/jobs'
    if (item.key === 'services') return pathname === '/admin/services'
    return false
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f5f5f5' }}>
      <aside className="flex flex-col h-screen w-56 flex-shrink-0" style={{ backgroundColor: SIDEBAR_BG }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: ACCENT }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-4 h-4">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold text-sm leading-none">Admin</div>
              <div className="text-white/50 text-[10px] leading-none mt-0.5">管理パネル</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = isActive(item)
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? 'text-white font-medium' : 'text-white/60 hover:text-white/90 hover:bg-white/8'
                }`}
                style={active ? { backgroundColor: ACCENT } : {}}
              >
                <span className={active ? 'text-white' : 'text-white/50'}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 flex flex-col gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 flex-shrink-0">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            通常画面に戻る
          </Link>
          <div className="px-3 pt-3 border-t border-white/10">
            <p className="text-white/30 text-[10px] truncate">{adminEmail}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
