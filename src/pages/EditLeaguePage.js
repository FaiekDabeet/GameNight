// ── pages/EditLeaguePage.js ──────────────────────────────────
// Edit league page — admin/owner only
// Sections:
//   1. Basic info (name, sport, season, visibility)
//   2. Cover image + logo (Pro)
//   3. Complete season
//   4. Lock/unlock league manually
//   5. Danger zone — delete league

import { AppShell }      from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { completeSeason } from '../lib/actions.js'
import { supabase }      from '../lib/supabase.js'
import { navigate }      from '../router.js'

const SPORTS = [
  { value: 'football',   label: '⚽ כדורגל' },
  { value: 'basketball', label: '🏀 כדורסל' },
  { value: 'padel',      label: '🎾 פאדל' },
  { value: 'tennis',     label: '🎾 טניס' },
  { value: 'volleyball', label: '🏐 כדורעף' },
  { value: 'chess',      label: '♟ שחמט' },
  { value: 'ping_pong',  label: '🏓 פינג פונג' },
  { value: 'poker',      label: '🃏 פוקר' },
  { value: 'backgammon', label: '🎲 שש-בש' },
  { value: 'darts',      label: '🎯 דארטס' },
  { value: 'other',      label: '🏆 אחר' },
]

async function fetchLeague(id) {
  const { data } = await supabase
    .from('leagues')
    .select('id, name, sport_type, cover_url, logo_url, season, is_public, is_locked, owner_id, invite_code')
    .eq('id', id).single()
  return data
}

async function uploadImage(file, userId, bucket) {
  const ext  = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(bucket).upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

const inp = (id, val, ph = '') =>
  `<input type="text" id="${id}" value="${(val||'').replace(/"/g,'&quot;')}"
    placeholder="${ph}" dir="rtl"
    style="width:100%;padding:10px 12px;border-radius:10px;
      border:1.5px solid var(--border-mid);background:var(--bg-surface);
      color:var(--text-primary);font-family:var(--font-base);font-size:14px;
      transition:border-color 0.15s"
    onfocus="this.style.borderColor='var(--gn-orange)'"
    onblur="this.style.borderColor='var(--border-mid)'">`

function section(title, content, danger = false) {
  return `
    <div class="card" style="margin-bottom:16px;
      ${danger ? 'border-color:#f5c6c6' : ''}">
      <div class="card-body">
        <h3 style="font-size:15px;font-weight:700;
          color:${danger ? '#dc3545' : 'var(--text-primary)'};
          margin-bottom:16px;padding-bottom:12px;
          border-bottom:1px solid ${danger ? '#f5c6c6' : 'var(--border-light)'}">
          ${title}
        </h3>
        ${content}
      </div>
    </div>`
}

export async function render(root, params) {
  const leagueId = params?.id
  if (!leagueId) { navigate('/home'); return }

  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile  = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'leagues' })
  await shell.mount(root)
  window.navigate = navigate

  shell.setContent(`<div dir="rtl">
    ${[200,160,120].map(h => `<div class="skeleton"
      style="height:${h}px;border-radius:12px;margin-bottom:12px"></div>`).join('')}
  </div>`)

  const league = await fetchLeague(leagueId)

  if (!league) {
    shell.setContent(`<div dir="rtl" class="empty-state" style="margin-top:48px">
      <h3>ליגה לא נמצאה</h3>
      <button class="btn btn-primary btn-sm" style="margin-top:16px"
        onclick="navigate('/home')">חזרה</button>
    </div>`)
    return
  }

  if (league.owner_id !== authUser.id) {
    shell.setContent(`<div dir="rtl" class="empty-state" style="margin-top:48px">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <h3>אין הרשאה</h3>
      <p>רק בעל הליגה יכול לערוך אותה</p>
      <button class="btn btn-primary btn-sm" style="margin-top:16px"
        onclick="navigate('/league/${leagueId}')">חזרה לליגה</button>
    </div>`)
    return
  }

  const isPro       = profile?.plan === 'pro'
  let coverFile     = null
  let logoFile      = null
  let coverPreview  = league.cover_url
  let logoPreview   = league.logo_url
  let isSubmitting  = false

  const renderPage = () => `
    <div dir="rtl" style="max-width:560px;margin:0 auto">

      <!-- Back -->
      <button class="btn btn-ghost btn-sm" style="margin-bottom:16px"
        onclick="navigate('/league/${leagueId}')">← חזרה לליגה</button>

      <div style="margin-bottom:24px">
        <h1 style="font-size:22px;font-weight:700;color:var(--text-primary);margin-bottom:4px">
          עריכת ליגה
        </h1>
        <p style="font-size:13px;color:var(--text-tertiary)">${league.name}</p>
      </div>

      ${league.is_locked ? `
        <div style="padding:12px 16px;border-radius:10px;
          background:#fff3cd;border:1px solid #ffc107;
          font-size:13px;color:#856404;margin-bottom:16px">
          🔒 הליגה נעולה — ניתן לערוך רק כדי לפתוח אותה
        </div>` : ''
      }

      <!-- 1. Basic info -->
      ${section('פרטי ליגה', `
        <div style="margin-bottom:16px">
          <label style="font-size:13px;font-weight:600;color:var(--text-primary);
            display:block;margin-bottom:8px">שם הליגה *</label>
          ${inp('edit-name', league.name, 'שם הליגה')}
        </div>

        <div style="margin-bottom:16px">
          <label style="font-size:13px;font-weight:600;color:var(--text-primary);
            display:block;margin-bottom:8px">ענף ספורט *</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px" id="sport-chips">
            ${SPORTS.map(s => `
              <button type="button" class="chip ${league.sport_type===s.value?'active':''}"
                data-sport="${s.value}" onclick="selectSport('${s.value}')">
                ${s.label}
              </button>`).join('')}
          </div>
        </div>

        <div style="margin-bottom:16px">
          <label style="font-size:13px;font-weight:600;color:var(--text-primary);
            display:block;margin-bottom:8px">עונה</label>
          ${inp('edit-season', league.season, 'למשל: 2024-25')}
        </div>

        <div>
          <label style="font-size:13px;font-weight:600;color:var(--text-primary);
            display:block;margin-bottom:8px">נראות</label>
          <div style="display:flex;gap:12px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
              flex:1;padding:12px;border:1.5px solid var(--border-mid);
              border-radius:10px" id="vis-public-lbl"
              style="border-color:${league.is_public?'var(--gn-orange)':'var(--border-mid)'}">
              <input type="radio" name="visibility" value="public"
                ${league.is_public?'checked':''}
                onchange="setVis(true)" style="accent-color:var(--gn-orange)">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text-primary)">🌐 פומבית</div>
                <div style="font-size:11px;color:var(--text-tertiary)">מופיעה בחיפוש</div>
              </div>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
              flex:1;padding:12px;border:1.5px solid var(--border-mid);
              border-radius:10px" id="vis-private-lbl">
              <input type="radio" name="visibility" value="private"
                ${!league.is_public?'checked':''}
                onchange="setVis(false)" style="accent-color:var(--gn-orange)">
              <div>
                <div style="font-size:13px;font-weight:600;color:var(--text-primary)">🔒 פרטית</div>
                <div style="font-size:11px;color:var(--text-tertiary)">קוד בלבד</div>
              </div>
            </label>
          </div>
        </div>
      `)}

      <!-- 2. Images -->
      ${section('תמונות', `
        <!-- Cover -->
        <div style="margin-bottom:20px">
          <label style="font-size:13px;font-weight:600;color:var(--text-primary);
            display:block;margin-bottom:8px">תמונת כיסוי</label>
          <div id="cover-drop" style="width:100%;height:140px;border-radius:10px;
            border:2px dashed var(--border-mid);cursor:pointer;
            background:${coverPreview?`url(${coverPreview}) center/cover no-repeat`:'var(--bg-surface-2)'};
            display:flex;align-items:center;justify-content:center;
            position:relative;overflow:hidden"
            onclick="document.getElementById('cover-inp').click()">
            ${coverPreview ? `
              <button onclick="event.stopPropagation();clearCover()"
                style="position:absolute;top:8px;inset-inline-end:8px;
                  background:rgba(0,0,0,0.5);color:#fff;border:none;
                  border-radius:50%;width:28px;height:28px;cursor:pointer;
                  font-size:14px;display:flex;align-items:center;justify-content:center">✕
              </button>` : `
              <div style="text-align:center;color:var(--text-tertiary)">
                <div style="font-size:13px;font-weight:500">לחץ לבחירת תמונה</div>
                <div style="font-size:11px;margin-top:4px">JPG, PNG עד 5MB</div>
              </div>`}
          </div>
          <input type="file" id="cover-inp" accept="image/*" hidden
            onchange="handleCover(event)">
        </div>

        <!-- Logo (Pro only) -->
        <div>
          <label style="font-size:13px;font-weight:600;color:var(--text-primary);
            display:block;margin-bottom:8px">
            לוגו
            ${!isPro?`<span class="badge badge-pro" style="margin-inline-start:6px">Pro</span>`:''}
          </label>
          ${!isPro ? `
            <div style="padding:12px;border-radius:10px;background:var(--gn-orange-pale);
              border:1px solid var(--gn-orange);font-size:13px;color:var(--gn-orange-dim)">
              לוגו מותאם זמין בתוכנית Pro.
              <a href="/settings" style="font-weight:600">שדרג</a>
            </div>` : `
            <div style="display:flex;align-items:center;gap:12px">
              <div id="logo-preview" style="width:56px;height:56px;border-radius:8px;
                background:${logoPreview?`url(${logoPreview}) center/cover no-repeat`:'var(--bg-surface-2)'};
                border:1px solid var(--border-mid);cursor:pointer;flex-shrink:0"
                onclick="document.getElementById('logo-inp').click()"></div>
              <div>
                <button class="btn btn-secondary btn-sm"
                  onclick="document.getElementById('logo-inp').click()">בחר לוגו</button>
                ${logoPreview?`<button class="btn btn-ghost btn-sm" style="margin-inline-start:6px"
                  onclick="clearLogo()">הסר</button>`:''}
              </div>
            </div>
            <input type="file" id="logo-inp" accept="image/*" hidden
              onchange="handleLogo(event)">`
          }
        </div>
      `)}

      <!-- 3. Complete season -->
      ${section('סיום עונה', `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
          סיום עונה יעניק XP למנהל ויאפשר להתחיל עונה חדשה. הנתונים הנוכחיים נשמרים.
        </p>
        <div style="display:flex;gap:10px;align-items:flex-end">
          <div style="flex:1">
            <label style="font-size:13px;font-weight:600;color:var(--text-primary);
              display:block;margin-bottom:8px">שם העונה החדשה</label>
            ${inp('new-season', '', 'למשל: 2025-26')}
          </div>
          <button class="btn btn-secondary" style="white-space:nowrap"
            onclick="handleCompleteSeason()">
            סיים עונה 🏆
          </button>
        </div>
      `)}

      <!-- 4. Lock/unlock -->
      ${section(league.is_locked ? 'פתיחת ליגה' : 'נעילת ליגה', `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
          ${league.is_locked
            ? 'הליגה נעולה כרגע. פתיחתה תאפשר עריכה והוספת משחקים מחדש.'
            : 'נעילת הליגה תמנע עריכה והוספת משחקים. ניתן לפתוח בכל עת.'}
        </p>
        <button class="btn ${league.is_locked?'btn-primary':'btn-secondary'}"
          onclick="handleToggleLock()">
          ${league.is_locked ? '🔓 פתח ליגה' : '🔒 נעל ליגה'}
        </button>
      `)}

      <!-- Error / Success -->
      <div id="page-error" style="display:none;padding:12px 16px;
        border-radius:10px;background:#fff5f5;border:1px solid #f5c6c6;
        font-size:13px;color:#dc3545;margin-bottom:12px"></div>
      <div id="page-success" style="display:none;padding:12px 16px;
        border-radius:10px;background:#f0fff4;border:1px solid #9ae6b4;
        font-size:13px;color:#276749;margin-bottom:12px"></div>

      <!-- Save button -->
      ${!league.is_locked ? `
        <button id="save-btn" class="btn btn-primary w-full"
          style="padding:14px;font-size:16px;margin-bottom:12px"
          onclick="handleSave()">
          שמור שינויים
        </button>` : ''
      }

      <!-- 5. Danger zone -->
      ${section('אזור מסוכן', `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
          מחיקת ליגה היא פעולה בלתי הפיכה. כל הנתונים, המשחקים והטבלאות יימחקו לצמיתות.
        </p>
        <button class="btn btn-ghost" style="color:#dc3545;border-color:#f5c6c6"
          onclick="handleDelete()">
          🗑 מחק ליגה לצמיתות
        </button>
      `, true)}

    </div>`

  shell.setContent(renderPage())

  // ── State ─────────────────────────────────────────────────
  let selectedSport = league.sport_type
  let isPublic      = league.is_public

  // ── Handlers ──────────────────────────────────────────────
  const showErr  = (msg) => {
    const el = document.getElementById('page-error')
    if (el) { el.textContent = msg; el.style.display = 'block' }
    setTimeout(() => { if (el) el.style.display = 'none' }, 5000)
  }
  const showSucc = (msg) => {
    const el = document.getElementById('page-success')
    if (el) { el.textContent = msg; el.style.display = 'block' }
    setTimeout(() => { if (el) el.style.display = 'none' }, 3000)
  }

  window.selectSport = (val) => {
    selectedSport = val
    document.querySelectorAll('#sport-chips .chip').forEach(c =>
      c.classList.toggle('active', c.dataset.sport === val))
  }

  window.setVis = (pub) => {
    isPublic = pub
    const pubLbl = document.getElementById('vis-public-lbl')
    const prvLbl = document.getElementById('vis-private-lbl')
    if (pubLbl) pubLbl.style.borderColor = pub ? 'var(--gn-orange)' : 'var(--border-mid)'
    if (prvLbl) prvLbl.style.borderColor = !pub ? 'var(--gn-orange)' : 'var(--border-mid)'
  }

  window.handleCover = (e) => {
    const file = e.target.files[0]
    if (!file) return
    coverFile = file
    const reader = new FileReader()
    reader.onload = (ev) => {
      coverPreview = ev.target.result
      const drop = document.getElementById('cover-drop')
      if (drop) {
        drop.style.background = `url(${coverPreview}) center/cover no-repeat`
        drop.innerHTML = `
          <button onclick="event.stopPropagation();clearCover()"
            style="position:absolute;top:8px;inset-inline-end:8px;
              background:rgba(0,0,0,0.5);color:#fff;border:none;
              border-radius:50%;width:28px;height:28px;cursor:pointer;
              font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>`
      }
    }
    reader.readAsDataURL(file)
  }

  window.clearCover = () => {
    coverFile = null; coverPreview = null
    const drop = document.getElementById('cover-drop')
    if (drop) {
      drop.style.background = 'var(--bg-surface-2)'
      drop.innerHTML = `<div style="text-align:center;color:var(--text-tertiary)">
        <div style="font-size:13px;font-weight:500">לחץ לבחירת תמונה</div>
      </div>`
    }
  }

  window.handleLogo = (e) => {
    const file = e.target.files[0]
    if (!file) return
    logoFile = file
    const reader = new FileReader()
    reader.onload = (ev) => {
      logoPreview = ev.target.result
      const prev = document.getElementById('logo-preview')
      if (prev) prev.style.background = `url(${logoPreview}) center/cover no-repeat`
    }
    reader.readAsDataURL(file)
  }

  window.clearLogo = () => {
    logoFile = null; logoPreview = null
    const prev = document.getElementById('logo-preview')
    if (prev) prev.style.background = 'var(--bg-surface-2)'
  }

  window.handleSave = async () => {
    if (isSubmitting) return
    const name = document.getElementById('edit-name')?.value?.trim()
    if (!name || name.length < 3) { showErr('שם חייב להכיל לפחות 3 תווים'); return }
    if (!selectedSport) { showErr('יש לבחור ענף'); return }

    if (!confirm(`לשמור שינויים בליגה "${name}"? פעולה זו תיכנס לתוקף מיד.`)) return

    isSubmitting = true
    const btn = document.getElementById('save-btn')
    if (btn) { btn.disabled = true; btn.textContent = 'שומר...' }

    try {
      let coverUrl = league.cover_url
      let logoUrl  = league.logo_url

      if (coverFile) coverUrl = await uploadImage(coverFile, authUser.id, 'league-covers')
      if (logoFile && isPro) logoUrl = await uploadImage(logoFile, authUser.id, 'league-logos')
      if (!coverPreview) coverUrl = null
      if (!logoPreview)  logoUrl  = null

      const season = document.getElementById('edit-season')?.value?.trim() || null

      const { error } = await supabase
        .from('leagues')
        .update({ name, sport_type: selectedSport, season, is_public: isPublic,
          cover_url: coverUrl, logo_url: logoUrl })
        .eq('id', leagueId)
        .eq('owner_id', authUser.id)

      if (error) throw error
      showSucc('השינויים נשמרו ✓')
      league.name       = name
      league.sport_type = selectedSport
      league.season     = season
      league.is_public  = isPublic
      league.cover_url  = coverUrl
      league.logo_url   = logoUrl

    } catch (err) {
      showErr(err.message || 'שגיאה בשמירה')
    } finally {
      isSubmitting = false
      if (btn) { btn.disabled = false; btn.textContent = 'שמור שינויים' }
    }
  }

  window.handleCompleteSeason = async () => {
    const newSeason = document.getElementById('new-season')?.value?.trim()
    if (!newSeason) { showErr('יש להכניס שם לעונה החדשה'); return }
    if (!confirm(`לסיים את העונה הנוכחית ולהתחיל עונה "${newSeason}"? פעולה זו לא ניתנת לביטול.`)) return

    try {
      await completeSeason({ leagueId, ownerId: authUser.id, newSeason })
      showSucc(`עונה "${newSeason}" הוחלה ✓ קיבלת 200 XP!`)
      league.season = newSeason
      document.getElementById('new-season').value = ''
    } catch (err) {
      showErr(err.message || 'שגיאה בסיום עונה')
    }
  }

  window.handleToggleLock = async () => {
    const newLocked = !league.is_locked
    const msg = newLocked
      ? 'לנעול את הליגה? לא יהיה ניתן להוסיף משחקים או לערוך עד הפתיחה.'
      : 'לפתוח את הליגה? היא תחזור להיות פעילה.'
    if (!confirm(msg)) return

    try {
      const { error } = await supabase
        .from('leagues')
        .update({ is_locked: newLocked, last_activity_at: new Date().toISOString() })
        .eq('id', leagueId)
        .eq('owner_id', authUser.id)

      if (error) throw error
      league.is_locked = newLocked
      shell.setContent(renderPage())
      // Re-attach handlers after re-render
      window.selectSport(selectedSport)
    } catch (err) {
      showErr(err.message || 'שגיאה בנעילה')
    }
  }

  window.handleDelete = async () => {
    const typed = prompt(`מחיקת "${league.name}" היא פעולה בלתי הפיכה.
כתוב "מחק" לאישור:`)
    if (typed !== 'מחק') { showErr('מחיקה בוטלה'); return }

    try {
      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('id', leagueId)
        .eq('owner_id', authUser.id)

      if (error) throw error
      navigate('/home')
    } catch (err) {
      showErr(err.message || 'שגיאה במחיקה')
    }
  }
}
