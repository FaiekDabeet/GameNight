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

// ── Helpers ──────────────────────────────────────────────────
function sportEmoji(sport) {
  const map = {
    football:'⚽', basketball:'🏀', padel:'🎾', tennis:'🎾',
    chess:'♟', ping_pong:'🏓', volleyball:'🏐', poker:'🃏',
    backgammon:'🎲', darts:'🎯',
  }
  return map[sport] || '🏆'
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
  const { data } = await supabase
    .from('follows')
    .select(`target_id, leagues!inner (
      id, name, sport_type, cover_url, logo_url,
      season, last_activity_at, is_locked,
      league_members(count)
    )`)
    .eq('follower_id', userId)
    .eq('target_type', 'league')
    .order('created_at', { ascending: false })
    .limit(12)
  return (data || []).map(r => r.leagues).filter(Boolean)
}

async function fetchManagedLeagues(userId) {
  const { data } = await supabase
    .from('leagues')
    .select(`id, name, sport_type, cover_url, logo_url,
      season, last_activity_at, is_locked,
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
      season, league_members(count)`)
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

// ── Card renders ─────────────────────────────────────────────
function leagueCardHtml(league, variant = 'follow') {
  const memberCount = league.league_members?.[0]?.count ?? 0
  const gameCount   = league.games?.[0]?.count ?? 0
  const locked      = league.is_locked
    ? `<span class="badge badge-locked">נעולה</span>` : ''

  const coverSection = league.cover_url
    ? `<img src="${league.cover_url}" class="card-cover" alt="${league.name}" loading="lazy">`
    : `<div class="card-cover-placeholder">${sportEmoji(league.sport_type)}</div>`

  const logoHtml = league.logo_url
    ? `<img src="${league.logo_url}" class="league-card-logo" alt="${league.name}">`
    : `<div class="league-card-logo" style="display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--bg-surface-2)">${sportEmoji(league.sport_type)}</div>`

  const statsSection = variant === 'managed' ? `
    <div class="stats-row" style="margin-top:var(--space-3)">
      <div class="stat-item">
        <div class="stat-value">${memberCount}</div>
        <div class="stat-label">שחקנים</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${gameCount}</div>
        <div class="stat-label">משחקים</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${league.season || '—'}</div>
        <div class="stat-label">עונה</div>
      </div>
    </div>` : `
    <div style="display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-2)">
      <span style="font-size:var(--text-xs);color:var(--text-tertiary)">${memberCount} שחקנים</span>
      <span style="margin-inline-start:auto;font-size:var(--text-xs);color:var(--text-tertiary)">
        ${timeAgo(league.last_activity_at)}
      </span>
    </div>`

  const footerActions = variant === 'managed' ? `
    <button class="btn btn-primary btn-sm" onclick="navigate('/league/${league.id}')">כנס</button>
    <button class="btn btn-secondary btn-sm" onclick="navigate('/league/${league.id}/edit')"
      ${league.is_locked ? 'disabled title="ליגה נעולה"' : ''}>עריכה</button>
  ` : `
    <button class="btn btn-primary btn-sm" onclick="navigate('/league/${league.id}')">כנס לליגה</button>
    <button class="btn btn-ghost btn-sm">עקוב</button>
  `

  return `
    <div class="card">
      ${coverSection}
      <div class="card-body">
        <div class="league-card-header">
          ${logoHtml}
          <div style="min-width:0;flex:1">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <h3 class="league-card-name truncate">${league.name}</h3>
              ${locked}
            </div>
            <p class="league-card-sport">${league.sport_type || 'כללי'}</p>
          </div>
        </div>
        ${statsSection}
      </div>
      <div class="card-footer">${footerActions}</div>
    </div>`
}

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
  const [followedLeagues, managedLeagues, discoverLeagues, recentGames] = await Promise.all([
    fetchFollowedLeagues(authUser.id),
    fetchManagedLeagues(authUser.id),
    fetchDiscoverLeagues(authUser.id),
    fetchRecentGames(authUser.id),
  ])

  const isPro = profile?.plan === 'pro'

  shell.setContent(`
    <div dir="rtl">

      <!-- 1. Followed leagues -->
      <section style="margin-bottom:var(--space-10)">
        <div class="section-header">
          <div>
            <h2 class="section-title">ליגות שאני עוקב</h2>
            <p class="section-sub">${followedLeagues.length} ליגות</p>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="navigate('/discover')">גלה עוד</button>
        </div>
        ${followedLeagues.length
          ? `<div class="grid-cards">${followedLeagues.map(l => leagueCardHtml(l,'follow')).join('')}</div>`
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
      <section style="margin-bottom:var(--space-10)">
        <div class="section-header">
          <div>
            <h2 class="section-title">הליגות שלי</h2>
            <p class="section-sub">ליגות שאני מנהל</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="navigate('/leagues/create')">+ צור ליגה</button>
        </div>
        ${managedLeagues.length
          ? `<div class="grid-cards">${managedLeagues.map(l => leagueCardHtml(l,'managed')).join('')}</div>`
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
      <section style="margin-bottom:var(--space-10)">
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
          ? `<div class="grid-cards">${discoverLeagues.map(l => leagueCardHtml(l,'discover')).join('')}</div>`
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
