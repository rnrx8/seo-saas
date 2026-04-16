import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'

export const dynamic = 'force-dynamic'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getAdminSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { job_id } = await request.json()
  if (!job_id) return Response.json({ error: 'job_id is required' }, { status: 400 })

  // WP設定を取得
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('wp_url, wp_username, wp_app_password')
    .eq('id', user.id)
    .single()

  if (!profile?.wp_url || !profile?.wp_username || !profile?.wp_app_password) {
    return Response.json({ error: 'WordPress連携が設定されていません' }, { status: 400 })
  }

  // 記事を取得
  const { data: artifact } = await supabase
    .from('artifacts')
    .select('content_text')
    .eq('job_id', job_id)
    .eq('step', 'article')
    .single()

  if (!artifact?.content_text) {
    return Response.json({ error: '記事が見つかりません' }, { status: 404 })
  }

  const markdown = artifact.content_text

  // 最初のH1をタイトルとして抽出、本文からは除去
  let title = ''
  let body = markdown
  const h1Match = markdown.match(/^#\s+(.+)$/m)
  if (h1Match) {
    title = h1Match[1].trim()
    body = markdown.replace(h1Match[0], '').trim()
  } else {
    // H1がなければjobsからkeywordを取得
    const { data: job } = await supabase.from('jobs').select('main_keyword').eq('id', job_id).single()
    title = job?.main_keyword ?? ''
  }

  const html = marked(body)

  // WordPress REST API に投稿
  const wpBase = profile.wp_url.replace(/\/$/, '')
  const appPassword = profile.wp_app_password.replace(/\s/g, '')
  const credentials = Buffer.from(`${profile.wp_username}:${appPassword}`).toString('base64')

  try {
    const res = await fetch(`${wpBase}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        title,
        content: html,
        status: 'draft',
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      let errMsg
      try {
        const err = JSON.parse(text)
        errMsg = err.message ?? `WordPress APIエラー（${res.status}）`
      } catch {
        // HTMLが返ってきた場合はステータスコードと先頭だけ返す
        errMsg = `WordPress APIエラー（${res.status}）: ${text.slice(0, 200)}`
      }
      return Response.json({ error: errMsg }, { status: 500 })
    }

    const post = await res.json()
    return Response.json({ post_id: post.id, edit_url: `${wpBase}/wp-admin/post.php?post=${post.id}&action=edit` })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
