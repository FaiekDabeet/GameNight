// ── pages/PlayerCardPage.js ──────────────────────────────────
import { AppShell }  from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { supabase }  from '../lib/supabase.js'
import { navigate }  from '../router.js'

async function fetchPlayer(userId) {
  const { data } = await supabase
    .from('users')
    .select(`id, display_name, username, avatar_url, cover_url, bio,
      plan, locale, xp_total, level, login_streak, created_at,
      player_cards(follower_count, following_count, badges_json, total_games, total_wins)`)
    .eq('id', userId).single()
  return data
}

async function fetchPlayerLeagues(userId) {
  const { data } = await supabase
    .from('league_members')
    .select(`role, player_name, joined_at,
      leagues(id, name, sport_type, cover_url, logo_url, season, is_locked)`)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(10)
  return (data||[]).map(r => ({ ...r.leagues, role: r.role, player_name: r.player_name }))
}

async function fetchFollowState(myId, targetId) {
  const { data } = await supabase.from('follows').select('follower_id')
    .eq('follower_id', myId).eq('target_type','player').eq('target_id', targetId).maybeSingle()
  return !!data
}

async function fetchStats(userId) {
  const { data } = await supabase
    .from('standings')
    .select('wins,draws,losses,points,goals_for,goals_against')
    .eq('user_id', userId)
  if (!data?.length) return { wins:0, draws:0, losses:0, games:0, winRate:0, points:0 }
  const totals = data.reduce((acc, r) => ({
    wins:   acc.wins   + (r.wins||0),
    draws:  acc.draws  + (r.draws||0),
    losses: acc.losses + (r.losses||0),
    points: acc.points + (r.points||0),
  }), { wins:0, draws:0, losses:0, points:0 })
  totals.games   = totals.wins + totals.draws + totals.losses
  totals.winRate = totals.games ? Math.round(totals.wins/totals.games*100) : 0
  return totals
}

const BADGES = {
  first_league:    { label:'First League',    icon:'🏟', desc:'יצרת ליגה ראשונה' },
  streak_7:        { label:'Streak 7',        icon:'🔥', desc:'7 ימי כניסה ברצף' },
  games_100:       { label:'100 Games',       icon:'🎮', desc:'100 משחקים משוחקים' },
  top_scorer:      { label:'Top Scorer',      icon:'⚽', desc:'מלך השערים בליגה' },
  social_star:     { label:'Social Star',     icon:'⭐', desc:'50 עוקבים' },
  legend:          { label:'Legend',          icon:'👑', desc:'הגעת לרמה 16' },
}

function xpToNextLevel(level) { return level * 100 }

function sportEmoji(s) {
  return ({football:'⚽',basketball:'🏀',padel:'🎾',tennis:'🎾',
    chess:'♟',ping_pong:'🏓',volleyball:'🏐',poker:'🃏'}[s]||'🏆')
}

function timeAgo(d) {
  if (!d) return ''
  const s = (Date.now()-new Date(d))/1000
  if (s<86400) return 'היום'
  if (s<604800) return `לפני ${Math.floor(s/86400)} ימים`
  return new Date(d).toLocaleDateString('he-IL')
}

export async function render(root, params) {
  const targetId = params?.id
  if (!targetId) { navigate('/home'); return }

  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'profile' })
  await shell.mount(root)
  window.navigate = navigate

  // Skeleton
  shell.setContent(`<div dir="rtl">
    <div class="skeleton" style="height:160px;border-radius:var(--radius-lg);margin-bottom:var(--space-8)"></div>
    <div style="display:flex;gap:var(--space-4)">
      <div class="skeleton" style="flex:1;height:120px;border-radius:var(--radius-lg)"></div>
      <div class="skeleton" style="flex:1;height:120px;border-radius:var(--radius-lg)"></div>
    </div>
  </div>`)

  const isMe = targetId === authUser.id

  const [player, leagues, stats, isFollowing] = await Promise.all([
    fetchPlayer(targetId),
    fetchPlayerLeagues(targetId),
    fetchStats(targetId),
    isMe ? Promise.resolve(false) : fetchFollowState(authUser.id, targetId),
  ])

  if (!player) {
    shell.setContent(`<div dir="rtl" class="empty-state" style="margin-top:var(--space-12)">
      <h3>שחקן לא נמצא</h3>
      <button class="btn btn-primary btn-sm" style="margin-top:var(--space-4)"
        onclick="navigate('/home')">חזרה</button>
    </div>`)
    return
  }

  const card     = player.player_cards
  const badges   = Array.isArray(card?.badges_json) ? card.badges_json : []
  const followerCount  = card?.follower_count  || 0
  const followingCount = card?.following_count || 0
  const level    = player.level || 1
  const xp       = player.xp_total || 0
  const toNext   = xpToNextLevel(level)
  const progress = Math.min(100, Math.round((xp % toNext) / toNext * 100))
  let following  = isFollowing

  const initials = player.display_name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()

  shell.setContent(`
    <div dir="rtl">

      <!-- Cover -->
      <div style="position:relative;margin-bottom:var(--space-10)">
        ${player.cover_url
          ? `<img src="${player.cover_url}" loading="lazy" alt=""
              style="width:100%;height:160px;object-fit:cover;border-radius:var(--radius-lg);display:block">`
          : `<div style="width:100%;height:160px;border-radius:var(--radius-lg);
              background:linear-gradient(135deg,var(--gn-dark) 0%,var(--gn-dark-mid) 50%,var(--gn-dark-soft) 100%)"></div>`}

        <!-- Avatar -->
        <div style="position:absolute;bottom:-36px;inset-inline-start:var(--space-5)">
          ${player.avatar_url
            ? `<img src="${player.avatar_url}" loading="lazy" alt="${player.display_name}"
                style="width:72px;height:72px;border-radius:50%;border:4px solid var(--bg-surface);
                  object-fit:cover;display:block">`
            : `<div style="width:72px;height:72px;border-radius:50%;
                border:4px solid var(--bg-surface);
                background:var(--gn-orange);color:#fff;
                display:flex;align-items:center;justify-content:center;
                font-size:26px;font-weight:700">${initials}</div>`}
        </div>

        <!-- Edit / Follow button -->
        <div style="position:absolute;bottom:var(--space-3);inset-inline-end:var(--space-3)">
          ${isMe
            ? `<button class="btn btn-secondary btn-sm" onclick="navigate('/settings')">
                ✏️ עריכת פרופיל</button>`
            : `<button class="btn ${following?'btn-secondary':'btn-primary'} btn-sm"
                id="follow-btn" onclick="toggleFollow()">
                ${following ? '✓ עוקב' : '+ עקוב'}</button>`}
        </div>
      </div>

      <!-- Name + bio -->
      <div style="margin-bottom:var(--space-5)">
        <div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;margin-bottom:4px">
          <h1 style="font-size:var(--text-lg);font-weight:700;color:var(--text-primary)">
            ${player.display_name}
          </h1>
          ${player.plan==='pro'?`<span class="badge badge-pro">PRO</span>`:''}
          ${isMe?`<span class="badge badge-silver">אני</span>`:''}
        </div>
        ${player.username?`<div style="font-size:13px;color:var(--text-tertiary);margin-bottom:6px">@${player.username}</div>`:''}
        ${player.bio?`<p style="font-size:14px;color:var(--text-secondary);line-height:1.6">${player.bio}</p>`:''}

        <!-- Follower counts -->
        <div style="display:flex;gap:var(--space-5);margin-top:var(--space-3)">
          <div style="cursor:pointer">
            <span style="font-size:16px;font-weight:700;color:var(--text-primary)">${followerCount}</span>
            <span style="font-size:13px;color:var(--text-tertiary);margin-inline-start:4px">עוקבים</span>
          </div>
          <div style="cursor:pointer">
            <span style="font-size:16px;font-weight:700;color:var(--text-primary)">${followingCount}</span>
            <span style="font-size:13px;color:var(--text-tertiary);margin-inline-start:4px">עוקב אחרי</span>
          </div>
          <div>
            <span style="font-size:16px;font-weight:700;color:var(--text-primary)">${leagues.length}</span>
            <span style="font-size:13px;color:var(--text-tertiary);margin-inline-start:4px">ליגות</span>
          </div>
        </div>
      </div>

      <!-- XP + Level -->
      <div class="card" style="margin-bottom:var(--space-4)">
        <div class="card-body">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
            <div style="display:flex;align-items:center;gap:var(--space-2)">
              <span class="xp-level-chip" style="font-size:14px;padding:4px 12px">Lv ${level}</span>
              <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${xp.toLocaleString()} XP</span>
            </div>
            <span style="font-size:12px;color:var(--text-tertiary)">${toNext - (xp%toNext)} XP לרמה הבאה</span>
          </div>
          <div class="xp-bar-track" style="height:8px">
            <div class="xp-bar-fill" style="width:${progress}%;height:100%"></div>
          </div>
          ${player.login_streak>0?`
            <div style="margin-top:var(--space-3);font-size:12px;color:var(--text-tertiary)">
              🔥 רצף כניסות: <strong style="color:var(--gn-orange)">${player.login_streak} ימים</strong>
            </div>`:``}
        </div>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);margin-bottom:var(--space-4)">
        ${[
          { val: stats.games,   label: 'משחקים' },
          { val: stats.wins,    label: 'ניצחונות' },
          { val: `${stats.winRate}%`, label: 'אחוז ניצחון' },
          { val: stats.points,  label: 'נקודות' },
        ].map(s=>`
          <div class="card" style="text-align:center;padding:var(--space-3)">
            <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${s.val}</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Badges -->
      ${badges.length ? `
        <div class="card" style="margin-bottom:var(--space-4)">
          <div class="card-body">
            <h3 style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3)">
              הישגים
            </h3>
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
              ${badges.map(id => {
                const b = BADGES[id]
                if (!b) return ''
                return `<div title="${b.desc}" style="display:flex;align-items:center;gap:6px;
                  padding:6px 12px;border-radius:var(--radius-full);
                  background:var(--bg-surface-2);border:1px solid var(--border-light);
                  font-size:12px;font-weight:500;color:var(--text-primary)">
                  <span style="font-size:16px">${b.icon}</span>${b.label}
                </div>`
              }).join('')}
            </div>
          </div>
        </div>` : ''
      }

      <!-- Leagues -->
      ${leagues.length ? `
        <div style="margin-bottom:var(--space-4)">
          <h3 style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3)">
            ליגות
          </h3>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            ${leagues.map(l => `
              <div class="card card-clickable" onclick="navigate('/league/${l.id}')"
                style="padding:var(--space-3) var(--space-4)">
                <div style="display:flex;align-items:center;gap:var(--space-3)">
                  <div style="width:40px;height:40px;border-radius:var(--radius-sm);
                    background:var(--bg-surface-2);display:flex;align-items:center;
                    justify-content:center;font-size:18px;flex-shrink:0">
                    ${l.logo_url
                      ? `<img src="${l.logo_url}" width="40" height="40" loading="lazy"
                          style="border-radius:var(--radius-sm);object-fit:cover">`
                      : sportEmoji(l.sport_type)}
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:14px;font-weight:600;color:var(--text-primary);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.name}</div>
                    <div style="font-size:12px;color:var(--text-tertiary)">
                      ${l.sport_type||'כללי'}${l.season?' · עונה '+l.season:''}
                    </div>
                  </div>
                  ${l.role==='admin'?`<span class="badge badge-orange">מנהל</span>`:''}
                  ${l.is_locked?`<span class="badge badge-locked">נעולה</span>`:''}
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''
      }

      <!-- Member since -->
      <p style="font-size:12px;color:var(--text-tertiary);text-align:center;padding:var(--space-4) 0">
        חבר מ-${new Date(player.created_at).toLocaleDateString('he-IL')}
      </p>

    </div>`)

  // Follow toggle
  window.toggleFollow = async () => {
    const btn = document.getElementById('follow-btn')
    if (!btn) return
    btn.disabled = true
    try {
      if (following) {
        await supabase.from('follows').delete()
          .eq('follower_id', authUser.id).eq('target_type','player').eq('target_id', targetId)
        following = false
        btn.textContent = '+ עקוב'; btn.className = 'btn btn-primary btn-sm'
      } else {
        await supabase.from('follows').insert({
          follower_id: authUser.id, target_type:'player', target_id: targetId
        })
        following = true
        btn.textContent = '✓ עוקב'; btn.className = 'btn btn-secondary btn-sm'
      }
    } finally { btn.disabled = false }
  }
}
