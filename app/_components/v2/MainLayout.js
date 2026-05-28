'use client'

import Sidebar from './Sidebar'

export default function MainLayout({ children, profile, theme }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      <Sidebar profile={profile} theme={theme} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
