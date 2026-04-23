// ── pages/SettingsPage.js ────────────────────────────────────
// Settings page sections:
//   1. Profile — display name, username, bio, avatar
//   2. Plan — current plan, usage stats, upgrade CTA
//   3. XP history — last 10 events
//   4. Preferences — locale, theme
//   5. Danger zone — sign out

import { AppShell }     from '../components/AppShell.js'
import { getCurrentUser, getUserProfile, signOut } from '../lib/auth.js'
import { getXpHistory, getXpConfig, xpProgress, XP_LABELS } from '../lib/xp.js'
import { supabase }     from '../lib/supabase.js'
import { navigate }     from '../router.js'

// ── Fetch monthly league count ────────────────────────────────
async function fetchMonthlyLeagueCount(userId) {
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 30)
  const { count } = await supabase
    .from('leagues')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .gte('created_at', windowStart.toISOString())
  return count || 0
}

// ── Fetch system config limits ────────────────────────────────
async function fetchLimits(plan) {
  const key = plan === 'pro' ? 'league_monthly_limit_pro' : 'league_monthly_limit_free'
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', key)
    .single()
  return parseInt(data?.value || (plan === 'pro' ? 10 : 2))
}

// ── Upload avatar ─────────────────────────────────────────────
async function uploadAvatar(file, userId) {
  const ext  = file.name.split('.').pop()
  const path = `avatars/${userId}.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

// ── Section wrapper ───────────────────────────────────────────
function section(title, content, id = '') {
  return `
    <div class="card" style="margin-bottom:var(--space-4)" ${id ? `id="${id}"` : ''}>
      <div class="card-body">
        <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);
          margin-bottom:var(--space-4);padding-bottom:var(--space-3);
          border-bottom:1px solid var(--border-light)">${title}</h3>
        ${content}
      </div>
    </div>`
}

function fieldRow(label, input, hint = '') {
  return `
    <div style="margin-bottom:var(--space-4)">
      <label style="font-size:13px;font-weight:600;color:var(--text-primary);
        display:block;margin-bottom:var(--space-2)">${label}</label>
      ${input}
      ${hint ? `<p style="font-size:11px;color:var(--text-tertiary);margin-top:4px">${hint}</p>` : ''}
    </div>`
}

const inp = (id, val, ph = '', type = 'text', extra = '') =>
  `<input type="${type}" id="${id}" value="${val || ''}" placeholder="${ph}" dir="rtl"
    style="width:100%;padding:10px var(--space-3);border-radius:var(--radius-md);
      border:1.5px solid var(--border-mid);background:var(--bg-surface);
      color:var(--text-primary);font-family:var(--font-base);font-size:14px;
      transition:border-color var(--transition-fast);${extra}"
    onfocus="this.style.borderColor='var(--gn-orange)'"
    onblur="this.style.borderColor='var(--border-mid)'">`

// ── Main render ───────────────────────────────────────────────
export async function render(root) {
  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'profile' })
  await shell.mount(root)
  window.navigate = navigate

  // Skeleton
  shell.setContent(`<div dir="rtl">
    ${[200,160,140,100].map(h =>
      `<div class="skeleton" style="height:${h}px;border-radius:var(--radius-lg);
        margin-bottom:var(--space-4)"></div>`
    ).join('')}
  </div>`)

  // Fetch data in parallel
  const [xpHistory, monthlyCount, limit] = await Promise.all([
    getXpHistory(authUser.id, 10),
    fetchMonthlyLeagueCount(authUser.id),
    fetchLimits(profile?.plan),
  ])

  const isPro    = profile?.plan === 'pro'
  const { pct, toNext, nextLevel } = xpProgress(profile?.xp_total || 0, profile?.level || 1)
  const card     = profile?.player_cards
  const initials = (profile?.display_name || '?').split(' ')
    .map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const renderPage = () => `
    <div dir="rtl" style="max-width:560px;margin:0 auto">

      <h1 style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);
        margin-bottom:var(--space-6)">הגדרות</h1>

      <!-- ── 1. Profile ───────────────────────────────── -->
      ${section('פרופיל', `

        <!-- Avatar -->
        <div style="display:flex;align-items:center;gap:var(--space-4);
          margin-bottom:var(--space-5)">
          <div style="position:relative">
            <div id="avatar-display" style="width:72px;height:72px;border-radius:50%;
              overflow:hidden;border:3px solid var(--border-mid);cursor:pointer;
              background:var(--gn-orange)"
              onclick="document.getElementById('avatar-input').click()">
              ${profile?.avatar_url
                ? `<img src="${profile.avatar_url}" width="72" height="72"
                    style="object-fit:cover;display:block" id="avatar-img">`
                : `<div style="width:72px;height:72px;display:flex;align-items:center;
                    justify-content:center;font-size:26px;font-weight:700;color:#fff">
                    ${initials}</div>`}
            </div>
            <div style="position:absolute;bottom:0;inset-inline-end:0;
              width:22px;height:22px;border-radius:50%;
              background:var(--gn-orange);border:2px solid var(--bg-surface);
              display:flex;align-items:center;justify-content:center;
              cursor:pointer;font-size:11px;color:#fff"
              onclick="document.getElementById('avatar-input').click()">✏️</div>
          </div>
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--text-primary)">
              ${profile?.display_name || '—'}
            </div>
            <button class="btn btn-secondary btn-sm" style="margin-top:var(--space-2)"
              onclick="document.getElementById('avatar-input').click()">
              החלף תמונה
            </button>
            <input type="file" id="avatar-input" accept="image/*" hidden
              onchange="handleAvatarUpload(event)">
          </div>
        </div>

        ${fieldRow('שם תצוגה', inp('display-name', profile?.display_name, 'שם מלא'))}
        ${fieldRow('שם משתמש',
          `<div style="display:flex;align-items:center;gap:0">
            <span style="padding:10px var(--space-3);background:var(--bg-surface-2);
              border:1.5px solid var(--border-mid);border-inline-end:none;
              border-radius:var(--radius-md) 0 0 var(--radius-md);
              font-size:14px;color:var(--text-tertiary);white-space:nowrap">@</span>
            ${inp('username', profile?.username, 'username',
              'text', 'border-radius:0 var(--radius-md) var(--radius-md) 0')}
          </div>`,
          'שם ייחודי — אותיות באנגלית, מספרים וקו תחתי בלבד'
        )}
        ${fieldRow('ביו',
          `<textarea id="bio" maxlength="160" dir="rtl" placeholder="כמה מילים עליך..."
            style="width:100%;padding:10px var(--space-3);border-radius:var(--radius-md);
              border:1.5px solid var(--border-mid);background:var(--bg-surface);
              color:var(--text-primary);font-family:var(--font-base);font-size:14px;
              resize:vertical;min-height:80px;transition:border-color var(--transition-fast)"
            onfocus="this.style.borderColor='var(--gn-orange)'"
            onblur="this.style.borderColor='var(--border-mid)'"
          >${profile?.bio || ''}</textarea>`,
          `<span id="bio-count">${(profile?.bio || '').length}</span> / 160`
        )}

        <div id="profile-error" style="display:none;margin-bottom:var(--space-3);
          padding:var(--space-3);border-radius:var(--radius-md);
          background:#fff5f5;border:1px solid #f5c6c6;
          font-size:13px;color:#dc3545"></div>
        <div id="profile-success" style="display:none;margin-bottom:var(--space-3);
          padding:var(--space-3);border-radius:var(--radius-md);
          background:#f0fff4;border:1px solid #9ae6b4;
          font-size:13px;color:#276749">השינויים נשמרו ✓</div>

        <button class="btn btn-primary" id="save-profile-btn"
          onclick="saveProfile()">שמור שינויים</button>

      `)}

      <!-- ── 2. Plan ───────────────────────────────────── -->
      ${section('תוכנית', `

        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-bottom:var(--space-4)">
          <div>
            <div style="font-size:20px;font-weight:700;color:var(--text-primary)">
              ${isPro
                ? `<span class="badge badge-pro" style="font-size:14px;padding:4px 14px">PRO</span>`
                : `<span class="badge badge-free" style="font-size:14px;padding:4px 14px">Free</span>`}
            </div>
            <div style="font-size:13px;color:var(--text-tertiary);margin-top:4px">
              ${isPro ? 'גישה מלאה לכל הפיצ׳רים' : 'גרסת חינם עם פרסומות'}
            </div>
          </div>
          ${!isPro ? `
            <button class="btn btn-primary"
              style="background:linear-gradient(135deg,#FF9B51,#E07A30)"
              onclick="navigate('/upgrade')">
              ⬆️ שדרג ל-Pro
            </button>` : ''
          }
        </div>

        <!-- Usage: monthly leagues -->
        <div style="margin-bottom:var(--space-4)">
          <div style="display:flex;justify-content:space-between;
            font-size:13px;margin-bottom:var(--space-2)">
            <span style="color:var(--text-secondary)">ליגות שנוצרו החודש</span>
            <span style="font-weight:600;color:var(--text-primary)">
              ${monthlyCount} / ${limit}
            </span>
          </div>
          <div class="xp-bar-track" style="height:6px">
            <div class="xp-bar-fill"
              style="width:${Math.min(100, Math.round(monthlyCount/limit*100))}%;height:100%;
                background:${monthlyCount >= limit ? '#dc3545' : 'var(--gn-orange)'}">
            </div>
          </div>
          ${monthlyCount >= limit ? `
            <p style="font-size:12px;color:#dc3545;margin-top:4px">
              הגעת למגבלה החודשית.
              ${!isPro ? 'שדרג ל-Pro ליצירת עד 10 ליגות בחודש.' : ''}
            </p>` : ''
          }
        </div>

        <!-- Plan features comparison -->
        <div style="border:1px solid var(--border-light);border-radius:var(--radius-md);
          overflow:hidden;font-size:13px">
          ${[
            ['ליגות בחודש', '2', '10'],
            ['שחקנים לליגה', '30', 'ללא הגבלה'],
            ['לוגו מותאם', '✗', '✓'],
            ['סטטיסטיקות מתקדמות', '✗', '✓'],
            ['ייצוא נתונים', '✗', '✓'],
            ['דף ספונסר', '✗', '✓'],
            ['פרסומות', '✓', '✗'],
          ].map(([feat, free, pro], i) => `
            <div style="display:flex;align-items:center;
              background:${i%2===0?'var(--bg-surface)':'var(--bg-surface-2)'};
              border-bottom:${i<6?'1px solid var(--border-light)':'none'}">
              <div style="flex:2;padding:10px var(--space-3);
                color:var(--text-secondary)">${feat}</div>
              <div style="flex:1;padding:10px var(--space-3);text-align:center;
                color:${isPro?'var(--text-tertiary)':'var(--text-primary)'};
                font-weight:${!isPro?600:400}">${free}</div>
              <div style="flex:1;padding:10px var(--space-3);text-align:center;
                color:${isPro?'var(--gn-orange-dim)':'var(--text-tertiary)'};
                font-weight:${isPro?600:400}">${pro}</div>
            </div>`).join('')}
        </div>

      `)}

      <!-- ── 3. XP History ─────────────────────────────── -->
      ${section('היסטוריית XP', `

        <!-- Level + progress -->
        <div style="display:flex;align-items:center;gap:var(--space-3);
          margin-bottom:var(--space-4)">
          <div style="width:52px;height:52px;border-radius:50%;
            background:var(--gn-orange-pale);
            display:flex;align-items:center;justify-content:center;
            font-size:18px;font-weight:700;color:var(--gn-orange-dim)">
            ${profile?.level || 1}
          </div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;
              font-size:12px;color:var(--text-tertiary);margin-bottom:4px">
              <span>רמה ${profile?.level || 1}</span>
              <span>${toNext} XP לרמה ${nextLevel}</span>
            </div>
            <div class="xp-bar-track" style="height:8px">
              <div class="xp-bar-fill" style="width:${pct}%;height:100%"></div>
            </div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">
              סה"כ: ${(profile?.xp_total || 0).toLocaleString()} XP
            </div>
          </div>
        </div>

        <!-- History list -->
        ${xpHistory.length === 0
          ? `<p style="font-size:13px;color:var(--text-tertiary);text-align:center;
              padding:var(--space-4) 0">אין עדיין אירועי XP</p>`
          : xpHistory.map(ev => `
              <div style="display:flex;align-items:center;justify-content:space-between;
                padding:var(--space-2) 0;border-bottom:1px solid var(--border-light)">
                <span style="font-size:13px;color:var(--text-secondary)">
                  ${XP_LABELS[ev.event_type] || ev.event_type}
                </span>
                <div style="display:flex;align-items:center;gap:var(--space-3)">
                  <span style="font-size:13px;font-weight:700;color:var(--gn-orange-dim)">
                    +${ev.xp_delta} XP
                  </span>
                  <span style="font-size:11px;color:var(--text-tertiary)">
                    ${new Date(ev.created_at).toLocaleDateString('he-IL')}
                  </span>
                </div>
              </div>`).join('')
        }

      `)}

      <!-- ── 4. Preferences ───────────────────────────── -->
      ${section('העדפות', `

        <!-- Language -->
        <div style="margin-bottom:var(--space-5)">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);
            margin-bottom:var(--space-2)">שפה</div>
          <div style="display:flex;gap:var(--space-2)">
            ${['he','en'].map(loc => `
              <button class="chip ${profile?.locale===loc?'active':''}"
                id="locale-${loc}" onclick="setLocale('${loc}')">
                ${loc === 'he' ? '🇮🇱 עברית' : '🇺🇸 English'}
              </button>`).join('')}
          </div>
        </div>

        <!-- Theme -->
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary);
            margin-bottom:var(--space-2)">מצב תצוגה</div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="chip" id="theme-light" onclick="applyTheme('light')">
              ☀️ בהיר
            </button>
            <button class="chip" id="theme-dark" onclick="applyTheme('dark')">
              🌙 כהה
            </button>
            <button class="chip" id="theme-system" onclick="applyTheme('system')">
              💻 מערכת
            </button>
          </div>
        </div>

      `)}

      <!-- ── 5. Danger zone ────────────────────────────── -->
      <div class="card" style="border-color:#f5c6c6;margin-bottom:var(--space-8)">
        <div class="card-body">
          <h3 style="font-size:15px;font-weight:700;color:#dc3545;
            margin-bottom:var(--space-4);padding-bottom:var(--space-3);
            border-bottom:1px solid #f5c6c6">אזור מסוכן</h3>
          <button class="btn btn-ghost" style="color:#dc3545;border-color:#f5c6c6"
            onclick="confirmSignOut()">
            יציאה מהחשבון
          </button>
        </div>
      </div>

    </div>`

  shell.setContent(renderPage())

  // Init theme chip active state
  const savedTheme = localStorage.getItem('gn-theme') || 'system'
  document.getElementById(`theme-${savedTheme}`)?.classList.add('active')

  // Bio counter
  const bioEl = document.getElementById('bio')
  bioEl?.addEventListener('input', () => {
    const cnt = document.getElementById('bio-count')
    if (cnt) cnt.textContent = bioEl.value.length
  })

  // ── Handlers ──────────────────────────────────────────────
  window.handleAvatarUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('הקובץ גדול מ-5MB')
      return
    }
    // Preview immediately
    const reader = new FileReader()
    reader.onload = (e) => {
      const display = document.getElementById('avatar-display')
      if (display) {
        display.innerHTML = `<img src="${e.target.result}" width="72" height="72"
          style="object-fit:cover;display:block">`
      }
    }
    reader.readAsDataURL(file)

    try {
      const url = await uploadAvatar(file, authUser.id)
      await supabase.from('users').update({ avatar_url: url }).eq('id', authUser.id)
    } catch (err) {
      console.error('[Settings] avatar upload:', err)
    }
  }

  window.saveProfile = async () => {
    const btn      = document.getElementById('save-profile-btn')
    const errEl    = document.getElementById('profile-error')
    const succEl   = document.getElementById('profile-success')
    const name     = document.getElementById('display-name')?.value?.trim()
    const username = document.getElementById('username')?.value?.trim()
    const bio      = document.getElementById('bio')?.value?.trim()

    errEl.style.display = 'none'
    succEl.style.display = 'none'

    if (!name || name.length < 2) {
      errEl.textContent = 'שם תצוגה חייב להכיל לפחות 2 תווים'
      errEl.style.display = 'block'
      return
    }

    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      errEl.textContent = 'שם משתמש יכול להכיל רק אותיות אנגליות, מספרים וקו תחתי'
      errEl.style.display = 'block'
      return
    }

    btn.disabled    = true
    btn.textContent = 'שומר...'

    try {
      const { error } = await supabase
        .from('users')
        .update({ display_name: name, username: username || null, bio: bio || null })
        .eq('id', authUser.id)

      if (error) {
        if (error.code === '23505') {
          errEl.textContent = 'שם המשתמש כבר תפוס — נסה שם אחר'
        } else {
          errEl.textContent = error.message
        }
        errEl.style.display = 'block'
      } else {
        succEl.style.display = 'block'
        setTimeout(() => { succEl.style.display = 'none' }, 3000)
      }
    } catch (err) {
      errEl.textContent = 'שגיאה בשמירה. נסה שוב.'
      errEl.style.display = 'block'
    } finally {
      btn.disabled    = false
      btn.textContent = 'שמור שינויים'
    }
  }

  window.setLocale = async (locale) => {
    document.querySelectorAll('[id^="locale-"]').forEach(b => b.classList.remove('active'))
    document.getElementById(`locale-${locale}`)?.classList.add('active')
    window.setLocale?.(locale)
    await supabase.from('users').update({ locale }).eq('id', authUser.id)
  }

  window.applyTheme = (theme) => {
    document.querySelectorAll('[id^="theme-"]').forEach(b => b.classList.remove('active'))
    document.getElementById(`theme-${theme}`)?.classList.add('active')
    if (theme === 'system') {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', sys)
      localStorage.removeItem('gn-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('gn-theme', theme)
    }
  }

  window.confirmSignOut = async () => {
    if (confirm('האם אתה בטוח שברצונך לצאת?')) {
      await signOut()
    }
  }
}
