import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const { username } = await request.json()
  if (!username) return Response.json({ error: 'username required' }, { status: 400 })

  const { data, error } = await adminClient
    .from('user_profiles')
    .select('id')
    .eq('display_name', username)
    .single()

  if (error || !data) return Response.json({ error: 'ユーザーが見つかりません' }, { status: 404 })

  const { data: { user }, error: authError } = await adminClient.auth.admin.getUserById(data.id)
  if (authError || !user) return Response.json({ error: 'ユーザーが見つかりません' }, { status: 404 })

  return Response.json({ email: user.email })
}
