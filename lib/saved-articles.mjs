// Availability is separate from generation / review completion.
export async function withSavedArticles(supabase, jobs) {
  const failedIds = jobs.filter(job => job.status === 'failed').map(job => job.id)
  const available = new Set()
  for (let offset = 0; offset < failedIds.length; offset += 100) {
    const { data, error } = await supabase.from('artifacts')
      .select('job_id')
      .eq('step', 'article')
      .in('job_id', failedIds.slice(offset, offset + 100))
      .not('content_text', 'is', null)
      .neq('content_text', '')
    if (!error) for (const row of data ?? []) available.add(row.job_id)
  }
  return jobs.map(job => ({ ...job, hasSavedArticle: available.has(job.id) }))
}
