'use client'

import SidebarDark from './SidebarDark'

export default function MainLayoutDark({ children, profile, theme }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#eef2f8' }}>
      <SidebarDark profile={profile} theme={theme} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
