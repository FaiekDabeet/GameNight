// ── pages/AddGamePage.js ─────────────────────────────────────
// Add a game to a league — supports both player vs player
// and team vs team modes.
// Steps:
//   1. Pick mode (player / team)
//   2. Pick home + away
//   3. Enter score (optional — can save as 'scheduled')
//   4. Submit → actions.recordGameResult or insert scheduled game

import { AppShell }         from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { recordGameResult } from '../lib/actions.js'
import { supabase }         from '../lib/supabase.js'
import { navigate }         from '../router.js'

// ── Data fetchers ─────────────────────────────────────────────
async function fetchLeague(leagueId) {
  const { data } = await supabase
    .from('leagues')
    .select('id, name, sport_type, is_locked, owner_id')
    .eq('id', leagueId)
    .single()
  return data
}

async function fetchMembers(leagueId) {
  const { data } = await supabase
    .from('league_members')
    .select('user_id, player_name, player_number, role, users(id, display_name, avatar_url)')
    .eq('league_id', leagueId)
    .order('player_name')
  return data || []
}

async function fetchTeams(leagueId) {
  const { data } = await supabase
    .from('teams')
    .select('id, name, logo_url, color')
    .eq('league_id', leagueId)
    .order('name')
  return data || []
}

// ── Helpers ───────────────────────────────────────────────────
function av(url, name, size = 36) {
  if (url) return `<img src="${url}" width="${size}" height="${size}" loading="lazy"
    style="border-radius:50%;object-fit:cover;flex-shrink:0" alt="${name}">`
  const i = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return `<span style="width:${size}px;height:${size}px;border-radius:50%;
    background:var(--gn-orange);color:#fff;flex-shrink:0;
    display:inline-flex;align-items:center;justify-content:center;
    font-size:${Math.round(size * .36)}px;font-weight:700">${i}</span>`
}

function teamAv(url, name, color = '#FF9B51', size = 36) {
  if (url) return `<img src="${url}" width="${size}" height="${size}" loading="lazy"
    style="border-radius:6px;object-fit:cover;flex-shrink:0" alt="${name}">`
  const i = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return `<span style="width:${size}px;height:${size}px;border-radius:6px;
    background:${color};color:#fff;flex-shrink:0;
    display:inline-flex;align-items:center;justify-content:center;
    font-size:${Math.round(size * .36)}px;font-weight:700">${i}</span>`
}

function inputStyle(extra = '') {
  return `width:100%;padding:10px var(--space-3);
    border-radius:var(--radius-md);border:1.5px solid var(--border-mid);
    background:var(--bg-surface);color:var(--text-primary);
    font-family:var(--font-base);font-size:var(--text-base);
    transition:border-color var(--transition-fast);${extra}`
}

// ── Picker card (player or team) ──────────────────────────────
function pickerCard(items, selectedId, onSelect, mode) {
  return `
    <div style="display:flex;flex-direction:column;gap:var(--space-2);
      max-height:280px;overflow-y:auto;padding-right:2px">
      ${items.map(item => {
        const id      = mode === 'team' ? item.id : item.user_id
        const name    = mode === 'team' ? item.name : (item.player_name || item.users?.display_name)
        const subline = mode === 'team'
          ? ''
          : item.player_number ? `#${item.player_number}` : ''
        const isSelected = id === selectedId
        return `
          <div onclick="${onSelect}('${id}')"
            style="display:flex;align-items:center;gap:var(--space-3);
              padding:10px var(--space-3);border-radius:var(--radius-md);
              border:1.5px solid ${isSelected ? 'var(--gn-orange)' : 'var(--border-light)'};
              background:${isSelected ? 'var(--gn-orange-pale)' : 'var(--bg-surface)'};
              cursor:pointer;transition:all var(--transition-fast)"
            onmouseover="if(!${isSelected})this.style.background='var(--bg-surface-2)'"
            onmouseout="if(!${isSelected})this.style.background='var(--bg-surface)'">
            ${mode === 'team'
              ? teamAv(item.logo_url, name, item.color)
              : av(item.users?.avatar_url, name)}
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:${isSelected ? 700 : 500};
                color:var(--text-primary);white-space:nowrap;
                overflow:hidden;text-overflow:ellipsis">${name}</div>
              ${subline ? `<div style="font-size:12px;color:var(--text-tertiary)">${subline}</div>` : ''}
            </div>
            ${isSelected ? `<span style="color:var(--gn-orange);font-size:18px">✓</span>` : ''}
          </div>`
      }).join('')}
    </div>`
}



// ── Main render ───────────────────────────────────────────────
export async function render(root, params) {
  const leagueId = params?.id
  if (!leagueId) { navigate('/home'); return }

  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'leagues' })
  await shell.mount(root)
  window.navigate = navigate

  // Loading skeleton
  shell.setContent(`<div dir="rtl">
    <div class="skeleton" style="height:32px;width:120px;border-radius:var(--radius-md);margin-bottom:var(--space-4)"></div>
    <div class="skeleton" style="height:56px;border-radius:var(--radius-lg);margin-bottom:var(--space-4)"></div>
    <div class="skeleton" style="height:300px;border-radius:var(--radius-lg)"></div>
  </div>`)

  const [league, members, teams] = await Promise.all([
    fetchLeague(leagueId),
    fetchMembers(leagueId),
    fetchTeams(leagueId),
  ])

  if (!league) {
    shell.setContent(`<div dir="rtl" class="empty-state" style="margin-top:var(--space-12)">
      <h3>ליגה לא נמצאה</h3>
      <button class="btn btn-primary btn-sm" style="margin-top:var(--space-4)"
        onclick="navigate('/home')">חזרה</button>
    </div>`)
    return
  }

  // Permission check — admin or owner only
  const myMembership = members.find(m => m.user_id === authUser.id)
  if (!myMembership || myMembership.role !== 'admin') {
    shell.setContent(`<div dir="rtl" class="empty-state" style="margin-top:var(--space-12)">
      <div style="font-size:48px;margin-bottom:var(--space-4)">🔒</div>
      <h3>אין הרשאה</h3>
      <p>רק מנהל הליגה יכול להוסיף משחקים</p>
      <button class="btn btn-primary btn-sm" style="margin-top:var(--space-4)"
        onclick="navigate('/league/${leagueId}')">חזרה לליגה</button>
    </div>`)
    return
  }

  if (league.is_locked) {
    shell.setContent(`<div dir="rtl" class="empty-state" style="margin-top:var(--space-12)">
      <div style="font-size:48px;margin-bottom:var(--space-4)">🔒</div>
      <h3>ליגה נעולה</h3>
      <p>לא ניתן להוסיף משחקים לליגה נעולה</p>
      <button class="btn btn-primary btn-sm" style="margin-top:var(--space-4)"
        onclick="navigate('/league/${leagueId}')">חזרה לליגה</button>
    </div>`)
    return
  }

  // ── State ─────────────────────────────────────────────────
  const hasTeams = teams.length > 0
  let mode         = hasTeams ? 'team' : 'player'
  let homeId       = null
  let awayId       = null
  let isSubmitting = false

  // ── Renderers ─────────────────────────────────────────────
  const renderPage = () => {
    const items      = mode === 'team' ? teams : members
    const homeLabel  = mode === 'team' ? 'קבוצת בית' : 'שחקן בית'
    const awayLabel  = mode === 'team' ? 'קבוצת אורחים' : 'שחקן אורחים'
    const homeName   = mode === 'team'
      ? teams.find(t => t.id === homeId)?.name
      : members.find(m => m.user_id === homeId)
          ? (members.find(m => m.user_id === homeId)?.player_name ||
             members.find(m => m.user_id === homeId)?.users?.display_name)
          : null
    const awayName   = mode === 'team'
      ? teams.find(t => t.id === awayId)?.name
      : members.find(m => m.user_id === awayId)
          ? (members.find(m => m.user_id === awayId)?.player_name ||
             members.find(m => m.user_id === awayId)?.users?.display_name)
          : null

    return `
      <div dir="rtl" style="max-width:560px;margin:0 auto">

        <!-- Back -->
        <button class="btn btn-ghost btn-sm" style="margin-bottom:var(--space-4)"
          onclick="navigate('/league/${leagueId}')">← חזרה לליגה</button>

        <!-- Header -->
        <div style="margin-bottom:var(--space-5)">
          <h1 style="font-size:var(--text-xl);font-weight:700;
            color:var(--text-primary);margin-bottom:4px">הוסף משחק</h1>
          <p style="font-size:var(--text-sm);color:var(--text-tertiary)">${league.name}</p>
        </div>

        <!-- Mode toggle (only if has teams) -->
        ${hasTeams ? `
          <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-5)">
            <button class="chip ${mode==='player'?'active':''}"
              onclick="setMode('player')">👤 שחקן מול שחקן</button>
            <button class="chip ${mode==='team'?'active':''}"
              onclick="setMode('team')">👥 קבוצה מול קבוצה</button>
          </div>` : ''
        }

        <!-- Home picker -->
        <div class="card" style="margin-bottom:var(--space-4)">
          <div class="card-body">
            <div style="display:flex;align-items:center;justify-content:space-between;
              margin-bottom:var(--space-3)">
              <h3 style="font-size:14px;font-weight:600;color:var(--text-primary)">
                🏠 ${homeLabel}
              </h3>
              ${homeId ? `
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:13px;font-weight:600;color:var(--gn-orange-dim)">
                    ${homeName}
                  </span>
                  <button class="btn btn-ghost btn-sm" onclick="clearHome()"
                    style="padding:2px 8px;font-size:11px">שנה</button>
                </div>` : ''
              }
            </div>
            ${homeId
              ? `<div style="padding:var(--space-2) 0;color:var(--text-tertiary);
                  font-size:13px">✓ נבחר</div>`
              : pickerCard(
                  items.filter(i => (mode==='team' ? i.id : i.user_id) !== awayId),
                  homeId, 'selectHome', mode
                )
            }
          </div>
        </div>

        <!-- VS divider -->
        <div style="text-align:center;margin:var(--space-2) 0;
          font-size:20px;font-weight:700;color:var(--text-tertiary)">VS</div>

        <!-- Away picker -->
        <div class="card" style="margin-bottom:var(--space-5)">
          <div class="card-body">
            <div style="display:flex;align-items:center;justify-content:space-between;
              margin-bottom:var(--space-3)">
              <h3 style="font-size:14px;font-weight:600;color:var(--text-primary)">
                ✈️ ${awayLabel}
              </h3>
              ${awayId ? `
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:13px;font-weight:600;color:var(--gn-orange-dim)">
                    ${awayName}
                  </span>
                  <button class="btn btn-ghost btn-sm" onclick="clearAway()"
                    style="padding:2px 8px;font-size:11px">שנה</button>
                </div>` : ''
              }
            </div>
            ${awayId
              ? `<div style="padding:var(--space-2) 0;color:var(--text-tertiary);
                  font-size:13px">✓ נבחר</div>`
              : pickerCard(
                  items.filter(i => (mode==='team' ? i.id : i.user_id) !== homeId),
                  awayId, 'selectAway', mode
                )
            }
          </div>
        </div>

        <!-- Score (only if both selected) -->
        ${homeId && awayId ? `
          <div class="card" style="margin-bottom:var(--space-4)">
            <div class="card-body">
              <h3 style="font-size:14px;font-weight:600;color:var(--text-primary);
                margin-bottom:var(--space-4)">תוצאה</h3>

              <!-- Score inputs -->
              <div style="display:flex;align-items:center;justify-content:center;
                gap:var(--space-5);margin-bottom:var(--space-4)">
                <div style="text-align:center;flex:1">
                  <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);
                    text-transform:uppercase;letter-spacing:.5px;margin-bottom:var(--space-2)">
                    ${homeName}
                  </div>
                  <input type="number" id="home-score" min="0" max="999" placeholder="0"
                    style="${inputStyle('text-align:center;font-size:28px;font-weight:700')}"
                    onfocus="this.style.borderColor='var(--gn-orange)'"
                    onblur="this.style.borderColor='var(--border-mid)'">
                </div>

                <div style="font-size:24px;font-weight:700;color:var(--text-tertiary);
                  padding-top:20px">:</div>

                <div style="text-align:center;flex:1">
                  <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);
                    text-transform:uppercase;letter-spacing:.5px;margin-bottom:var(--space-2)">
                    ${awayName}
                  </div>
                  <input type="number" id="away-score" min="0" max="999" placeholder="0"
                    style="${inputStyle('text-align:center;font-size:28px;font-weight:700')}"
                    onfocus="this.style.borderColor='var(--gn-orange)'"
                    onblur="this.style.borderColor='var(--border-mid)'">
                </div>
              </div>

              <!-- Date played -->
              <div style="margin-bottom:var(--space-3)">
                <label style="font-size:13px;font-weight:600;color:var(--text-primary);
                  display:block;margin-bottom:var(--space-2)">
                  תאריך המשחק
                  <span style="font-weight:400;color:var(--text-tertiary)">(אופציונלי)</span>
                </label>
                <input type="datetime-local" id="played-at"
                  value="${new Date().toISOString().slice(0,16)}"
                  style="${inputStyle()}"
                  onfocus="this.style.borderColor='var(--gn-orange)'"
                  onblur="this.style.borderColor='var(--border-mid)'">
              </div>

              <!-- Save as scheduled option -->
              <label style="display:flex;align-items:center;gap:var(--space-2);
                cursor:pointer;font-size:13px;color:var(--text-secondary)">
                <input type="checkbox" id="save-scheduled"
                  style="accent-color:var(--gn-orange);width:16px;height:16px">
                שמור כמשחק מתוכנן (ללא תוצאה עדיין)
              </label>
            </div>
          </div>

          <!-- Error -->
          <div id="form-error" style="display:none;margin-bottom:var(--space-3);
            padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);
            background:#fff5f5;border:1px solid #f5c6c6;
            font-size:13px;color:#dc3545"></div>

          <!-- Submit buttons -->
          <div style="display:flex;gap:var(--space-3)">
            <button id="submit-btn" class="btn btn-primary"
              style="flex:1;padding:14px;font-size:var(--text-base)"
              onclick="submitGame()">
              שמור משחק
            </button>
            <button class="btn btn-ghost" onclick="navigate('/league/${leagueId}')">
              ביטול
            </button>
          </div>` : `

          <!-- Prompt to select both -->
          <div style="text-align:center;padding:var(--space-6);
            color:var(--text-tertiary);font-size:14px">
            ${!homeId && !awayId
              ? 'בחר את שני הצדדים כדי להמשיך'
              : !homeId
              ? 'בחר את צד הבית'
              : 'בחר את צד האורחים'}
          </div>`
        }

      </div>`
  }

  shell.setContent(renderPage())

  // ── Handlers ──────────────────────────────────────────────
  window.setMode = (m) => {
    mode = m; homeId = null; awayId = null
    shell.setContent(renderPage())
  }

  window.selectHome = (id) => {
    if (id === awayId) return
    homeId = id
    shell.setContent(renderPage())
  }

  window.selectAway = (id) => {
    if (id === homeId) return
    awayId = id
    shell.setContent(renderPage())
  }

  window.clearHome = () => { homeId = null; shell.setContent(renderPage()) }
  window.clearAway = () => { awayId = null; shell.setContent(renderPage()) }

  window.submitGame = async () => {
    if (isSubmitting) return
    isSubmitting = true

    const btn        = document.getElementById('submit-btn')
    const errEl      = document.getElementById('form-error')
    const scheduled  = document.getElementById('save-scheduled')?.checked
    const playedAtEl = document.getElementById('played-at')

    const showErr = (msg) => {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block' }
      isSubmitting = false
      if (btn) { btn.disabled = false; btn.textContent = 'שמור משחק' }
    }

    if (btn) { btn.disabled = true; btn.textContent = 'שומר...' }
    if (errEl) errEl.style.display = 'none'

    try {
      if (scheduled) {
        // Insert as scheduled — no scores
        const payload = {
          league_id: leagueId,
          status:    'scheduled',
          played_at: playedAtEl?.value ? new Date(playedAtEl.value).toISOString() : null,
        }
        if (mode === 'team') {
          payload.home_team_id = homeId
          payload.away_team_id = awayId
        } else {
          payload.home_player_id = homeId
          payload.away_player_id = awayId
        }
        const { error } = await supabase.from('games').insert(payload)
        if (error) throw error

      } else {
        // Completed game with scores
        const homeScoreVal = parseInt(document.getElementById('home-score')?.value)
        const awayScoreVal = parseInt(document.getElementById('away-score')?.value)

        if (isNaN(homeScoreVal) || isNaN(awayScoreVal)) {
          showErr('יש להכניס תוצאה תקינה לשני הצדדים')
          return
        }
        if (homeScoreVal < 0 || awayScoreVal < 0) {
          showErr('תוצאה לא יכולה להיות שלילית')
          return
        }

        // Insert game first, then update via recordGameResult
        const payload = {
          league_id:   leagueId,
          status:      'scheduled',
          played_at:   playedAtEl?.value
            ? new Date(playedAtEl.value).toISOString()
            : new Date().toISOString(),
        }
        if (mode === 'team') {
          payload.home_team_id = homeId
          payload.away_team_id = awayId
        } else {
          payload.home_player_id = homeId
          payload.away_player_id = awayId
        }

        const { data: game, error: insertErr } = await supabase
          .from('games').insert(payload).select('id').single()
        if (insertErr) throw insertErr

        await recordGameResult({
          gameId:     game.id,
          homeScore:  homeScoreVal,
          awayScore:  awayScoreVal,
          recordedBy: authUser.id,
        })
      }

      // ── Success ────────────────────────────────────────
      shell.setContent(`
        <div dir="rtl" style="max-width:480px;margin:var(--space-12) auto;text-align:center">
          <div style="font-size:64px;margin-bottom:var(--space-4)">
            ${scheduled ? '📅' : '✅'}
          </div>
          <h2 style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);
            margin-bottom:var(--space-2)">
            ${scheduled ? 'המשחק נוסף ללוח' : 'התוצאה נשמרה!'}
          </h2>
          <p style="color:var(--text-secondary);margin-bottom:var(--space-6)">
            ${scheduled
              ? 'המשחק נוסף כמתוכנן. תוכל לעדכן את התוצאה לאחר שישוחק.'
              : 'הטבלה עודכנה אוטומטית.'}
          </p>
          <div style="display:flex;flex-direction:column;gap:var(--space-3)">
            <button class="btn btn-primary" style="padding:14px"
              onclick="navigate('/league/${leagueId}')">
              חזרה לליגה
            </button>
            <button class="btn btn-ghost" onclick="navigate('/league/${leagueId}/games/add')">
              הוסף משחק נוסף
            </button>
          </div>
        </div>`)

    } catch (err) {
      console.error('[AddGame]', err)
      showErr(err.message || 'שגיאה בשמירת המשחק. נסה שוב.')
    }
  }
}
