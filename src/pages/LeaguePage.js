// ── pages/LeaguePage.js ──────────────────────────────────────
import { AppShell }       from '../components/AppShell.js'
import { StandingsTable } from '../components/StandingsTable.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { supabase }       from '../lib/supabase.js'
import { navigate }       from '../router.js'

async function fetchLeague(id) {
  const { data } = await supabase
    .from('leagues')
    .select(`id, name, sport_type, cover_url, logo_url,
      season, is_public, is_locked, last_activity_at, created_at,
      invite_code, owner_id,
      sponsors(id, name, logo_url, banner_url),
      league_members(count)`)
    .eq('id', id).single()
  return data
}

async function fetchStandings(leagueId, mode) {
  const sel = mode === 'team'
    ? `league_id,team_id,wins,draws,losses,points,goals_for,goals_against,teams(id,name,logo_url,color)`
    : `league_id,user_id,wins,draws,losses,points,goals_for,goals_against,users(id,display_name,avatar_url)`
  const { data } = await supabase.from('standings').select(sel)
    .eq('league_id', leagueId)
    .order('points',{ascending:false}).order('goals_for',{ascending:false})
  return data || []
}

async function fetchGames(leagueId) {
  const { data } = await supabase.from('games')
    .select(`id,home_score,away_score,status,played_at,
      home:home_player_id(id,display_name,avatar_url),
      away:away_player_id(id,display_name,avatar_url),
      home_team:home_team_id(id,name,logo_url,color),
      away_team:away_team_id(id,name,logo_url,color)`)
    .eq('league_id', leagueId)
    .order('played_at',{ascending:false}).limit(30)
  return data || []
}

async function fetchMembers(leagueId) {
  const { data } = await supabase.from('league_members')
    .select(`id,role,player_name,player_number,joined_at,
      users(id,display_name,avatar_url,level,xp_total)`)
    .eq('league_id', leagueId).order('joined_at')
  return data || []
}

async function fetchFollowState(userId, leagueId) {
  const { data } = await supabase.from('follows').select('follower_id')
    .eq('follower_id', userId).eq('target_type','league').eq('target_id', leagueId).maybeSingle()
  return !!data
}

const sportEmoji = s => ({football:'⚽',basketball:'🏀',padel:'🎾',tennis:'🎾',
  chess:'♟',ping_pong:'🏓',volleyball:'🏐',poker:'🃏',backgammon:'🎲',darts:'🎯'}[s]||'🏆')

function timeAgo(d) {
  if (!d) return ''
  const s = (Date.now()-new Date(d))/1000
  if (s<60) return 'עכשיו'
  if (s<3600) return `לפני ${Math.floor(s/60)} דק'`
  if (s<86400) return `לפני ${Math.floor(s/3600)} שע'`
  return `לפני ${Math.floor(s/86400)} ימים`
}

function av(url, name, size=32, round=true) {
  const r = round?'50%':'6px'
  if (url) return `<img src="${url}" width="${size}" height="${size}" loading="lazy" alt="${name}"
    style="border-radius:${r};object-fit:cover;flex-shrink:0">`
  const i = (name||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
  return `<span style="width:${size}px;height:${size}px;border-radius:${r};
    background:var(--gn-orange);color:#fff;flex-shrink:0;
    display:inline-flex;align-items:center;justify-content:center;
    font-size:${Math.round(size*.36)}px;font-weight:700">${i}</span>`
}

function gamesTab(games) {
  if (!games.length) return `<div class="empty-state"><div class="empty-state-icon">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
    </svg></div><h3>אין משחקים עדיין</h3><p>הוסף את המשחק הראשון</p></div>`

  return games.map(g => {
    const team = !!g.home_team
    const hn = team?g.home_team?.name:g.home?.display_name
    const an = team?g.away_team?.name:g.away?.display_name
    const hu = team?g.home_team?.logo_url:g.home?.avatar_url
    const au = team?g.away_team?.logo_url:g.away?.avatar_url
    const badge = {scheduled:`<span class="badge badge-silver">מתוכנן</span>`,
      live:`<span class="badge badge-orange">● חי</span>`,
      completed:'',cancelled:`<span class="badge badge-locked">בוטל</span>`}[g.status]||''
    return `
      <div class="card" style="margin-bottom:var(--space-3)">
        <div style="padding:var(--space-4)">
          <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-3)">
            <span style="font-size:11px;color:var(--text-tertiary)">${g.played_at?timeAgo(g.played_at):'—'}</span>
            ${badge}
          </div>
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div style="flex:1;display:flex;align-items:center;gap:10px;justify-content:flex-end">
              ${av(hu,hn||'',36,!team)}
              <span style="font-size:15px;font-weight:600;color:var(--text-primary)">${hn||'—'}</span>
            </div>
            <div style="min-width:80px;text-align:center">
              ${g.status==='scheduled'
                ? `<span style="font-size:13px;color:var(--text-tertiary);font-weight:500">VS</span>`
                : `<span style="font-size:20px;font-weight:700;color:var(--text-primary);
                    background:var(--bg-surface-2);border-radius:var(--radius-sm);
                    padding:6px 14px;display:inline-block">${g.home_score??'—'} : ${g.away_score??'—'}</span>`}
            </div>
            <div style="flex:1;display:flex;align-items:center;gap:10px">
              ${av(au,an||'',36,!team)}
              <span style="font-size:15px;font-weight:600;color:var(--text-primary)">${an||'—'}</span>
            </div>
          </div>
        </div>
      </div>`
  }).join('')
}

function membersTab(members) {
  if (!members.length) return `<div class="empty-state"><div class="empty-state-icon">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4"/>
      <path d="M16 11l2 2 4-4"/>
    </svg></div><h3>אין חברים בליגה</h3><p>שתף את קוד ההזמנה</p></div>`
  return `<div style="display:flex;flex-direction:column;gap:var(--space-2)">
    ${members.map(m => {
      const name = m.player_name||m.users?.display_name||'—'
      return `<div class="card card-clickable" onclick="navigate('/player/${m.users?.id}')"
        style="padding:var(--space-3) var(--space-4)">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          ${av(m.users?.avatar_url,name,40)}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:var(--space-2)">
              <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${name}</span>
              ${m.player_number?`<span style="font-size:11px;color:var(--text-tertiary)">#${m.player_number}</span>`:''}
              ${m.role==='admin'?`<span class="badge badge-orange">מנהל</span>`:''}
            </div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">
              Lv ${m.users?.level||1} · ${m.users?.xp_total||0} XP
            </div>
          </div>
          <span style="font-size:11px;color:var(--text-tertiary)">${timeAgo(m.joined_at)}</span>
        </div>
      </div>`
    }).join('')}
  </div>`
}

function infoRow(l,v) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;
    padding:var(--space-2) 0;border-bottom:1px solid var(--border-light)">
    <span style="font-size:13px;color:var(--text-secondary)">${l}</span>
    <span style="font-size:13px;font-weight:500;color:var(--text-primary)">${v}</span>
  </div>`
}

function infoTab(league, memberCount, isOwner) {
  return `<div style="display:flex;flex-direction:column;gap:var(--space-4)">
    <div class="card"><div class="card-body">
      <h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3)">פרטי ליגה</h3>
      ${infoRow('ענף', league.sport_type||'כללי')}
      ${infoRow('עונה', league.season||'—')}
      ${infoRow('שחקנים', memberCount)}
      ${infoRow('נראות', league.is_public?'פומבית':'פרטית')}
      ${infoRow('סטטוס', league.is_locked?'🔒 נעולה':'✅ פעילה')}
      ${infoRow('נוצרה', new Date(league.created_at).toLocaleDateString('he-IL'))}
    </div></div>
    <div class="card"><div class="card-body">
      <h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3)">קוד הצטרפות</h3>
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <div style="flex:1;font-size:24px;font-weight:700;letter-spacing:4px;color:var(--gn-orange);
          font-family:var(--font-mono);background:var(--bg-surface-2);border-radius:var(--radius-md);
          padding:var(--space-3) var(--space-4);text-align:center">${league.invite_code||'——'}</div>
        <button class="btn btn-secondary btn-sm" id="copy-code-btn"
          onclick="copyCode('${league.invite_code}')">העתק</button>
      </div>
    </div></div>
    ${isOwner&&!league.is_locked?`
      <div class="card"><div class="card-body">
        <h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3)">ניהול ליגה</h3>
        <div style="display:flex;flex-direction:column;gap:var(--space-2)">
          <button class="btn btn-primary btn-sm" onclick="navigate('/league/${league.id}/edit')">עריכת פרטים</button>
          <button class="btn btn-secondary btn-sm" onclick="navigate('/league/${league.id}/games/add')">+ הוסף משחק</button>
        </div>
      </div></div>`:''}
  </div>`
}

export async function render(root, params) {
  const leagueId = params?.id
  if (!leagueId) { navigate('/home'); return }
  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'leagues' })
  await shell.mount(root)
  window.navigate = navigate

  shell.setContent(`<div dir="rtl">
    <div class="skeleton" style="height:200px;border-radius:var(--radius-lg);margin-bottom:var(--space-4)"></div>
    <div class="skeleton" style="height:48px;border-radius:var(--radius-md);margin-bottom:var(--space-4)"></div>
    <div class="skeleton" style="height:300px;border-radius:var(--radius-lg)"></div>
  </div>`)

  const [league, games, members] = await Promise.all([
    fetchLeague(leagueId), fetchGames(leagueId), fetchMembers(leagueId)
  ])

  if (!league) {
    shell.setContent(`<div dir="rtl" class="empty-state" style="margin-top:var(--space-12)">
      <h3>ליגה לא נמצאה</h3>
      <button class="btn btn-primary btn-sm" style="margin-top:var(--space-4)"
        onclick="navigate('/home')">חזרה</button>
    </div>`)
    return
  }

  const hasTeams  = games.some(g => g.home_team)
  const mode      = hasTeams ? 'team' : 'player'
  const [standings, isFollowing] = await Promise.all([
    fetchStandings(leagueId, mode), fetchFollowState(authUser.id, leagueId)
  ])

  const isOwner     = league.owner_id === authUser.id
  const memberCount = league.league_members?.[0]?.count ?? members.length
  const isPro       = profile?.plan === 'pro'
  const sponsor     = league.sponsors
  let activeTab     = 'standings'
  let following     = isFollowing

  const tabContent = () => ({
    standings: StandingsTable({ standings, mode, currentUserId: authUser.id }),
    games:     gamesTab(games),
    members:   membersTab(members),
    info:      infoTab(league, memberCount, isOwner),
  })[activeTab]

  const tabs = [
    { id:'standings', label:'טבלה' },
    { id:'games',     label:`משחקים (${games.length})` },
    { id:'members',   label:`שחקנים (${memberCount})` },
    { id:'info',      label:'מידע' },
  ]

  shell.setContent(`
    <div dir="rtl">
      <!-- Cover -->
      <div style="position:relative;margin-bottom:var(--space-6)">
        ${league.cover_url
          ? `<img src="${league.cover_url}" alt="${league.name}" loading="lazy"
              style="width:100%;height:220px;object-fit:cover;border-radius:var(--radius-lg);display:block">`
          : `<div style="width:100%;height:220px;border-radius:var(--radius-lg);
              background:linear-gradient(135deg,var(--gn-dark) 0%,var(--gn-dark-mid) 100%);
              display:flex;align-items:center;justify-content:center;font-size:72px">
              ${sportEmoji(league.sport_type)}
            </div>`}
        ${league.logo_url?`<img src="${league.logo_url}" alt="${league.name}" loading="lazy"
          style="position:absolute;bottom:-20px;inset-inline-start:var(--space-5);
            width:64px;height:64px;border-radius:var(--radius-md);
            border:3px solid var(--bg-surface);object-fit:cover;box-shadow:var(--shadow-md)">`:``}
        ${league.is_locked?`<div style="position:absolute;top:var(--space-3);inset-inline-end:var(--space-3)">
          <span class="badge badge-locked">🔒 נעולה</span></div>`:``}
      </div>

      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;
        gap:var(--space-4);margin-bottom:var(--space-5);
        margin-top:${league.logo_url?'var(--space-6)':'0'}">
        <div>
          <h1 style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);margin-bottom:4px">
            ${league.name}
          </h1>
          <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap">
            <span class="badge badge-silver">${league.sport_type||'כללי'}</span>
            ${league.season?`<span class="badge badge-dark">עונה ${league.season}</span>`:''}
            <span style="font-size:12px;color:var(--text-tertiary)">${memberCount} שחקנים</span>
          </div>
        </div>
        <div style="display:flex;gap:var(--space-2);flex-shrink:0">
          <button class="btn ${following?'btn-secondary':'btn-primary'} btn-sm"
            id="follow-btn" onclick="toggleFollow()">
            ${following?'✓ עוקב':'+ עקוב'}
          </button>
          ${isOwner?`<button class="btn btn-secondary btn-sm"
            onclick="navigate('/league/${leagueId}/edit')"
            ${league.is_locked?'disabled':''}>עריכה</button>`:''}
        </div>
      </div>

      <!-- Sponsor -->
      ${sponsor?`<div class="card" style="margin-bottom:var(--space-4);
        border-color:var(--gn-orange);padding:var(--space-3) var(--space-4)">
        <div style="display:flex;align-items:center;gap:var(--space-3)">
          ${sponsor.logo_url?`<img src="${sponsor.logo_url}" height="32" loading="lazy"
            alt="${sponsor.name}" style="border-radius:4px;object-fit:contain">`:``}
          <div>
            <div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.5px">ספונסר</div>
            <div style="font-size:14px;font-weight:600;color:var(--text-primary)">${sponsor.name}</div>
          </div>
          ${sponsor.banner_url?`<img src="${sponsor.banner_url}" loading="lazy"
            style="margin-inline-start:auto;max-height:40px;border-radius:4px;object-fit:contain">`:``}
        </div>
      </div>`:``}

      <!-- Ad slot -->
      ${!isPro&&!sponsor?`<div class="ad-slot ad-slot-inline" role="complementary">
        <span>פרסומת</span><span class="ad-slot-label">Ad</span>
      </div>`:``}

      <!-- Tabs -->
      <div style="display:flex;gap:0;margin-bottom:var(--space-5);
        border-bottom:1px solid var(--border-light);overflow-x:auto">
        ${tabs.map(t=>`<button class="league-tab ${activeTab===t.id?'active':''}"
          onclick="switchTab('${t.id}')" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>

      <div id="tab-content">${tabContent()}</div>

      <style>
        .league-tab{padding:10px var(--space-4);font-family:var(--font-base);font-size:var(--text-sm);
          font-weight:500;color:var(--text-secondary);background:none;border:none;
          border-bottom:2px solid transparent;cursor:pointer;white-space:nowrap;
          transition:color var(--transition-fast),border-color var(--transition-fast);margin-bottom:-1px}
        .league-tab:hover{color:var(--text-primary)}
        .league-tab.active{color:var(--gn-orange-dim);border-bottom-color:var(--gn-orange);font-weight:600}
      </style>
    </div>`)

  window.switchTab = (tabId) => {
    activeTab = tabId
    document.getElementById('tab-content').innerHTML = tabContent()
    document.querySelectorAll('.league-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tabId))
  }

  window.toggleFollow = async () => {
    const btn = document.getElementById('follow-btn')
    btn.disabled = true
    try {
      if (following) {
        await supabase.from('follows').delete()
          .eq('follower_id', authUser.id).eq('target_type','league').eq('target_id', leagueId)
        following = false; btn.textContent = '+ עקוב'
        btn.className = 'btn btn-primary btn-sm'
      } else {
        await supabase.from('follows').insert({ follower_id:authUser.id, target_type:'league', target_id:leagueId })
        following = true; btn.textContent = '✓ עוקב'
        btn.className = 'btn btn-secondary btn-sm'
      }
    } finally { btn.disabled = false }
  }

  window.copyCode = async (code) => {
    await navigator.clipboard.writeText(code).catch(()=>{})
    const btn = document.getElementById('copy-code-btn')
    if (btn) { btn.textContent='הועתק!'; setTimeout(()=>btn.textContent='העתק',2000) }
  }

  const ch = supabase.channel(`standings:${leagueId}`)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'standings',
      filter:`league_id=eq.${leagueId}`}, async () => {
      const fresh = await fetchStandings(leagueId, mode)
      standings.splice(0, standings.length, ...fresh)
      if (activeTab==='standings')
        document.getElementById('tab-content').innerHTML = tabContent()
    }).subscribe()
  window.__leagueCleanup = () => supabase.removeChannel(ch)
}
