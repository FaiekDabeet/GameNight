// ── pages/LeaguesPage.js ─────────────────────────────────────
// Leagues hub page — accessible from bottom nav / sidebar
// Sections:
//   1. My leagues (leagues I own/manage)
//   2. Leagues I'm a member of
//   3. Leagues I follow
//   4. Quick actions: create + join by code

import { AppShell }  from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { joinLeagueByCode } from '../lib/actions.js'
import { supabase }  from '../lib/supabase.js'
import { navigate }  from '../router.js'

const sportEmoji = s => ({
  football:'⚽', basketball:'🏀', padel:'🎾', tennis:'🎾',
  chess:'♟', ping_pong:'🏓', volleyball:'🏐', poker:'🃏',
  backgammon:'🎲', darts:'🎯'
}[s] || '🏆')

function timeAgo(d) {
  if (!d) return ''
  const s = (Date.now() - new Date(d)) / 1000
  if (s < 3600)  return `לפני ${Math.floor(s/60)||1} דק'`
  if (s < 86400) return `לפני ${Math.floor(s/3600)} שע'`
  return `לפני ${Math.floor(s/86400)} ימים`
}

// ── Data fetchers ─────────────────────────────────────────────
async function fetchMyLeagues(userId) {
  const { data } = await supabase
    .from('leagues')
    .select(`id, name, sport_type, cover_url, logo_url, season,
      last_activity_at, is_locked, created_at,
      league_members(count), games(count)`)
    .eq('owner_id', userId)
    .order('last_activity_at', { ascending: false })
  return data || []
}

async function fetchMemberLeagues(userId) {
  const { data } = await supabase
    .from('league_members')
    .select(`role, leagues(id, name, sport_type, cover_url, logo_url,
      season, last_activity_at, is_locked, league_members(count))`)
    .eq('user_id', userId)
    .neq('role', 'admin')
    .order('joined_at', { ascending: false })
  return (data || []).map(r => ({ ...r.leagues, role: r.role })).filter(Boolean)
}

async function fetchFollowedLeagues(userId) {
  const { data: follows } = await supabase
    .from('follows')
    .select('target_id')
    .eq('follower_id', userId)
    .eq('target_type', 'league')
    .order('created_at', { ascending: false })
    .limit(20)
  if (!follows?.length) return []
  const ids = follows.map(f => f.target_id)
  const { data } = await supabase
    .from('leagues')
    .select(`id, name, sport_type, cover_url, logo_url,
      season, last_activity_at, is_locked, league_members(count)`)
    .in('id', ids)
  return data || []
}

// ── League row (compact list item) ───────────────────────────
function leagueRow(league, badge = '') {
  const count = league.league_members?.[0]?.count || 0
  const games = league.games?.[0]?.count || ''
  return `
    <div class="card card-clickable" onclick="navigate('/league/${league.id}')"
      style="padding:0;margin-bottom:8px;overflow:hidden">
      <div style="display:flex;align-items:stretch">

        <!-- Color strip / cover thumbnail -->
        <div style="width:56px;flex-shrink:0;
          background:${league.cover_url
            ? `url(${league.cover_url}) center/cover no-repeat`
            : 'linear-gradient(135deg,var(--gn-dark) 0%,var(--gn-dark-mid) 100%)'};
          display:flex;align-items:center;justify-content:center;
          font-size:22px">
          ${league.cover_url ? '' : sportEmoji(league.sport_type)}
        </div>

        <!-- Info -->
        <div style="flex:1;padding:12px 14px;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">
            <span style="font-size:14px;font-weight:600;color:var(--text-primary);
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">
              ${league.name}
            </span>
            ${league.is_locked ? `<span class="badge badge-locked" style="font-size:10px">🔒</span>` : ''}
            ${badge}
          </div>
          <div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-tertiary)">
            <span>${league.sport_type || 'כללי'}</span>
            <span>·</span>
            <span>👥 ${count}</span>
            ${games ? `<span>·</span><span>🎮 ${games}</span>` : ''}
            <span style="margin-inline-start:auto">${timeAgo(league.last_activity_at)}</span>
          </div>
        </div>

        <!-- Arrow -->
        <div style="padding:0 12px;display:flex;align-items:center;
          color:var(--text-tertiary)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 3l-4 5 4 5"/>
          </svg>
        </div>
      </div>
    </div>`
}

function sectionHeader(title, count, action = '') {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;
      margin-bottom:10px;margin-top:24px">
      <div>
        <h2 style="font-size:16px;font-weight:700;color:var(--text-primary);margin:0">
          ${title}
        </h2>
        ${count !== null ? `<p style="font-size:12px;color:var(--text-tertiary);margin:0">
          ${count} ליגות</p>` : ''}
      </div>
      ${action}
    </div>`
}

function emptyRow(msg) {
  return `<div style="padding:20px;text-align:center;font-size:13px;
    color:var(--text-tertiary);background:var(--bg-surface-2);
    border-radius:10px;margin-bottom:8px">${msg}</div>`
}

// ── Main render ───────────────────────────────────────────────
export async function render(root) {
  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile  = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'leagues' })
  await shell.mount(root)
  window.navigate = navigate

  // Skeleton
  shell.setContent(`<div dir="rtl">
    ${[60,80,80,80,60,80,80].map(h =>
      `<div class="skeleton" style="height:${h}px;border-radius:10px;margin-bottom:8px"></div>`
    ).join('')}
  </div>`)

  const [myLeagues, memberLeagues, followedLeagues] = await Promise.all([
    fetchMyLeagues(authUser.id),
    fetchMemberLeagues(authUser.id),
    fetchFollowedLeagues(authUser.id),
  ])

  // Deduplicate — remove from memberLeagues leagues that appear in myLeagues
  const myIds = new Set(myLeagues.map(l => l.id))
  const memberOnly = memberLeagues.filter(l => !myIds.has(l.id))

  // Also deduplicate followed from both above
  const knownIds = new Set([...myLeagues, ...memberOnly].map(l => l.id))
  const followedOnly = followedLeagues.filter(l => !knownIds.has(l.id))

  const totalCount = myLeagues.length + memberOnly.length + followedOnly.length

  shell.setContent(`
    <div dir="rtl" style="max-width:640px;margin:0 auto">

      <!-- Page header -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        margin-bottom:4px">
        <div>
          <h1 style="font-size:22px;font-weight:700;color:var(--text-primary);margin:0">
            הליגות שלי
          </h1>
          <p style="font-size:13px;color:var(--text-tertiary);margin:0">
            ${totalCount} ליגות בסה"כ
          </p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="navigate('/leagues/create')">
          + צור ליגה
        </button>
      </div>

      <!-- Join by code (compact) -->
      <div style="display:flex;gap:8px;margin-top:16px;margin-bottom:8px">
        <input type="text" id="join-code" placeholder="קוד הצטרפות (6 תווים)"
          maxlength="6" dir="ltr"
          style="flex:1;padding:9px 12px;text-transform:uppercase;
            letter-spacing:3px;font-size:14px;font-weight:700;text-align:center;
            border-radius:10px;border:1.5px solid var(--border-mid);
            background:var(--bg-surface);color:var(--text-primary);
            font-family:var(--font-mono);transition:border-color 0.15s"
          onfocus="this.style.borderColor='var(--gn-orange)'"
          onblur="this.style.borderColor='var(--border-mid)'"
          oninput="this.value=this.value.toUpperCase()"
          onkeydown="if(event.key==='Enter')joinCode()">
        <button class="btn btn-secondary" onclick="joinCode()" id="join-btn">
          הצטרף
        </button>
      </div>
      <div id="join-msg" style="display:none;font-size:12px;
        margin-bottom:8px;padding:8px 12px;border-radius:8px"></div>

      <!-- 1. My leagues (owner) -->
      ${sectionHeader('ליגות שאני מנהל', myLeagues.length,
        `<button class="btn btn-ghost btn-sm" onclick="navigate('/leagues/create')">
          + חדש</button>`
      )}
      ${myLeagues.length === 0
        ? emptyRow('עדיין לא יצרת ליגה — לחץ "+ צור ליגה"')
        : myLeagues.map(l => leagueRow(l,
            `<span class="badge badge-orange" style="font-size:10px">מנהל</span>`
          )).join('')
      }

      <!-- 2. Member leagues -->
      ${memberOnly.length > 0 ? `
        ${sectionHeader('ליגות שאני שחקן בהן', memberOnly.length)}
        ${memberOnly.map(l => leagueRow(l,
          `<span class="badge badge-silver" style="font-size:10px">שחקן</span>`
        )).join('')}
      ` : ''}

      <!-- 3. Followed leagues -->
      ${followedOnly.length > 0 ? `
        ${sectionHeader('ליגות שאני עוקב', followedOnly.length,
          `<a href="/discover" onclick="navigate('/discover');return false"
            class="btn btn-ghost btn-sm">גלה עוד</a>`
        )}
        ${followedOnly.map(l => leagueRow(l)).join('')}
      ` : ''}

      <!-- Empty state — no leagues at all -->
      ${totalCount === 0 ? `
        <div style="text-align:center;padding:48px 24px">
          <div style="font-size:48px;margin-bottom:16px">🏆</div>
          <h3 style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px">
            אין לך ליגות עדיין
          </h3>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">
            צור ליגה ראשונה או הצטרף לאחת קיימת בקוד הזמנה
          </p>
          <div style="display:flex;flex-direction:column;gap:10px;max-width:240px;margin:0 auto">
            <button class="btn btn-primary" onclick="navigate('/leagues/create')">
              + צור ליגה חדשה
            </button>
            <button class="btn btn-secondary" onclick="navigate('/discover')">
              🔍 גלה ליגות
            </button>
          </div>
        </div>` : ''
      }

    </div>`)

  // ── Join by code ──────────────────────────────────────────
  window.joinCode = async () => {
    const input  = document.getElementById('join-code')
    const msgEl  = document.getElementById('join-msg')
    const btn    = document.getElementById('join-btn')
    const code   = input?.value?.trim()

    msgEl.style.display = 'none'

    if (!code || code.length !== 6) {
      msgEl.textContent        = 'הקוד חייב להיות בן 6 תווים'
      msgEl.style.display      = 'block'
      msgEl.style.background   = '#fff5f5'
      msgEl.style.color        = '#dc3545'
      return
    }

    btn.disabled    = true
    btn.textContent = 'מצטרף...'

    try {
      const league = await joinLeagueByCode({ userId: authUser.id, inviteCode: code })
      msgEl.textContent      = `הצטרפת ל-"${league.name}" בהצלחה! 🎉`
      msgEl.style.display    = 'block'
      msgEl.style.background = '#f0fff4'
      msgEl.style.color      = '#276749'
      input.value = ''
      setTimeout(() => navigate(`/league/${league.id}`), 1200)
    } catch (err) {
      msgEl.textContent      = err.message || 'שגיאה בהצטרפות'
      msgEl.style.display    = 'block'
      msgEl.style.background = '#fff5f5'
      msgEl.style.color      = '#dc3545'
    } finally {
      btn.disabled    = false
      btn.textContent = 'הצטרף'
    }
  }
}
