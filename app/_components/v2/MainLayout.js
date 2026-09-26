'use client'

import Sidebar from './Sidebar'
import ResponsiveLayout from './ResponsiveLayout'

export default function MainLayout({ children, profile, theme }) {
  return (
    <ResponsiveLayout sidebar={<Sidebar profile={profile} theme={theme} />}>
      {children}
    </ResponsiveLayout>
  )
}
