// supabase/functions/lock-inactive-leagues/index.ts
// Runs weekly — locks leagues that exceeded inactivity threshold
// Schedule: every Sunday at 03:00

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  // Read threshold from system_config
  const { data: config } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'inactivity_threshold_days')
    .single()

  const days      = parseInt(config?.value || '90')
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - days)

  // Lock leagues past threshold that aren't already locked
  const { data: locked, error } = await supabase
    .from('leagues')
    .update({ is_locked: true })
    .eq('is_locked', false)
    .lt('last_activity_at', threshold.toISOString())
    .select('id, name, owner_id')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // Notify owners of newly locked leagues
  if (locked?.length) {
    const notifications = locked.map(league => ({
      user_id: league.owner_id,
      type:    'league_locked',
      payload: {
        league_id:   league.id,
        league_name: league.name,
        message:     `הליגה "${league.name}" ננעלה עקב חוסר פעילות`,
      },
    }))

    await supabase.from('notifications').insert(notifications)
  }

  return new Response(
    JSON.stringify({ locked: locked?.length || 0, threshold_days: days }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
