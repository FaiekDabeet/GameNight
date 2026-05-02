// ── pages/HomePage.js ────────────────────────────────────────
// Home page structure:
//   1. Followed leagues feed  (primary)
//   2. Leagues I manage       (with stats)
//   3. Recent game activity
//   4. Discover public leagues
//   5. Ad slots               (Free users only)

import { AppShell } from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { supabase } from '../lib/supabase.js'
import { navigate } from '../router.js'
import { followLeague, unfollowLeague } from '../lib/actions.js'

// ── Helpers ──────────────────────────────────────────────────
function sportEmoji(sport) {
  const map = {
    football:'⚽', basketball:'🏀', padel:'🎾', tennis:'🎾',
    chess:'♟', ping_pong:'🏓', volleyball:'🏐', poker:'🃏',
    backgammon:'🎲', darts:'🎯',
  }
  return map[sport] || '🏆'
}

// Sport → Unsplash banner image (sport-specific placeholder)
function sportBannerImg(sport) {
  const map = {
    football:   'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80&auto=format&fit=crop',
    basketball: 'https://images.unsplash.com/photo-1546519638405-a2b97b2a4de7?w=800&q=80&auto=format&fit=crop',
    ping_pong:  'https://images.unsplash.com/photo-1611251135345-18c56206b863?w=800&q=80&auto=format&fit=crop',
    chess:      'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&q=80&auto=format&fit=crop',
    volleyball: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80&auto=format&fit=crop',
    poker:      'https://images.unsplash.com/photo-1541278107931-e006523892df?w=800&q=80&auto=format&fit=crop',
    backgammon: 'https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=800&q=80&auto=format&fit=crop',
    tennis:     'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80&auto=format&fit=crop',
    padel:      'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80&auto=format&fit=crop',
    darts:      'https://images.unsplash.com/photo-1611732988895-80b5e2a7c684?w=800&q=80&auto=format&fit=crop',
  }
  return map[sport] || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80&auto=format&fit=crop'
}

// Sport → banner gradient colors
function sportBannerColors(sport) {
  const map = {
    football:   ['#1a3a2a','#0f2a1c'],
    basketball: ['#2a1a0a','#1c0f05'],
    ping_pong:  ['#1a1a2a','#0f0f1c'],
    chess:      ['#1a1510','#120f08'],
    volleyball: ['#0a1a2a','#051020'],
    poker:      ['#1a0a10','#120008'],
    backgammon: ['#1a0a1a','#120812'],
    tennis:     ['#0a1a0a','#051205'],
    padel:      ['#0a1a0a','#051205'],
    darts:      ['#1a1010','#120808'],
  }
  return map[sport] || ['#1a1a1a','#0f0f0f']
}

function avatarHtml(url, name, size = 28) {
  if (url) {
    return `<img src="${url}" width="${size}" height="${size}" loading="lazy" alt="${name}"
      style="border-radius:50%;object-fit:cover;flex-shrink:0">`
  }
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()
  return `<span style="
    width:${size}px;height:${size}px;border-radius:50%;
    background:var(--gn-orange);color:#fff;flex-shrink:0;
    display:inline-flex;align-items:center;justify-content:center;
    font-size:${Math.round(size*0.36)}px;font-weight:700">${initials}</span>`
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)    return 'עכשיו'
  if (diff < 3600)  return `לפני ${Math.floor(diff/60)} דק'`
  if (diff < 86400) return `לפני ${Math.floor(diff/3600)} שע'`
  return `לפני ${Math.floor(diff/86400)} ימים`
}

// ── Data fetchers ────────────────────────────────────────────

async function fetchFollowedLeagues(userId) {
  const { data: follows } = await supabase
    .from("follows")
    .select("target_id")
    .eq("follower_id", userId)
    .eq("target_type", "league")
    .order("created_at", { ascending: false })
    .limit(12)

  if (!follows?.length) return []
  const ids = follows.map(f => f.target_id)

  const { data } = await supabase
    .from("leagues")
    .select("id, name, sport_type, cover_url, logo_url, owner_id, season, last_activity_at, is_locked, league_members(count)")
    .in("id", ids)

  return data || []
}

async function fetchManagedLeagues(userId) {
  const { data } = await supabase
    .from('leagues')
    .select(`id, name, sport_type, cover_url, logo_url,
      owner_id, season, last_activity_at, is_locked,
      league_members(count), games(count)`)
    .eq('owner_id', userId)
    .order('last_activity_at', { ascending: false })
    .limit(6)
  return data || []
}

async function fetchDiscoverLeagues(userId) {
  const { data } = await supabase
    .from('leagues')
    .select(`id, name, sport_type, cover_url, logo_url,
      owner_id, season, league_members(count)`)
    .eq('is_public', true)
    .neq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(6)
  return data || []
}

async function fetchRecentGames(userId) {
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id')
    .eq('user_id', userId)
  if (!memberships?.length) return []
  const ids = memberships.map(m => m.league_id)
  const { data } = await supabase
    .from('games')
    .select(`id, home_score, away_score, status, played_at,
      leagues(name, sport_type),
      home:home_player_id(display_name, avatar_url),
      away:away_player_id(display_name, avatar_url)`)
    .in('league_id', ids)
    .eq('status', 'completed')
    .order('played_at', { ascending: false })
    .limit(5)
  return data || []
}

// Returns up to 4 member profiles per league for avatar strip
async function fetchLeagueMembers(leagueId) {
  const { data } = await supabase
    .from('league_members')
    .select('users(id, display_name, avatar_url)')
    .eq('league_id', leagueId)
    .limit(5)
  return (data || []).map(row => row.users).filter(Boolean)
}

// Returns set of league IDs the current user already follows
async function fetchFollowedLeagueIds(userId) {
  const { data } = await supabase
    .from('follows')
    .select('target_id')
    .eq('follower_id', userId)
    .eq('target_type', 'league')
  return new Set((data || []).map(r => r.target_id))
}

// ── Carousel CSS (injected once) ─────────────────────────────
// Injected into <head> the first time carouselSectionHtml is called.
let _carouselCssInjected = false
function injectCarouselCss() {
  if (_carouselCssInjected) return
  _carouselCssInjected = true
  const style = document.createElement('style')
  style.textContent = `
    /* ── GN Carousel ── */
    .gn-carousel-section { margin-bottom: var(--space-10, 40px); }

    .gn-persp-wrap {
      width: 100%;
      perspective: 1400px;
      overflow: hidden;
    }

    .gn-track {
      display: flex;
      gap: 18px;
      padding: 40px 0 44px;
      padding-inline: calc(50% - 38%);
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      scrollbar-width: none;
      cursor: grab;
      user-select: none;
    }
    .gn-track:active { cursor: grabbing; }
    .gn-track::-webkit-scrollbar { display: none; }

    /* ── League card ── */
    .gn-lcard {
      flex: 0 0 72%;
      background: var(--bg-surface, #22313E);
      border-radius: 20px;
      border: 1.5px solid transparent;
      scroll-snap-align: center;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      transform: scale(0.84) translateZ(-180px);
      opacity: 0.38;
      filter: blur(3px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.6s cubic-bezier(0.2,0.8,0.2,1), transform 0.15s ease;
    }
    .gn-lcard.gn-active {
      transform: scale(1) translateZ(0);
      opacity: 1;
      filter: blur(0);
      border-color: var(--gn-orange, #FF9B51);
      box-shadow:
        0 0 0 4px rgba(255,155,81,0.15),
        0 24px 64px rgba(0,0,0,0.5);
      z-index: 10;
    }
    .gn-lcard:active            { transform: scale(0.97) translateZ(-60px); }
    .gn-lcard.gn-active:active  { transform: scale(0.98) translateZ(0); }

    /* ── Banner ── */
    .gn-banner {
      height: 110px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: flex-end;
      padding: 12px 14px;
    }
    .gn-banner-bg   { position: absolute; inset: 0; }
    .gn-banner-img  {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover; object-position: center;
      opacity: 0.52;
      transition: opacity 0.4s;
      pointer-events: none;
      user-select: none;
    }
    .gn-lcard.gn-active .gn-banner-img { opacity: 0.72; }
    .gn-banner-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.08) 100%);
    }
    .gn-banner-row {
      position: relative; z-index: 1;
      display: flex; align-items: flex-end;
      justify-content: space-between; width: 100%;
    }
    .gn-sport-icon { font-size: 36px; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5)); }
    .gn-status-badge {
      font-size: 10px; font-weight: 700;
      padding: 3px 9px; border-radius: 20px;
      letter-spacing: 0.4px;
    }
    .gn-status-active   { background:rgba(30,180,100,0.25); color:#4DD991; border:1px solid rgba(77,217,145,0.4); }
    .gn-status-upcoming { background:rgba(255,155,81,0.20); color:#FF9B51; border:1px solid rgba(255,155,81,0.4); }
    .gn-status-done     { background:rgba(255,255,255,0.10); color:#7A95A8; border:1px solid rgba(255,255,255,0.15); }

    /* ── Card body ── */
    .gn-cbody { padding: 14px 16px 16px; }
    .gn-league-name {
      font-size: 17px; font-weight: 800;
      color: var(--text-primary, #EAEFEF);
      line-height: 1.2; margin-bottom: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .gn-league-meta {
      font-size: 11px; color: var(--text-tertiary, #7A95A8);
      margin-bottom: 12px;
      display: flex; align-items: center; gap: 5px;
    }
    .gn-meta-sep { color: #4E6475; }

    /* ── Stats strip ── */
    .gn-stats {
      display: grid; grid-template-columns: repeat(3,1fr);
      gap: 1px; background: rgba(255,255,255,0.06);
      border-radius: 10px; overflow: hidden; margin-bottom: 12px;
    }
    .gn-stat {
      background: rgba(255,255,255,0.03);
      padding: 7px 4px; text-align: center;
    }
    .gn-stat-val { font-size: 16px; font-weight: 800; color: var(--text-primary, #EAEFEF); line-height: 1; }
    .gn-stat-lbl { font-size: 10px; color: var(--text-tertiary, #7A95A8); margin-top: 2px; }

    /* ── Footer ── */
    .gn-card-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 2px;
    }
    .gn-avatars { display: flex; }
    .gn-av {
      width: 24px; height: 24px; border-radius: 50%;
      border: 2px solid var(--bg-surface, #22313E);
      margin-left: -6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; font-weight: 700; flex-shrink: 0;
      overflow: hidden;
    }
    .gn-av:first-child { margin-left: 0; }
    .gn-av img { width:100%; height:100%; object-fit:cover; }
    .gn-members-txt { font-size: 11px; color: var(--text-tertiary, #7A95A8); margin-right: 6px; }

    /* ── 3-dot menu ── */
    .gn-menu-wrap {
      position: absolute; top: 9px; left: 9px; z-index: 20;
    }
    .gn-menu-btn {
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(0,0,0,0.45); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(6px);
      transition: background 0.2s, transform 0.15s;
      color: #EAEFEF;
    }
    .gn-menu-btn:hover  { background: rgba(0,0,0,0.65); }
    .gn-menu-btn:active { transform: scale(0.9); }
    .gn-menu-btn svg { pointer-events: none; }

    .gn-dropdown {
      position: absolute; top: 36px; left: 0;
      background: #2A3D4E;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 13px; overflow: hidden; min-width: 165px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.45);
      opacity: 0; transform: scale(0.88) translateY(-6px);
      transform-origin: top left; pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .gn-dropdown.gn-open {
      opacity: 1; transform: scale(1) translateY(0); pointer-events: auto;
    }
    .gn-menu-item {
      display: flex; align-items: center; gap: 9px;
      padding: 10px 13px; font-size: 13px; font-weight: 600;
      font-family: inherit; color: #EAEFEF;
      cursor: pointer; border: none; background: transparent;
      width: 100%; text-align: right; transition: background 0.15s; direction: rtl;
    }
    .gn-menu-item:hover { background: rgba(255,255,255,0.07); }
    .gn-menu-item.gn-danger { color: #E8735A; }
    .gn-menu-item svg { flex-shrink: 0; opacity: 0.75; }
    .gn-menu-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 2px 0; }

    /* ── Dots ── */
    .gn-dots {
      display: flex; justify-content: center; gap: 7px; margin-top: 4px;
    }
    .gn-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: rgba(255,255,255,0.15); border: none; cursor: pointer;
      transition: all 0.32s cubic-bezier(0.34,1.56,0.64,1); padding: 0;
    }
    .gn-dot.gn-dot-on { width: 24px; border-radius: 10px; background: var(--gn-orange, #FF9B51); }

    /* ── Empty CTA card ── */
    .gn-card-empty {
      flex: 0 0 72%;
      background: var(--bg-surface, #22313E);
      border-radius: 20px;
      border: 1.5px dashed rgba(255,155,81,0.25);
      scroll-snap-align: center;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 14px; padding: 32px 24px; text-align: center;
      transform: scale(0.84) translateZ(-180px);
      opacity: 0.38; filter: blur(3px);
      transition: all 0.6s cubic-bezier(0.2,0.8,0.2,1);
    }
    .gn-card-empty.gn-active {
      transform: scale(1) translateZ(0); opacity: 1; filter: blur(0);
      border-color: rgba(255,155,81,0.45);
      box-shadow: 0 0 0 4px rgba(255,155,81,0.12), 0 20px 56px rgba(0,0,0,0.4);
    }
    .gn-empty-icon {
      width: 56px; height: 56px; border-radius: 50%;
      background: rgba(255,155,81,0.12);
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
    .gn-empty-title { font-size: 16px; font-weight: 800; color: var(--text-primary, #EAEFEF); }
    .gn-empty-sub   { font-size: 12px; color: var(--text-tertiary, #7A95A8); line-height: 1.6; max-width: 200px; }

    /* ── Ripple ── */
    .gn-ripple {
      position: absolute; border-radius: 50%;
      background: rgba(255,155,81,0.16);
      transform: scale(0); animation: gnRip 0.6s linear; pointer-events: none;
    }
    @keyframes gnRip { to { transform: scale(4); opacity: 0; } }

    /* ── Mobile ── */
    @media (max-width: 480px) {
      .gn-track { padding-inline: calc(50% - 43%); gap: 12px; padding-top: 30px; padding-bottom: 34px; }
      .gn-lcard, .gn-card-empty { flex: 0 0 84%; }
      .gn-lcard { transform: scale(0.92) translateZ(-80px); }
    }
    @media (min-width: 481px) and (max-width: 700px) {
      .gn-lcard, .gn-card-empty { flex: 0 0 78%; }
    }
  `
  document.head.appendChild(style)
}

// ── Carousel state registry ───────────────────────────────────
// Each carousel instance gets its own state object keyed by a uid.
const _carousels = {}
let _gnOpenMenu = null

// Close any open dropdown when clicking outside
document.addEventListener('click', () => {
  if (_gnOpenMenu) { _gnOpenMenu.classList.remove('gn-open'); _gnOpenMenu = null }
})

function gnToggleMenu(e, btn) {
  e.stopPropagation()
  const dd = btn.nextElementSibling
  if (_gnOpenMenu && _gnOpenMenu !== dd) _gnOpenMenu.classList.remove('gn-open')
  dd.classList.toggle('gn-open')
  _gnOpenMenu = dd.classList.contains('gn-open') ? dd : null
}

function gnMenuAction(e, action, leagueId) {
  e.stopPropagation()
  if (_gnOpenMenu) { _gnOpenMenu.classList.remove('gn-open'); _gnOpenMenu = null }
  if (action === 'edit')    navigate(`/league/${leagueId}/edit`)
  else if (action === 'update')  navigate(`/league/${leagueId}/update`)
  else if (action === 'follow')  navigate(`/league/${leagueId}`)   // toggle follow — handled by league page
  else if (action === 'remove') {
    if (confirm('להסיר את הליגה?')) alert(`הסרת ליגה ${leagueId}`)
  }
}

// Expose to inline onclick (called from injected HTML strings)
window._gnToggleMenu   = gnToggleMenu
window._gnMenuAction   = gnMenuAction
window._gnToggleFollow = async function(btn, leagueId, userId) {
  const isFollowing = btn.dataset.following === 'true'
  btn.disabled = true
  try {
    if (isFollowing) {
      await unfollowLeague({ followerId: userId, leagueId })
      btn.dataset.following = 'false'
      btn.textContent = 'עקוב'
      btn.classList.remove('btn-secondary')
      btn.classList.add('btn-ghost')
    } else {
      await followLeague({ followerId: userId, leagueId })
      btn.dataset.following = 'true'
      btn.innerHTML = '✓ עוקב'
      btn.classList.remove('btn-ghost')
      btn.classList.add('btn-secondary')
    }
  } catch (e) {
    console.error('follow toggle failed', e)
  } finally {
    btn.disabled = false
  }
}

function gnAddRipple(e, el) {
  const r = document.createElement('span')
  r.className = 'gn-ripple'
  const d = Math.max(el.offsetWidth, el.offsetHeight)
  const rect = el.getBoundingClientRect()
  const cx = (e.clientX ?? rect.left + rect.width  / 2) - rect.left - d / 2
  const cy = (e.clientY ?? rect.top  + rect.height / 2) - rect.top  - d / 2
  r.style.cssText = `width:${d}px;height:${d}px;left:${cx}px;top:${cy}px`
  el.appendChild(r)
  r.addEventListener('animationend', () => r.remove())
}

function gnInitCarousel(uid) {
  const track = document.getElementById(`gn-track-${uid}`)
  if (!track) return

  const allCards = [...track.querySelectorAll('.gn-lcard, .gn-card-empty')]
  const leagueCards = [...track.querySelectorAll('.gn-lcard')]
  const dots = [...document.querySelectorAll(`#gn-dots-${uid} .gn-dot`)]
  let isDragging = false, startX = 0, startScroll = 0, hasDragged = false

  function scrollTo(idx) {
    const target = allCards[idx]
    if (!target) return
    const off = target.offsetLeft - (track.offsetWidth - target.offsetWidth) / 2
    track.scrollTo({ left: off, behavior: 'smooth' })
  }

  function updateActive() {
    const cx = track.getBoundingClientRect().left + track.offsetWidth / 2
    let best = 0, bestDist = Infinity
    allCards.forEach((c, i) => {
      const r = c.getBoundingClientRect()
      const dist = Math.abs(cx - (r.left + r.width / 2))
      if (dist < bestDist) { bestDist = dist; best = i }
    })
    allCards.forEach((c, i) => c.classList.toggle('gn-active', i === best))
    dots.forEach((d, i) => d.classList.toggle('gn-dot-on', i === best))
  }

  // Dots click
  dots.forEach((d, i) => { d.onclick = () => scrollTo(i) })

  // Mouse drag
  track.addEventListener('mousedown', e => {
    isDragging = true; hasDragged = false
    startX = e.pageX; startScroll = track.scrollLeft
    track.style.scrollBehavior = 'auto'
    track.style.scrollSnapType = 'none'
    const card = e.target.closest('.gn-lcard')
    if (card) gnAddRipple(e, card)
  })
  window.addEventListener('mousemove', e => {
    if (!isDragging) return
    const dx = (e.pageX - startX) * 1.4
    if (Math.abs(dx) > 4) hasDragged = true
    track.scrollLeft = startScroll - dx
  })
  window.addEventListener('mouseup', e => {
    if (!isDragging) return
    isDragging = false
    track.style.scrollBehavior = 'smooth'
    track.style.scrollSnapType = 'x mandatory'
    if (!hasDragged) {
      const card = e.target.closest('.gn-lcard')
      if (card) scrollTo(leagueCards.indexOf(card))
    }
    setTimeout(updateActive, 380)
  })

  // Touch
  track.addEventListener('touchend', () => setTimeout(updateActive, 380), { passive: true })
  track.addEventListener('scroll', () => requestAnimationFrame(updateActive))

  // Init
  scrollTo(0)
  setTimeout(updateActive, 80)
}

// ── Card renders ─────────────────────────────────────────────

/**
 * CHANGED: leagueCardHtml now renders the full V2 carousel card
 * with banner image, stats-strip, 3-dot menu, and member avatars.
 * The `variant` param controls which footer actions appear.
 * Everything else in the file is untouched.
 */
function leagueCardHtml(league, variant = 'follow', currentUserId = null, members = [], isFollowed = false) {
  const memberCount = league.league_members?.[0]?.count ?? 0
  const gameCount   = league.games?.[0]?.count ?? 0
  const locked      = league.is_locked
  const isOwner     = currentUserId && league.owner_id === currentUserId

  const colors     = sportBannerColors(league.sport_type)
  const bannerImg  = league.cover_url || sportBannerImg(league.sport_type)
  const emoji      = sportEmoji(league.sport_type)

  // Status badge
  let statusCls = 'gn-status-active', statusTxt = 'פעילה'
  if (locked) { statusCls = 'gn-status-done'; statusTxt = 'הסתיימה' }

  // Follow button — shown only for non-owners on follow/discover variants
  const followBtn = (!isOwner && variant !== 'managed') ? `
    <button
      class="btn btn-sm ${isFollowed ? 'btn-secondary' : 'btn-ghost'}"
      data-following="${isFollowed}"
      onclick="_gnToggleFollow(this,'${league.id}','${currentUserId}')">
      ${isFollowed ? '✓ עוקב' : 'עקוב'}
    </button>` : ''

  // Footer actions per variant
  const footerActions = variant === 'managed' ? `
    <button class="btn btn-primary btn-sm" onclick="navigate('/league/${league.id}')">כנס</button>
    <button class="btn btn-secondary btn-sm" onclick="navigate('/league/${league.id}/edit')"
      ${locked ? 'disabled title="ליגה נעולה"' : ''}>עריכה</button>
  ` : `
    <button class="btn btn-primary btn-sm" onclick="navigate('/league/${league.id}')">כנס לליגה</button>
    ${followBtn}
  `

  // Real member avatar strip (up to 4) from fetched profiles
  const shownMembers = members.slice(0, 4)
  const avatarStrip = `
    <div style="display:flex;align-items:center">
      <div class="gn-avatars">
        ${shownMembers.map(m => m.avatar_url
          ? `<div class="gn-av"><img src="${m.avatar_url}" alt="${m.display_name || ''}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`
          : `<div class="gn-av" style="background:var(--gn-orange);color:#fff;font-size:9px;font-weight:700">
              ${(m.display_name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
            </div>`
        ).join('')}
        ${memberCount > 4 ? `<div class="gn-av" style="background:#324455;color:#7A95A8;font-size:9px">+${memberCount - 4}</div>` : ''}
      </div>
      <span class="gn-members-txt">${memberCount} שחקנים</span>
    </div>`

  return `
    <div class="gn-lcard" data-league-id="${league.id}">

      ${isOwner ? `
      <!-- 3-dot menu — owners only -->
      <div class="gn-menu-wrap">
        <button class="gn-menu-btn" onclick="_gnToggleMenu(event,this)" title="אפשרויות">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
        <div class="gn-dropdown">
          <button class="gn-menu-item" onclick="_gnMenuAction(event,'update','${league.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4C7.58 4 4 7.58 4 12s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            עדכון טבלה
          </button>
          <button class="gn-menu-item" onclick="_gnMenuAction(event,'edit','${league.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            עדכון פרטי ליגה
          </button>
          <div class="gn-menu-divider"></div>
          <button class="gn-menu-item gn-danger" onclick="_gnMenuAction(event,'remove','${league.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            מחיקת ליגה
          </button>
        </div>
      </div>` : ''}

      <!-- Banner -->
      <div class="gn-banner">
        <div class="gn-banner-bg" style="background:linear-gradient(135deg,${colors[0]},${colors[1]})"></div>
        <img class="gn-banner-img" src="${bannerImg}" alt="${league.name}" loading="lazy" draggable="false">
        <div class="gn-banner-overlay"></div>
        <div class="gn-banner-row">
          <div class="gn-sport-icon">${emoji}</div>
          <div class="gn-status-badge ${statusCls}">${statusTxt}</div>
        </div>
      </div>

      <!-- Body -->
      <div class="gn-cbody">
        <div class="gn-league-name">${league.name}</div>
        <div class="gn-league-meta">
          <span>${league.sport_type || 'כללי'}</span>
          <span class="gn-meta-sep">·</span>
          <span>${league.season || '—'}</span>
          ${variant === 'managed' ? `<span class="gn-meta-sep">·</span><span style="color:var(--gn-orange,#FF9B51)">${gameCount} משחקים</span>` : ''}
        </div>

        <!-- Stats strip -->
        <div class="gn-stats">
          <div class="gn-stat">
            <div class="gn-stat-val">${memberCount}</div>
            <div class="gn-stat-lbl">שחקנים</div>
          </div>
          <div class="gn-stat">
            <div class="gn-stat-val">${gameCount || '—'}</div>
            <div class="gn-stat-lbl">משחקים</div>
          </div>
          <div class="gn-stat">
            <div class="gn-stat-val" style="font-size:11px;padding-top:3px">${timeAgo(league.last_activity_at) || '—'}</div>
            <div class="gn-stat-lbl">פעילות אחרונה</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="gn-card-footer">
          ${avatarStrip}
          <div style="display:flex;gap:6px">${footerActions}</div>
        </div>
      </div>
    </div>`
}

/**
 * CHANGED: carouselSectionHtml wraps a list of league cards in the
 * V2 carousel shell (perspective wrap, track, dots, empty CTA card).
 * Replaces the previous `<div class="grid-cards">` wrapper.
 */
let _carouselUid = 0
function carouselSectionHtml(leagues, variant, emptyCtaLabel, emptyCtaHref, currentUserId = null, membersMap = {}, followedIds = new Set()) {
  injectCarouselCss()
  const uid = `c${++_carouselUid}`

  const cards = leagues.map(l => leagueCardHtml(
    l, variant, currentUserId,
    membersMap[l.id] || [],
    followedIds.has(l.id)
  )).join('')

  // Empty CTA card — always appended at end of track
  const ctaCard = `
    <div class="gn-card-empty">
      <div class="gn-empty-icon">🔭</div>
      <div class="gn-empty-title">זה הכל לעכשיו!</div>
      <div class="gn-empty-sub">רוצים למצוא ליגות נוספות?</div>
      <button class="btn btn-primary btn-sm" onclick="navigate('${emptyCtaHref}')">${emptyCtaLabel}</button>
    </div>`

  // One dot per card + one for CTA
  const dotCount = leagues.length + 1
  const dots = Array.from({ length: dotCount }, () => `<button class="gn-dot"></button>`).join('')

  // Schedule init after render
  setTimeout(() => gnInitCarousel(uid), 0)

  return `
    <div class="gn-persp-wrap">
      <div class="gn-track" id="gn-track-${uid}">
        ${cards}
        ${ctaCard}
      </div>
    </div>
    <div class="gn-dots" id="gn-dots-${uid}">${dots}</div>`
}

// ── Unchanged helpers ─────────────────────────────────────────

function gameRowHtml(game) {
  const home = game.home?.display_name || 'בית'
  const away = game.away?.display_name || 'אורח'
  return `
    <div style="display:flex;align-items:center;gap:var(--space-3);
      padding:var(--space-3) 0;border-bottom:1px solid var(--border-light)">
      <div style="flex:1;display:flex;align-items:center;gap:var(--space-2);justify-content:flex-end">
        ${avatarHtml(game.home?.avatar_url, home, 28)}
        <span style="font-size:var(--text-sm);font-weight:600;color:var(--text-primary)">${home}</span>
      </div>
      <div style="min-width:60px;text-align:center;font-size:var(--text-md);
        font-weight:700;color:var(--text-primary);
        background:var(--bg-surface-2);border-radius:var(--radius-sm);padding:4px 10px">
        ${game.home_score ?? '—'} : ${game.away_score ?? '—'}
      </div>
      <div style="flex:1;display:flex;align-items:center;gap:var(--space-2)">
        ${avatarHtml(game.away?.avatar_url, away, 28)}
        <span style="font-size:var(--text-sm);font-weight:600;color:var(--text-primary)">${away}</span>
      </div>
      <span style="font-size:10px;color:var(--text-tertiary);white-space:nowrap">
        ${timeAgo(game.played_at)}
      </span>
    </div>`
}

function emptyCard(icon, title, desc, cta) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      ${cta ? `<button class="btn btn-primary btn-sm"
        style="margin-top:var(--space-4)"
        onclick="${cta.action}">${cta.label}</button>` : ''}
    </div>`
}

function adSlot() {
  return `
    <div class="ad-slot ad-slot-inline" role="complementary" aria-label="פרסומת">
      <span>פרסומת</span>
      <span class="ad-slot-label">Ad</span>
    </div>`
}

function skeletonSection(count) {
  const cards = Array.from({ length: count }, () => `
    <div class="card">
      <div class="skeleton" style="height:120px"></div>
      <div class="card-body">
        <div class="skeleton" style="height:15px;width:55%;margin-bottom:8px;border-radius:4px"></div>
        <div class="skeleton" style="height:12px;width:35%;border-radius:4px"></div>
      </div>
    </div>`).join('')
  return `
    <div style="margin-bottom:var(--space-8)">
      <div class="skeleton" style="height:18px;width:140px;margin-bottom:var(--space-4);border-radius:4px"></div>
      <div class="grid-cards">${cards}</div>
    </div>`
}

// ── Page render ──────────────────────────────────────────────
export async function render(root) {
  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'home' })
  await shell.mount(root)
  window.navigate = navigate

  // Show skeleton immediately
  shell.setContent(`<div dir="rtl">${skeletonSection(3)}${skeletonSection(2)}</div>`)

  // Fetch all in parallel
  const [followedLeagues, managedLeagues, discoverLeagues, recentGames, followedIds] = await Promise.all([
    fetchFollowedLeagues(authUser.id),
    fetchManagedLeagues(authUser.id),
    fetchDiscoverLeagues(authUser.id),
    fetchRecentGames(authUser.id),
    fetchFollowedLeagueIds(authUser.id),
  ])

  // Fetch member profiles for all leagues (for avatar strips)
  const allLeagues = [...followedLeagues, ...managedLeagues, ...discoverLeagues]
  const uniqueIds  = [...new Set(allLeagues.map(l => l.id))]
  const memberArrays = await Promise.all(uniqueIds.map(id => fetchLeagueMembers(id)))
  const membersMap = Object.fromEntries(uniqueIds.map((id, i) => [id, memberArrays[i]]))

  const isPro = profile?.plan === 'pro'

  shell.setContent(`
    <div dir="rtl">

      <!-- 1. Followed leagues -->
      <section class="gn-carousel-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">ליגות שאני עוקב</h2>
            <p class="section-sub">${followedLeagues.length} ליגות</p>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('/discover')">גלה עוד</button>
        </div>
        ${followedLeagues.length
          ? carouselSectionHtml(followedLeagues, 'follow', 'גלה ליגות', '/discover', authUser.id, membersMap, followedIds)
          : emptyCard(
              `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
              'עדיין לא עוקב אחר ליגות',
              'מצא ליגות מעניינות ולחץ עקוב',
              { label: 'גלה ליגות', action: "navigate('/discover')" }
            )
        }
      </section>

      ${!isPro ? adSlot() : ''}

      <!-- 2. My managed leagues -->
      <section class="gn-carousel-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">הליגות שלי</h2>
            <p class="section-sub">ליגות שאני מנהל</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="navigate('/leagues/create')">+ צור ליגה</button>
        </div>
        ${managedLeagues.length
          ? carouselSectionHtml(managedLeagues, 'managed', 'צור ליגה חדשה', '/leagues/create', authUser.id, membersMap, followedIds)
          : emptyCard(
              `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`,
              'עדיין לא יצרת ליגה',
              'צור את הליגה הראשונה שלך בחינם',
              { label: 'צור ליגה', action: "navigate('/leagues/create')" }
            )
        }
      </section>

      <!-- 3. Recent activity -->
      ${recentGames.length ? `
        <section style="margin-bottom:var(--space-10)">
          <div class="section-header">
            <h2 class="section-title">פעילות אחרונה</h2>
          </div>
          <div class="card">
            <div class="card-body" style="padding-bottom:0">
              ${recentGames.map(gameRowHtml).join('')}
            </div>
            <div class="card-footer" style="justify-content:center">
              <button class="btn btn-ghost btn-sm" onclick="navigate('/games')">כל המשחקים</button>
            </div>
          </div>
        </section>` : ''
      }

      <!-- 4. Discover -->
      <section class="gn-carousel-section">
        <div class="section-header">
          <div>
            <h2 class="section-title">גלה ליגות</h2>
            <p class="section-sub">ליגות פעילות להצטרפות</p>
          </div>
          <a href="/discover" class="btn btn-ghost btn-sm">הכל</a>
        </div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-4)">
          <span class="chip active">הכל</span>
          <span class="chip">⚽ כדורגל</span>
          <span class="chip">🏀 כדורסל</span>
          <span class="chip">♟ שחמט</span>
          <span class="chip">🎾 פאדל</span>
        </div>
        ${discoverLeagues.length
          ? carouselSectionHtml(discoverLeagues, 'discover', 'גלה עוד ליגות', '/discover', authUser.id, membersMap, followedIds)
          : `<p style="font-size:var(--text-sm);color:var(--text-tertiary);text-align:center;padding:var(--space-6) 0">אין ליגות פומביות כרגע</p>`
        }
      </section>

      ${!isPro ? adSlot() : ''}

    </div>
  `)

  // Chip filter interaction
  root.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      root.querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
    })
  })
}
