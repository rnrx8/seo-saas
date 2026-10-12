'use client'

import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { watchCredits } from '@/lib/credit-sync.mjs'

export function useCreditSync(profile, setProfile) {
  const userId = profile?.id
  const remaining = profile?.credits_remaining
  const total = profile?.credits_total
  const plan = profile?.plan
  useEffect(() => {
    if (!userId) return
    return watchCredits({
      window,
      document,
      read: () => getSupabase().from('user_profiles')
        .select('credits_remaining, credits_total, plan').eq('id', userId).single(),
      apply: data => setProfile(previous => {
        if (previous?.id !== userId) return previous
        if (previous.credits_remaining === data.credits_remaining &&
            previous.credits_total === data.credits_total && previous.plan === data.plan) return previous
        return { ...previous, ...data }
      }),
    })
  }, [userId, remaining, total, plan, setProfile])
}
