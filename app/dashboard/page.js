'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { isNewDesignEnabled } from '@/app/_lib/feature-flag'

export default function DashboardRouter() {
  const [Page, setPage] = useState(null)

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email ?? ''
      if (isNewDesignEnabled(email)) {
        import('./_new-page').then(m => setPage(() => m.default))
      } else {
        import('./_old-page').then(m => setPage(() => m.default))
      }
    })
  }, [])

  if (!Page) return null
  return <Page />
}
