// ── pages/DiscoverPage.js ────────────────────────────────────
// Discover public leagues:
//   - Search by name
//   - Filter by sport type
//   - Sort by newest / most active / most members
//   - Join by invite code
//   - Follow league

import { AppShell }    from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { followLeague, unfollowLeague, joinLeagueByCode } from '../lib/actions.js'
import { supabase }    from '../lib/supabase.js'
import { navigate }    from '../router.js'

const SPORTS = [
  { value: '',            label: 'הכל' },
  { value: 'football',   label: '⚽ כדורגל' },
  { value: 'basketball', label: '🏀 כדורסל' },
  { value: 'padel',      label: '🎾 פאדל' },
  { value: 'tennis',     label: '🎾 טניס' },
  { value: 'chess',      label: '♟ שחמט' },
  { value: 'ping_pong',  label: '🏓 פינג פונג' },
  { value: 'volleyball', label: '🏐 כדורעף' },
  { value: 'poker',      label: '🃏 פוקר' },
  { value: 'backgammon', label: '🎲 שש-בש' },
]

const SORT_OPTIONS = [
  { value: 'created_at',       label: 'חדשות ביותר' },
  { value: 'last_activity_at', label: 'פעילות אחרונה' },
  { value: 'members',          label: 'הכי פופולריות' },
]

function sportEmoji(s) {
  return ({ football:'⚽', basketball:'🏀', padel:'🎾', tennis:'🎾',
    chess:'♟', ping_pong:'🏓', volleyball:'🏐', poker:'🃏',
    backgammon:'🎲', darts:'🎯' }[s] || '🏆')
}

function timeAgo(d) {
  if (!d) return ''
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 3600)  return `לפני ${Math.floor(s/60)||1} דק'`
  if (s < 86400) return `לפני ${Math.floor(s/3600)} שע'`
  return `לפני ${Math.floor(s/86400)} ימים`
}

// ── Fetch leagues ─────────────────────────────────────────────
async function fetchLeagues({ search = '', sport = '', sortBy = 'created_at',
  page = 0, limit = 12, userId }) {

  let query = supabase
    .from('leagues')
    .select(`id, name, sport_type, cover_url, logo_url, season,
      last_activity_at, is_locked, created_at,
      league_members(count)`, { count: 'exact' })
    .eq('is_public', true)
    .neq('owner_id', userId)

  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }
  if (sport) {
    query = query.eq('sport_type', sport)
  }

  // Sort
  if (sortBy === 'members') {
    // Sort by member count — done client-side after fetch
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order(sortBy, { ascending: false })
  }

  query = query.range(page * limit, page * limit + limit - 1)

  const { data, count, error } = await query
  if (error) { console.error('[Discover]', error); return { leagues: [], total: 0 } }

  let leagues = data || []
  if (sortBy === 'members') {
    leagues = leagues.sort((a, b) =>
      (b.league_members?.[0]?.count || 0) - (a.league_members?.[0]?.count || 0))
  }
  return { leagues, total: count || 0 }
}

async function fetchFollowedLeagueIds(userId) {
  const { data } = await supabase
    .from('follows')
    .select('target_id')
    .eq('follower_id', userId)
    .eq('target_type', 'league')
  return new Set((data || []).map(r => r.target_id))
}

// ── League card ───────────────────────────────────────────────
function leagueCard(league, isFollowing, userId) {
  const count = league.league_members?.[0]?.count || 0
  return `
    <div class="card" style="display:flex;flex-direction:column">
      <!-- Cover -->
      <div style="position:relative;cursor:pointer"
        onclick="navigate('/league/${league.id}')">
        ${league.cover_url
          ? `<img src="${league.cover_url}" loading="lazy" alt="${league.name}"
              class="card-cover">`
          : `<div class="card-cover-placeholder"
              style="font-size:52px">${sportEmoji(league.sport_type)}</div>`}
        ${league.is_locked
          ? `<div style="position:absolute;top:8px;inset-inline-end:8px">
              <span class="badge badge-locked">🔒</span></div>` : ''}
      </div>

      <!-- Body -->
      <div class="card-body" style="flex:1;cursor:pointer"
        onclick="navigate('/league/${league.id}')">
        <div class="league-card-header">
          ${league.logo_url
            ? `<img src="${league.logo_url}" class="league-card-logo"
                alt="${league.name}" loading="lazy">`
            : `<div class="league-card-logo"
                style="display:flex;align-items:center;justify-content:center;
                  font-size:18px;background:var(--bg-surface-2)">
                ${sportEmoji(league.sport_type)}</div>`}
          <div style="min-width:0;flex:1">
            <h3 class="league-card-name truncate">${league.name}</h3>
            <p class="league-card-sport">${league.sport_type || 'כללי'}</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-3);
          margin-top:var(--space-2);font-size:var(--text-xs);color:var(--text-tertiary)">
          <span>👥 ${count} שחקנים</span>
          <span style="margin-inline-start:auto">${timeAgo(league.last_activity_at)}</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="card-footer">
        <button class="btn btn-primary btn-sm"
          onclick="navigate('/league/${league.id}')">כנס</button>
        <button class="btn ${isFollowing ? 'btn-secondary' : 'btn-ghost'} btn-sm"
          id="follow-btn-${league.id}"
          onclick="toggleLeagueFollow('${league.id}', ${isFollowing})">
          ${isFollowing ? '✓ עוקב' : '+ עקוב'}
        </button>
      </div>
    </div>`
}

// ── Main render ───────────────────────────────────────────────
export async function render(root) {
  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile  = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'discover' })
  await shell.mount(root)
  window.navigate = navigate

  // State
  let search     = ''
  let sport      = ''
  let sortBy     = 'created_at'
  let page       = 0
  let totalCount = 0
  let leagues    = []
  let followedIds = new Set()
  let isLoading  = false
  let searchTimer = null
  const LIMIT    = 12

  const setLoading = (v) => {
    isLoading = v
    const grid = document.getElementById('league-grid')
    const btn  = document.getElementById('load-more-btn')
    if (grid && v) grid.style.opacity = '0.5'
    if (grid && !v) grid.style.opacity = '1'
    if (btn) btn.disabled = v
  }

  const renderGrid = () => {
    const grid = document.getElementById('league-grid')
    const info = document.getElementById('result-info')
    const more = document.getElementById('load-more-wrap')
    if (!grid) return

    grid.innerHTML = leagues.length === 0 ? `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <h3>לא נמצאו ליגות</h3>
        <p>נסה מילת חיפוש אחרת או שנה את הסינון</p>
      </div>` : leagues.map(l =>
        leagueCard(l, followedIds.has(l.id), authUser.id)
      ).join('')

    if (info) {
      info.textContent = `${totalCount} ליגות נמצאו`
    }
    if (more) {
      const hasMore = leagues.length < totalCount
      more.style.display = hasMore ? 'flex' : 'none'
    }
  }

  const loadLeagues = async (reset = true) => {
    if (isLoading) return
    setLoading(true)
    if (reset) { page = 0; leagues = [] }

    const { leagues: newLeagues, total } = await fetchLeagues({
      search, sport, sortBy, page, limit: LIMIT, userId: authUser.id
    })

    totalCount = total
    leagues    = reset ? newLeagues : [...leagues, ...newLeagues]

    if (reset) {
      followedIds = await fetchFollowedLeagueIds(authUser.id)
    }

    renderGrid()
    setLoading(false)
  }

  // ── Initial render ────────────────────────────────────────
  shell.setContent(`
    <div dir="rtl">

      <!-- Header -->
      <div style="margin-bottom:var(--space-5)">
        <h1 style="font-size:var(--text-xl);font-weight:700;
          color:var(--text-primary);margin-bottom:4px">גלה ליגות</h1>
        <p style="font-size:var(--text-sm);color:var(--text-tertiary)" id="result-info">
          טוען...
        </p>
      </div>

      <!-- Search + sort row -->
      <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-4);
        flex-wrap:wrap;align-items:center">

        <!-- Search input -->
        <div style="flex:1;min-width:200px;position:relative">
          <svg style="position:absolute;top:50%;inset-inline-start:12px;
            transform:translateY(-50%);pointer-events:none;
            color:var(--text-tertiary)"
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="7" cy="7" r="5"/><path d="m12 12 3 3"/>
          </svg>
          <input type="search" id="search-input" placeholder="חפש ליגה..."
            dir="rtl" autocomplete="off"
            style="width:100%;padding:10px var(--space-3) 10px 36px;
              border-radius:var(--radius-md);border:1.5px solid var(--border-mid);
              background:var(--bg-surface);color:var(--text-primary);
              font-family:var(--font-base);font-size:14px;
              transition:border-color var(--transition-fast)"
            onfocus="this.style.borderColor='var(--gn-orange)'"
            onblur="this.style.borderColor='var(--border-mid)'"
            oninput="onSearch(this.value)">
        </div>

        <!-- Sort select -->
        <select id="sort-select"
          style="padding:10px var(--space-3);border-radius:var(--radius-md);
            border:1.5px solid var(--border-mid);background:var(--bg-surface);
            color:var(--text-primary);font-family:var(--font-base);font-size:13px;
            cursor:pointer"
          onchange="onSort(this.value)">
          ${SORT_OPTIONS.map(o =>
            `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>

      <!-- Sport filter chips -->
      <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;
        margin-bottom:var(--space-5);overflow-x:auto;padding-bottom:4px">
        ${SPORTS.map(s => `
          <button class="chip ${s.value === '' ? 'active' : ''}"
            data-sport="${s.value}" id="chip-${s.value || 'all'}"
            onclick="onSport('${s.value}')">
            ${s.label}
          </button>`).join('')}
      </div>

      <!-- Join by code -->
      <div class="card" style="margin-bottom:var(--space-5)">
        <div class="card-body">
          <h3 style="font-size:14px;font-weight:600;color:var(--text-primary);
            margin-bottom:var(--space-3)">הצטרף בקוד הזמנה</h3>
          <div style="display:flex;gap:var(--space-2)">
            <input type="text" id="invite-code-input"
              placeholder="הכנס קוד (6 תווים)"
              maxlength="6" dir="ltr"
              style="flex:1;padding:10px var(--space-3);text-transform:uppercase;
                letter-spacing:4px;font-size:16px;font-weight:700;
                border-radius:var(--radius-md);border:1.5px solid var(--border-mid);
                background:var(--bg-surface);color:var(--text-primary);
                font-family:var(--font-mono);text-align:center;
                transition:border-color var(--transition-fast)"
              onfocus="this.style.borderColor='var(--gn-orange)'"
              onblur="this.style.borderColor='var(--border-mid)'"
              oninput="this.value=this.value.toUpperCase()"
              onkeydown="if(event.key==='Enter')joinByCode()">
            <button class="btn btn-primary" id="join-code-btn"
              onclick="joinByCode()">הצטרף</button>
          </div>
          <div id="join-error" style="display:none;margin-top:var(--space-2);
            font-size:12px;color:#dc3545"></div>
          <div id="join-success" style="display:none;margin-top:var(--space-2);
            font-size:12px;color:#276749"></div>
        </div>
      </div>

      <!-- Grid -->
      <div id="league-grid" class="grid-cards" style="transition:opacity 0.2s">
        ${Array(6).fill(`
          <div class="card">
            <div class="skeleton" style="height:120px"></div>
            <div class="card-body">
              <div class="skeleton" style="height:14px;width:55%;
                margin-bottom:8px;border-radius:4px"></div>
              <div class="skeleton" style="height:12px;width:35%;
                border-radius:4px"></div>
            </div>
          </div>`).join('')}
      </div>

      <!-- Load more -->
      <div id="load-more-wrap" style="display:none;justify-content:center;
        margin-top:var(--space-6)">
        <button id="load-more-btn" class="btn btn-secondary"
          onclick="loadMore()">טען עוד ליגות</button>
      </div>

    </div>`)

  // Initial data load
  await loadLeagues()

  // ── Event handlers ────────────────────────────────────────
  window.onSearch = (val) => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      search = val
      loadLeagues()
    }, 350)
  }

  window.onSort = (val) => {
    sortBy = val
    loadLeagues()
  }

  window.onSport = (val) => {
    sport = val
    document.querySelectorAll('[data-sport]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.sport === val)
    })
    loadLeagues()
  }

  window.loadMore = async () => {
    page++
    await loadLeagues(false)
  }

  // Follow / unfollow
  window.toggleLeagueFollow = async (leagueId, currentlyFollowing) => {
    const btn = document.getElementById(`follow-btn-${leagueId}`)
    if (btn) btn.disabled = true
    try {
      if (currentlyFollowing) {
        await unfollowLeague({ followerId: authUser.id, leagueId })
        followedIds.delete(leagueId)
        if (btn) {
          btn.textContent = '+ עקוב'
          btn.className = 'btn btn-ghost btn-sm'
          btn.setAttribute('onclick',
            `toggleLeagueFollow('${leagueId}', false)`)
        }
      } else {
        await followLeague({ followerId: authUser.id, leagueId })
        followedIds.add(leagueId)
        if (btn) {
          btn.textContent = '✓ עוקב'
          btn.className = 'btn btn-secondary btn-sm'
          btn.setAttribute('onclick',
            `toggleLeagueFollow('${leagueId}', true)`)
        }
      }
    } finally {
      if (btn) btn.disabled = false
    }
  }

  // Join by code
  window.joinByCode = async () => {
    const input   = document.getElementById('invite-code-input')
    const errEl   = document.getElementById('join-error')
    const succEl  = document.getElementById('join-success')
    const joinBtn = document.getElementById('join-code-btn')
    const code    = input?.value?.trim()

    errEl.style.display  = 'none'
    succEl.style.display = 'none'

    if (!code || code.length !== 6) {
      errEl.textContent    = 'הקוד חייב להיות בן 6 תווים'
      errEl.style.display  = 'block'
      return
    }

    joinBtn.disabled    = true
    joinBtn.textContent = 'מצטרף...'

    try {
      const league = await joinLeagueByCode({ userId: authUser.id, inviteCode: code })
      succEl.textContent   = `הצטרפת לליגה "${league.name}" בהצלחה! 🎉`
      succEl.style.display = 'block'
      if (input) input.value = ''
      // Navigate to league after short delay
      setTimeout(() => navigate(`/league/${league.id}`), 1500)
    } catch (err) {
      errEl.textContent   = err.message || 'שגיאה בהצטרפות'
      errEl.style.display = 'block'
    } finally {
      joinBtn.disabled    = false
      joinBtn.textContent = 'הצטרף'
    }
  }
}
