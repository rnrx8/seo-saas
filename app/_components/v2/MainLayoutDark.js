'use client'

import SidebarDark from './SidebarDark'
import ResponsiveLayout from './ResponsiveLayout'

export default function MainLayoutDark({ children, profile, theme }) {
  return (
    <ResponsiveLayout sidebar={<SidebarDark profile={profile} theme={theme} />} dark>
      {children}
    </ResponsiveLayout>
  )
}
