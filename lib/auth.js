// ── lib/auth.js ──────────────────────────────────────────────
// All authentication logic in one place.
// - Google OAuth sign-in / sign-out
// - Session helpers
// - Auth state listener (used by router + AppShell)

import { supabase } from './supabase.js'

// ── Sign in with Google ──────────────────────────────────────
// Redirects to Google, then back to /auth/callback
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error('[auth] signInWithGoogle error:', error.message)
    throw error
  }
}

// ── Sign out ─────────────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('[auth] signOut error:', error.message)
    throw error
  }
  // Router will react to onAuthStateChange → redirect to /login
}

// ── Get current session (async, checks local + server) ──────
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('[auth] getSession error:', error.message)
    return null
  }
  return data.session
}

// ── Get current user (sync, from cached session) ─────────────
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}

// ── Get full user profile from public.users ──────────────────
// Returns null if not yet created (rare race condition on first login)
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      username,
      display_name,
      avatar_url,
      cover_url,
      bio,
      plan,
      locale,
      xp_total,
      level,
      login_streak,
      last_seen_at,
      player_cards (
        follower_count,
        following_count,
        badges_json,
        total_games,
        total_wins
      )
    `)
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[auth] getUserProfile error:', error.message)
    return null
  }
  return data
}

// ── Update last_seen_at + handle login streak ─────────────────
export async function touchLoginStreak(userId) {
  // Fetch current last_seen_at
  const { data: user, error } = await supabase
    .from('users')
    .select('last_seen_at, login_streak')
    .eq('id', userId)
    .single()

  if (error || !user) return

  const now       = new Date()
  const lastSeen  = new Date(user.last_seen_at)
  const hoursDiff = (now - lastSeen) / (1000 * 60 * 60)

  let newStreak = user.login_streak

  if (hoursDiff >= 20 && hoursDiff < 36) {
    // Consecutive day — increment streak
    newStreak = user.login_streak + 1
  } else if (hoursDiff >= 36) {
    // Streak broken
    newStreak = 1
  }
  // If < 20h — same day, no change

  await supabase
    .from('users')
    .update({ last_seen_at: now.toISOString(), login_streak: newStreak })
    .eq('id', userId)

  // Award XP for 7-day streak
  if (newStreak > 0 && newStreak % 7 === 0) {
    await supabase.from('xp_events').insert({
      user_id:    userId,
      event_type: 'login_streak_7',
      xp_delta:   0, // set by DB trigger
      ref_id:     null,
    })
  }
}

// ── Listen to auth state changes ─────────────────────────────
// Callback receives: { event, session }
// Events: SIGNED_IN | SIGNED_OUT | TOKEN_REFRESHED | USER_UPDATED
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      callback({ event, session })
    }
  )
  // Return unsubscribe function
  return () => subscription.unsubscribe()
}

// ── Check if user is authenticated (for route guard) ─────────
export async function isAuthenticated() {
  const session = await getSession()
  return !!session
}
