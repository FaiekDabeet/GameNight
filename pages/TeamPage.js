// ── pages/TeamPage.js ────────────────────────────────────────
import { AppShell } from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { supabase }  from '../lib/supabase.js'
import { navigate }  from '../router.js'

async function fetchTeam(id) {
  const { data } = await supabase
    .from('teams')
    .select(`id, name, logo_url, cover_url, color, created_at,
      league_id,
      leagues(id, name, sport_type, cover_url),
      team_members(role, joined_at,
        users(id, display_name, avatar_url, level, xp_total))`)
    .eq('id', id).single()
  return data
}

async function fetchTeamStandings(leagueId, teamId) {
  const { data } = await supabase
    .from('standings')
    .select('wins,draws,losses,points,goals_for,goals_against')
    .eq('league_id', leagueId).eq('team_id', teamId).maybeSingle()
  return data
}

async function fetchTeamGames(leagueId, teamId) {
  const { data } = await supabase
    .from('games')
    .select(`id, home_score, away_score, status, played_at,
      home_team:home_team_id(id,name,logo_url),
      away_team:away_team_id(id,name,logo_url)`)
    .eq('league_id', leagueId)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('played_at', { ascending: false }).limit(20)
  return data || []
}

function timeAgo(d) {
  if (!d) return ''
  const s = (Date.now()-new Date(d))/1000
  if (s<86400) return 'היום'
  return `לפני ${Math.floor(s/86400)} ימים`
}

function av(url, name, size=36, round=true) {
  const r = round?'50%':'6px'
  if (url) return `<img src="${url}" width="${size}" height="${size}" loading="lazy"
    style="border-radius:${r};object-fit:cover;flex-shrink:0" alt="${name}">`
  const i = (name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
  return `<span style="width:${size}px;height:${size}px;border-radius:${r};
    background:var(--gn-orange);color:#fff;flex-shrink:0;
    display:inline-flex;align-items:center;justify-content:center;
    font-size:${Math.round(size*.36)}px;font-weight:700">${i}</span>`
}

export async function render(root, params) {
  const teamId = params?.id
  if (!teamId) { navigate('/home'); return }

  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'leagues' })
  await shell.mount(root)
  window.navigate = navigate

  shell.setContent(`<div dir="rtl">
    <div class="skeleton" style="height:160px;border-radius:var(--radius-lg);margin-bottom:var(--space-8)"></div>
    <div class="skeleton" style="height:200px;border-radius:var(--radius-lg)"></div>
  </div>`)

  const team = await fetchTeam(teamId)

  if (!team) {
    shell.setContent(`<div dir="rtl" class="empty-state" style="margin-top:var(--space-12)">
      <h3>קבוצה לא נמצאה</h3>
      <button class="btn btn-primary btn-sm" style="margin-top:var(--space-4)"
        onclick="navigate('/home')">חזרה</button>
    </div>`)
    return
  }

  const [standings, games] = await Promise.all([
    fetchTeamStandings(team.league_id, teamId),
    fetchTeamGames(team.league_id, teamId),
  ])

  const members  = team.team_members || []
  const captain  = members.find(m => m.role === 'captain')
  const color    = team.color || '#FF9B51'
  const initials = team.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()

  shell.setContent(`
    <div dir="rtl">

      <!-- Cover -->
      <div style="position:relative;margin-bottom:var(--space-10)">
        ${team.cover_url
          ? `<img src="${team.cover_url}" loading="lazy" alt="${team.name}"
              style="width:100%;height:160px;object-fit:cover;border-radius:var(--radius-lg);display:block">`
          : `<div style="width:100%;height:160px;border-radius:var(--radius-lg);
              background:linear-gradient(135deg,${color}33 0%,${color}88 100%);
              display:flex;align-items:center;justify-content:center"></div>`}

        <!-- Team logo / avatar -->
        <div style="position:absolute;bottom:-28px;inset-inline-start:var(--space-5)">
          ${team.logo_url
            ? `<img src="${team.logo_url}" loading="lazy" alt="${team.name}"
                style="width:56px;height:56px;border-radius:var(--radius-md);
                  border:3px solid var(--bg-surface);object-fit:cover;display:block">`
            : `<div style="width:56px;height:56px;border-radius:var(--radius-md);
                border:3px solid var(--bg-surface);
                background:${color};color:#fff;
                display:flex;align-items:center;justify-content:center;
                font-size:20px;font-weight:700">${initials}</div>`}
        </div>
      </div>

      <!-- Header -->
      <div style="margin-bottom:var(--space-5)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3)">
          <div>
            <h1 style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);margin-bottom:4px">
              ${team.name}
            </h1>
            <div style="display:flex;align-items:center;gap:var(--space-2)">
              ${team.leagues
                ? `<a href="/league/${team.leagues.id}" onclick="navigate('/league/${team.leagues.id}');return false"
                    style="font-size:13px;color:var(--text-accent);text-decoration:none;font-weight:500">
                    ${team.leagues.name}</a>`
                : ''}
              <span style="font-size:12px;color:var(--text-tertiary)">${members.length} שחקנים</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm"
            onclick="navigate('/league/${team.league_id}')">← לליגה</button>
        </div>
      </div>

      <!-- Stats cards -->
      ${standings ? `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);margin-bottom:var(--space-5)">
          ${[
            { val: (standings.wins||0)+(standings.draws||0)+(standings.losses||0), label:'משחקים' },
            { val: standings.wins||0,   label:'ניצחונות' },
            { val: standings.draws||0,  label:'תיקו' },
            { val: standings.points||0, label:"נק'", accent:true },
          ].map(s=>`
            <div class="card" style="text-align:center;padding:var(--space-3)">
              <div style="font-size:20px;font-weight:700;
                color:${s.accent?'var(--gn-orange-dim)':'var(--text-primary)'}">
                ${s.val}
              </div>
              <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${s.label}</div>
            </div>`).join('')}
        </div>` : ''}

      <!-- Members -->
      <div style="margin-bottom:var(--space-5)">
        <h3 style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3)">
          שחקנים
        </h3>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          ${members.map(m => {
            const name = m.users?.display_name || '—'
            const isCap = m.role === 'captain'
            return `
              <div class="card card-clickable" onclick="navigate('/player/${m.users?.id}')"
                style="padding:var(--space-3) var(--space-4)">
                <div style="display:flex;align-items:center;gap:var(--space-3)">
                  ${av(m.users?.avatar_url, name, 40)}
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;align-items:center;gap:var(--space-2)">
                      <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${name}</span>
                      ${isCap?`<span class="badge badge-orange">קפטן</span>`:''}
                    </div>
                    <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">
                      Lv ${m.users?.level||1} · ${m.users?.xp_total||0} XP
                    </div>
                  </div>
                  <span style="font-size:11px;color:var(--text-tertiary)">${timeAgo(m.joined_at)}</span>
                </div>
              </div>`
          }).join('')}
        </div>
      </div>

      <!-- Recent games -->
      ${games.length ? `
        <div>
          <h3 style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3)">
            משחקים אחרונים
          </h3>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            ${games.slice(0,5).map(g => {
              const isHome = g.home_team?.id === teamId
              const opp    = isHome ? g.away_team : g.home_team
              const mySc   = isHome ? g.home_score : g.away_score
              const oppSc  = isHome ? g.away_score : g.home_score
              const result = g.status !== 'completed' ? 'VS'
                : mySc > oppSc ? '✅ ניצחון'
                : mySc < oppSc ? '❌ הפסד'
                : '🤝 תיקו'
              return `
                <div class="card" style="padding:var(--space-3) var(--space-4)">
                  <div style="display:flex;align-items:center;gap:var(--space-3)">
                    <div style="flex:1;display:flex;align-items:center;gap:8px">
                      ${av(opp?.logo_url, opp?.name||'', 32, false)}
                      <span style="font-size:13px;font-weight:500;color:var(--text-primary)">${opp?.name||'—'}</span>
                    </div>
                    <span style="font-size:14px;font-weight:700;
                      background:var(--bg-surface-2);border-radius:var(--radius-sm);
                      padding:4px 10px;color:var(--text-primary)">
                      ${mySc??'—'} : ${oppSc??'—'}
                    </span>
                    <span style="font-size:12px;min-width:60px;text-align:end">${result}</span>
                  </div>
                </div>`
            }).join('')}
          </div>
        </div>` : ''
      }

    </div>`)
}
