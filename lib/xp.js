// ── lib/xp.js ────────────────────────────────────────────────
// XP event helpers.
// All XP mutations go through insertXpEvent — the DB trigger
// reads xp_config and applies the correct value automatically.
// Client code never needs to know the XP value itself.

import { supabase } from './supabase.js'

// ── Event types (mirrors xp_config table) ────────────────────
export const XP_EVENTS = {
  CREATE_LEAGUE:    'create_league',
  JOIN_LEAGUE:      'join_league',
  RECORD_RESULT:    'record_result',
  INVITE_ACCEPTED:  'invite_accepted',
  LOGIN_STREAK_7:   'login_streak_7',
  GET_FOLLOWER:     'get_follower',
  SEASON_COMPLETE:  'season_complete',
}

// ── Badge definitions (mirrors player_cards.badges_json) ─────
export const BADGES = {
  first_league:  { label: 'First League',  icon: '🏟', xp: XP_EVENTS.CREATE_LEAGUE,  threshold: 1  },
  streak_7:      { label: 'Streak 7',      icon: '🔥', xp: XP_EVENTS.LOGIN_STREAK_7, threshold: 1  },
  games_100:     { label: '100 Games',     icon: '🎮', stat: 'total_games',           threshold: 100 },
  social_star:   { label: 'Social Star',   icon: '⭐', stat: 'follower_count',        threshold: 50  },
  legend:        { label: 'Legend',        icon: '👑', stat: 'level',                 threshold: 16  },
}

// ── Insert an XP event ────────────────────────────────────────
// The DB trigger (trg_apply_xp) reads xp_config and:
//   1. Reads current xp_value for event_type
//   2. Adds it to users.xp_total
//   3. Recalculates users.level
//
// Returns the inserted row (with xp_delta filled by trigger),
// or null if the event type is inactive / not found.
export async function insertXpEvent({ userId, eventType, refId = null }) {
  const { data, error } = await supabase
    .from('xp_events')
    .insert({ user_id: userId, event_type: eventType, xp_delta: 0, ref_id: refId })
    .select('id, event_type, xp_delta, created_at')
    .single()

  if (error) {
    // Silently swallow if event type is inactive (null returned by trigger)
    if (error.code !== 'PGRST116') {
      console.warn('[xp] insertXpEvent error:', error.message)
    }
    return null
  }
  return data
}

// ── Check and award badges after an XP event ─────────────────
// Call after any action that might unlock a badge.
// Reads current player_cards and compares against thresholds.
export async function checkAndAwardBadges(userId) {
  const { data: card } = await supabase
    .from('player_cards')
    .select('badges_json, follower_count, total_games, total_wins')
    .eq('user_id', userId)
    .single()

  const { data: user } = await supabase
    .from('users')
    .select('level, xp_total')
    .eq('id', userId)
    .single()

  if (!card || !user) return []

  const existing = Array.isArray(card.badges_json) ? card.badges_json : []
  const newBadges = []

  // first_league — awarded by insertXpEvent(CREATE_LEAGUE), checked here
  if (!existing.includes('first_league')) {
    const { count } = await supabase
      .from('leagues')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
    if ((count || 0) >= 1) newBadges.push('first_league')
  }

  // streak_7
  if (!existing.includes('streak_7')) {
    const { data: u2 } = await supabase
      .from('users')
      .select('login_streak')
      .eq('id', userId)
      .single()
    if ((u2?.login_streak || 0) >= 7) newBadges.push('streak_7')
  }

  // games_100
  if (!existing.includes('games_100') && (card.total_games || 0) >= 100) {
    newBadges.push('games_100')
  }

  // social_star
  if (!existing.includes('social_star') && (card.follower_count || 0) >= 50) {
    newBadges.push('social_star')
  }

  // legend
  if (!existing.includes('legend') && (user.level || 1) >= 16) {
    newBadges.push('legend')
  }

  if (newBadges.length === 0) return []

  const updated = [...existing, ...newBadges]
  await supabase
    .from('player_cards')
    .update({ badges_json: updated })
    .eq('user_id', userId)

  return newBadges
}

// ── Get XP config (for display in admin/settings) ────────────
export async function getXpConfig() {
  const { data } = await supabase
    .from('xp_config')
    .select('event_type, xp_value, active, description')
    .order('xp_value', { ascending: false })
  return data || []
}

// ── Get user's XP history (for profile page) ─────────────────
export async function getXpHistory(userId, limit = 20) {
  const { data } = await supabase
    .from('xp_events')
    .select('id, event_type, xp_delta, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

// ── Calculate XP progress to next level ──────────────────────
export function xpProgress(xpTotal, level) {
  const base    = 100
  const toNext  = base * level
  const current = xpTotal % toNext
  const pct     = Math.min(100, Math.round(current / toNext * 100))
  return { current, toNext, pct, nextLevel: level + 1 }
}

// ── Human-readable event labels ──────────────────────────────
export const XP_LABELS = {
  create_league:   'יצירת ליגה',
  join_league:     'הצטרפות לליגה',
  record_result:   'הכנסת תוצאה',
  invite_accepted: 'הזמנת שחקן',
  login_streak_7:  'רצף כניסות שבועי',
  get_follower:    'קבלת עוקב',
  season_complete: 'סיום עונה',
}
