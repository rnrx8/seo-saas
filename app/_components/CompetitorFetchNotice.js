import { competitorFetchNotice } from '@/lib/competitor-fetch-status.mjs'

export default function CompetitorFetchNotice({ details }) {
  const message = competitorFetchNotice(details)
  if (!message) return null
  return (
    <p className={`text-xs mt-2 leading-relaxed ${details?.fetch_status === 'failed' ? 'text-amber-700' : 'text-gray-500'}`}>
      {message}
    </p>
  )
}
