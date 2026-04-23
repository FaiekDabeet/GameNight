// supabase/functions/game-reminders/index.ts
// Supabase Edge Function — runs as a scheduled cron job
// Schedule: every day at 08:00 IL time
// Sends notifications for games scheduled within next 24 hours

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async () => {
  const now      = new Date()
  const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const in25h    = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  // Find games scheduled within the next 24-25h window (to avoid duplicates)
  const { data: games } = await supabase
    .from('games')
    .select(`
      id, played_at, league_id,
      leagues(name),
      home:home_player_id(id, display_name),
      away:away_player_id(id, display_name)
    `)
    .eq('status', 'scheduled')
    .gte('played_at', in24h.toISOString())
    .lte('played_at', in25h.toISOString())

  if (!games?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  let sent = 0

  for (const game of games) {
    const targets = [game.home?.id, game.away?.id].filter(Boolean)
    const payload = {
      game_id:     game.id,
      league_id:   game.league_id,
      league_name: game.leagues?.name || 'ליגה',
      played_at:   game.played_at,
    }

    for (const userId of targets) {
      const { error } = await supabase
        .from('notifications')
        .insert({ user_id: userId, type: 'game_reminder', payload })

      if (!error) sent++
    }
  }

  return new Response(JSON.stringify({ sent, games: games.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
