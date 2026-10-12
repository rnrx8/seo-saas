"use client"

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

const WARNING_EMAIL = 'nishi.aworks@gmail.com'

export default function QualityWarnings({ jobId }) {
  const [warnings, setWarnings] = useState([])
  useEffect(() => {
    let cancelled = false
    let timer
    const supabase = getSupabase()
    async function start() {
      const { data, error } = await supabase.auth.getUser()
      if (cancelled || error || data.user?.email?.toLowerCase() !== WARNING_EMAIL) return
      async function refresh() {
        let query = supabase.from('artifacts').select('job_id, content_text')
          .eq('step', 'quality_warnings').order('created_at', { ascending: false }).limit(50)
        if (jobId) query = query.eq('job_id', jobId)
        const { data: rows, error: fetchError } = await query
        if (cancelled || fetchError) return
        const items = (rows || []).flatMap(row => {
          try { return (JSON.parse(row.content_text).warnings || []).map(w => ({ ...w, jobId: row.job_id })) }
          catch { return [] }
        })
        setWarnings(items)
      }
      await refresh()
      if (!cancelled) timer = setInterval(refresh, 5000)
    }
    start()
    return () => { cancelled = true; clearInterval(timer) }
  }, [jobId])
  if (!warnings.length) return null
  return (
    <aside role="status" className="m-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">確認事項を残して生成を進めています</p>
      <p className="mt-1">調査や形式の確認が完了していない箇所があります。公開前に内容をご確認ください。</p>
      <ul className="mt-2 list-disc pl-5 space-y-1">
        {warnings.map((warning, index) => (
          <li key={`${warning.jobId}-${index}`}>
            {!jobId && <a className="underline mr-2" href={`/article/${warning.jobId}`}>記事を確認</a>}
            {warning.message}
          </li>
        ))}
      </ul>
    </aside>
  )
}
