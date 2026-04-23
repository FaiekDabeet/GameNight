// ── lib/actions.js ───────────────────────────────────────────
// High-level user actions that combine:
//   - Supabase DB mutation
//   - XP event insertion
//   - Badge check
//   - Notification creation
//
// Import these in pages instead of calling supabase directly.

import { supabase }           from './supabase.js'
import { insertXpEvent, checkAndAwardBadges, XP_EVENTS } from './xp.js'
import { insertNotification, NOTIF_TYPES } from './notifications.js'

// ── Create a league ───────────────────────────────────────────
export async function createLeague({ userId, name, sportType, isPublic = true, season = null, coverUrl = null, logoUrl = null }) {
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()

  const { data: league, error } = await supabase
    .from('leagues')
    .insert({
      owner_id:    userId,
      name,
      sport_type:  sportType,
      is_public:   isPublic,
      season,
      invite_code: inviteCode,
      cover_url:   coverUrl,
      logo_url:    logoUrl,
    })
    .select('id, name, invite_code')
    .single()

  if (error) throw error

  // Auto-add creator as admin member
  await supabase.from('league_members').insert({
    league_id:   league.id,
    user_id:     userId,
    role:        'admin',
  })

  // XP + badges
  await insertXpEvent({ userId, eventType: XP_EVENTS.CREATE_LEAGUE, refId: league.id })
  await checkAndAwardBadges(userId)

  return league
}

// ── Join a league by invite code ──────────────────────────────
export async function joinLeagueByCode({ userId, inviteCode }) {
  const { data: league, error: leagueErr } = await supabase
    .from('leagues')
    .select('id, name, owner_id, is_locked')
    .eq('invite_code', inviteCode.toUpperCase())
    .single()

  if (leagueErr || !league) throw new Error('קוד הזמנה לא תקין')
  if (league.is_locked)      throw new Error('הליגה נעולה ולא ניתן להצטרף')

  // Check already a member
  const { data: existing } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', league.id)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) throw new Error('כבר חבר בליגה זו')

  const { error: joinErr } = await supabase
    .from('league_members')
    .insert({ league_id: league.id, user_id: userId, role: 'player' })
  if (joinErr) throw joinErr

  // XP for joiner
  await insertXpEvent({ userId, eventType: XP_EVENTS.JOIN_LEAGUE, refId: league.id })

  // XP for inviter (league owner)
  await insertXpEvent({
    userId:    league.owner_id,
    eventType: XP_EVENTS.INVITE_ACCEPTED,
    refId:     league.id,
  })

  // Notify the league owner
  const { data: joiner } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', userId)
    .single()

  await insertNotification({
    userId:  league.owner_id,
    type:    NOTIF_TYPES.NEW_FOLLOWER,
    payload: {
      follower_id:   userId,
      follower_name: joiner?.display_name || 'שחקן חדש',
      league_id:     league.id,
      league_name:   league.name,
      message:       `${joiner?.display_name || 'שחקן'} הצטרף לליגה ${league.name}`,
    },
  })

  await checkAndAwardBadges(userId)
  return league
}

// ── Record a game result ──────────────────────────────────────
export async function recordGameResult({ gameId, homeScore, awayScore, recordedBy }) {
  const { data: game, error } = await supabase
    .from('games')
    .update({
      home_score:  homeScore,
      away_score:  awayScore,
      status:      'completed',
      played_at:   new Date().toISOString(),
      recorded_by: recordedBy,
    })
    .eq('id', gameId)
    .select('id, league_id, home_player_id, away_player_id, leagues(name)')
    .single()

  if (error) throw error

  // XP for recorder
  await insertXpEvent({
    userId:    recordedBy,
    eventType: XP_EVENTS.RECORD_RESULT,
    refId:     gameId,
  })

  // Notify both players
  const leagueName = game.leagues?.name || 'ליגה'
  const notifPayload = {
    game_id:    gameId,
    league_id:  game.league_id,
    league_name: leagueName,
    home_score: homeScore,
    away_score: awayScore,
  }

  const targets = [game.home_player_id, game.away_player_id].filter(Boolean)
  const { data: players } = await supabase
    .from('users')
    .select('id, display_name')
    .in('id', targets)

  if (players?.length === 2) {
    notifPayload.home_name = players[0].display_name
    notifPayload.away_name = players[1].display_name
  }

  await Promise.all(targets.map(uid =>
    insertNotification({ userId: uid, type: NOTIF_TYPES.GAME_RESULT, payload: notifPayload })
  ))

  await checkAndAwardBadges(recordedBy)
  return game
}

// ── Follow a player ───────────────────────────────────────────
export async function followPlayer({ followerId, targetId }) {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, target_type: 'player', target_id: targetId })
  if (error) throw error

  // XP for target (getting a follower)
  await insertXpEvent({
    userId:    targetId,
    eventType: XP_EVENTS.GET_FOLLOWER,
    refId:     followerId,
  })

  // Notify target
  const { data: follower } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', followerId)
    .single()

  await insertNotification({
    userId:  targetId,
    type:    NOTIF_TYPES.NEW_FOLLOWER,
    payload: {
      follower_id:   followerId,
      follower_name: follower?.display_name || 'מישהו',
    },
  })

  await checkAndAwardBadges(targetId)
}

// ── Unfollow a player ─────────────────────────────────────────
export async function unfollowPlayer({ followerId, targetId }) {
  await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('target_type', 'player')
    .eq('target_id', targetId)
}

// ── Follow a league ───────────────────────────────────────────
export async function followLeague({ followerId, leagueId }) {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, target_type: 'league', target_id: leagueId })
  if (error && error.code !== '23505') throw error // ignore duplicate
}

// ── Unfollow a league ─────────────────────────────────────────
export async function unfollowLeague({ followerId, leagueId }) {
  await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('target_type', 'league')
    .eq('target_id', leagueId)
}

// ── Complete a season ─────────────────────────────────────────
export async function completeSeason({ leagueId, ownerId, newSeason }) {
  const { error } = await supabase
    .from('leagues')
    .update({ season: newSeason, last_activity_at: new Date().toISOString() })
    .eq('id', leagueId)
    .eq('owner_id', ownerId)
  if (error) throw error

  await insertXpEvent({
    userId:    ownerId,
    eventType: XP_EVENTS.SEASON_COMPLETE,
    refId:     leagueId,
  })

  await checkAndAwardBadges(ownerId)
}
