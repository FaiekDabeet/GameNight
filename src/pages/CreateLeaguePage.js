// ── pages/CreateLeaguePage.js ────────────────────────────────
// Create league form:
//   - Name, sport type, season, visibility
//   - Cover image + logo upload (Supabase Storage)
//   - Monthly limit validation (plan-aware)
//   - Connects to actions.createLeague
//   - Shows invite code on success

import { AppShell }    from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { createLeague } from '../lib/actions.js'
import { supabase }    from '../lib/supabase.js'
import { navigate }    from '../router.js'

// ── Sport options ─────────────────────────────────────────────
const SPORTS = [
  { value: 'football',    label: '⚽ כדורגל' },
  { value: 'basketball',  label: '🏀 כדורסל' },
  { value: 'padel',       label: '🎾 פאדל' },
  { value: 'tennis',      label: '🎾 טניס' },
  { value: 'volleyball',  label: '🏐 כדורעף' },
  { value: 'chess',       label: '♟ שחמט' },
  { value: 'ping_pong',   label: '🏓 פינג פונג' },
  { value: 'poker',       label: '🃏 פוקר' },
  { value: 'backgammon',  label: '🎲 שש-בש' },
  { value: 'darts',       label: '🎯 דארטס' },
  { value: 'other',       label: '🏆 אחר' },
]

// ── Check monthly creation limit ──────────────────────────────
async function checkMonthlyLimit(userId, plan) {
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 30)

  const { count } = await supabase
    .from('leagues')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .gte('created_at', windowStart.toISOString())

  const { data: config } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', plan === 'pro' ? 'league_monthly_limit_pro' : 'league_monthly_limit_free')
    .single()

  const limit = parseInt(config?.value || (plan === 'pro' ? 10 : 2))
  return { count: count || 0, limit, canCreate: (count || 0) < limit }
}

// ── Upload image to Supabase Storage ─────────────────────────
async function uploadImage(file, userId, bucket = 'league-covers') {
  const ext  = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// ── Main render ───────────────────────────────────────────────
export async function render(root) {
  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'leagues' })
  await shell.mount(root)
  window.navigate = navigate

  // Check limit before rendering form
  const { count, limit, canCreate } = await checkMonthlyLimit(authUser.id, profile?.plan)

  if (!canCreate) {
    shell.setContent(`
      <div dir="rtl" style="max-width:480px;margin:var(--space-12) auto;text-align:center">
        <div style="font-size:48px;margin-bottom:var(--space-4)">🚫</div>
        <h2 style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);
          margin-bottom:var(--space-3)">הגעת למגבלה החודשית</h2>
        <p style="color:var(--text-secondary);margin-bottom:var(--space-2)">
          יצרת ${count} מתוך ${limit} ליגות ב-30 הימים האחרונים.
        </p>
        ${profile?.plan === 'free' ? `
          <p style="color:var(--text-secondary);margin-bottom:var(--space-6)">
            שדרג ל-Pro כדי ליצור עד 10 ליגות בחודש.
          </p>
          <div style="display:flex;gap:var(--space-3);justify-content:center">
            <button class="btn btn-primary" onclick="navigate('/settings')">שדרג ל-Pro</button>
            <button class="btn btn-ghost" onclick="navigate('/home')">חזרה</button>
          </div>` : `
          <button class="btn btn-primary" style="margin-top:var(--space-4)"
            onclick="navigate('/home')">חזרה לדף הבית</button>`
        }
      </div>`)
    return
  }

  // State
  let coverFile    = null
  let logoFile     = null
  let coverPreview = null
  let logoPreview  = null
  let isSubmitting = false
  let customSport  = ''

  const renderForm = () => `
    <div dir="rtl" style="max-width:560px;margin:0 auto">

      <!-- Header -->
      <div style="margin-bottom:var(--space-6)">
        <button class="btn btn-ghost btn-sm" style="margin-bottom:var(--space-3)"
          onclick="navigate('/home')">← חזרה</button>
        <h1 style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);
          margin-bottom:4px">צור ליגה חדשה</h1>
        <p style="font-size:var(--text-sm);color:var(--text-tertiary)">
          נותרו לך ${limit - count} מתוך ${limit} ליגות החודש
        </p>
      </div>

      <!-- Cover image upload -->
      <div style="margin-bottom:var(--space-5)">
        <label style="font-size:13px;font-weight:600;color:var(--text-primary);
          display:block;margin-bottom:var(--space-2)">תמונת כיסוי</label>
        <div id="cover-drop" style="
          width:100%;height:160px;border-radius:var(--radius-lg);
          border:2px dashed var(--border-mid);
          background:${coverPreview ? `url(${coverPreview}) center/cover no-repeat` : 'var(--bg-surface-2)'};
          display:flex;align-items:center;justify-content:center;
          cursor:pointer;transition:border-color var(--transition-fast);
          position:relative;overflow:hidden"
          onclick="document.getElementById('cover-input').click()"
          ondragover="event.preventDefault()"
          ondrop="handleDrop(event,'cover')">
          ${coverPreview ? `
            <button onclick="event.stopPropagation();clearImage('cover')"
              style="position:absolute;top:8px;inset-inline-end:8px;
                background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:50%;
                width:28px;height:28px;cursor:pointer;font-size:14px;
                display:flex;align-items:center;justify-content:center">✕</button>` : `
            <div style="text-align:center;color:var(--text-tertiary)">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none"
                   stroke="currentColor" stroke-width="1.5" style="margin:0 auto 8px">
                <rect x="2" y="6" width="28" height="20" rx="3"/>
                <circle cx="11" cy="13" r="3"/>
                <path d="M2 22l7-7 5 5 4-4 7 6"/>
              </svg>
              <div style="font-size:13px;font-weight:500">גרור תמונה או לחץ לבחירה</div>
              <div style="font-size:11px;margin-top:4px">JPG, PNG עד 5MB</div>
            </div>`}
        </div>
        <input type="file" id="cover-input" accept="image/*" hidden
          onchange="handleFileSelect(event,'cover')">
      </div>

      <!-- Logo upload -->
      <div style="margin-bottom:var(--space-5)">
        <label style="font-size:13px;font-weight:600;color:var(--text-primary);
          display:block;margin-bottom:var(--space-2)">
          לוגו ליגה
          ${profile?.plan !== 'pro' ? `<span class="badge badge-pro" style="margin-inline-start:6px">Pro</span>` : ''}
        </label>
        ${profile?.plan !== 'pro' ? `
          <div style="padding:var(--space-3) var(--space-4);
            border-radius:var(--radius-md);background:var(--gn-orange-pale);
            border:1px solid var(--gn-orange);font-size:13px;color:var(--gn-orange-dim)">
            לוגו מותאם זמין בתוכנית Pro.
            <a href="/settings" style="font-weight:600;text-decoration:underline">שדרג</a>
          </div>` : `
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            <div id="logo-preview" style="
              width:64px;height:64px;border-radius:var(--radius-md);
              background:${logoPreview ? `url(${logoPreview}) center/cover no-repeat` : 'var(--bg-surface-2)'};
              border:1px solid var(--border-mid);flex-shrink:0;cursor:pointer;
              display:flex;align-items:center;justify-content:center;color:var(--text-tertiary)"
              onclick="document.getElementById('logo-input').click()">
              ${logoPreview ? '' : `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"
                stroke="currentColor" stroke-width="1.5">
                <rect x="2" y="2" width="16" height="16" rx="3"/>
                <circle cx="7" cy="7" r="2"/><path d="M2 14l4-4 3 3 3-3 4 4"/>
              </svg>`}
            </div>
            <div>
              <button class="btn btn-secondary btn-sm"
                onclick="document.getElementById('logo-input').click()">בחר לוגו</button>
              ${logoPreview ? `<button class="btn btn-ghost btn-sm"
                onclick="clearImage('logo')" style="margin-inline-start:6px">הסר</button>` : ''}
              <p style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
                מומלץ 200×200px, PNG עם רקע שקוף
              </p>
            </div>
          </div>
          <input type="file" id="logo-input" accept="image/*" hidden
            onchange="handleFileSelect(event,'logo')">`
        }
      </div>

      <!-- Form fields -->
      <div class="card">
        <div class="card-body" style="display:flex;flex-direction:column;gap:var(--space-4)">

          <!-- League name -->
          <div>
            <label for="league-name" style="font-size:13px;font-weight:600;
              color:var(--text-primary);display:block;margin-bottom:var(--space-2)">
              שם הליגה *
            </label>
            <input type="text" id="league-name" placeholder="למשל: ליגת כדורסל השכונה"
              maxlength="60" dir="rtl"
              style="width:100%;padding:10px var(--space-3);
                border-radius:var(--radius-md);border:1px solid var(--border-mid);
                background:var(--bg-surface);color:var(--text-primary);
                font-family:var(--font-base);font-size:var(--text-base);
                transition:border-color var(--transition-fast)"
              oninput="validateName(this)"
              onfocus="this.style.borderColor='var(--gn-orange)'"
              onblur="this.style.borderColor='var(--border-mid)'">
            <div id="name-error" style="font-size:12px;color:var(--color-text-danger,#dc3545);
              margin-top:4px;display:none">שם הליגה חייב להכיל לפחות 3 תווים</div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;
              text-align:end" id="name-count">0 / 60</div>
          </div>

          <!-- Sport type -->
          <div>
            <label style="font-size:13px;font-weight:600;color:var(--text-primary);
              display:block;margin-bottom:var(--space-2)">ענף ספורט *</label>
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)" id="sport-chips">
              ${SPORTS.map(s => `
                <button type="button" class="chip" data-sport="${s.value}"
                  onclick="selectSport('${s.value}')">
                  ${s.label}
                </button>`).join('')}
            </div>
            <input type="text" id="custom-sport" placeholder="הכנס ענף מותאם..."
              style="display:none;margin-top:var(--space-2);width:100%;
                padding:8px var(--space-3);border-radius:var(--radius-md);
                border:1px solid var(--border-mid);background:var(--bg-surface);
                color:var(--text-primary);font-family:var(--font-base);font-size:14px"
              oninput="customSport=this.value"
              onfocus="this.style.borderColor='var(--gn-orange)'"
              onblur="this.style.borderColor='var(--border-mid)'">
          </div>

          <!-- Season -->
          <div>
            <label for="season" style="font-size:13px;font-weight:600;
              color:var(--text-primary);display:block;margin-bottom:var(--space-2)">
              עונה
              <span style="font-size:11px;font-weight:400;color:var(--text-tertiary)">
                (אופציונלי)
              </span>
            </label>
            <input type="text" id="season" placeholder="למשל: 2024-25 או קיץ 2025"
              maxlength="30" dir="rtl"
              style="width:100%;padding:10px var(--space-3);
                border-radius:var(--radius-md);border:1px solid var(--border-mid);
                background:var(--bg-surface);color:var(--text-primary);
                font-family:var(--font-base);font-size:var(--text-base)"
              onfocus="this.style.borderColor='var(--gn-orange)'"
              onblur="this.style.borderColor='var(--border-mid)'">
          </div>

          <!-- Visibility -->
          <div>
            <label style="font-size:13px;font-weight:600;color:var(--text-primary);
              display:block;margin-bottom:var(--space-2)">נראות הליגה</label>
            <div style="display:flex;gap:var(--space-3)">
              <label style="display:flex;align-items:center;gap:var(--space-2);
                cursor:pointer;flex:1;padding:var(--space-3);
                border:1px solid var(--border-mid);border-radius:var(--radius-md);
                transition:border-color var(--transition-fast)"
                id="vis-public-label">
                <input type="radio" name="visibility" value="public" checked
                  onchange="setVisibility(true)"
                  style="accent-color:var(--gn-orange)">
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text-primary)">
                    🌐 פומבית
                  </div>
                  <div style="font-size:11px;color:var(--text-tertiary)">
                    מופיעה בחיפוש
                  </div>
                </div>
              </label>
              <label style="display:flex;align-items:center;gap:var(--space-2);
                cursor:pointer;flex:1;padding:var(--space-3);
                border:1px solid var(--border-mid);border-radius:var(--radius-md);
                transition:border-color var(--transition-fast)"
                id="vis-private-label">
                <input type="radio" name="visibility" value="private"
                  onchange="setVisibility(false)"
                  style="accent-color:var(--gn-orange)">
                <div>
                  <div style="font-size:13px;font-weight:600;color:var(--text-primary)">
                    🔒 פרטית
                  </div>
                  <div style="font-size:11px;color:var(--text-tertiary)">
                    הצטרפות בקוד בלבד
                  </div>
                </div>
              </label>
            </div>
          </div>

        </div>
      </div>

      <!-- Error message -->
      <div id="form-error" style="display:none;margin-top:var(--space-3);
        padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);
        background:var(--color-background-danger,#fff5f5);
        border:1px solid var(--color-border-danger,#f5c6c6);
        font-size:13px;color:var(--color-text-danger,#dc3545)"></div>

      <!-- Submit -->
      <button id="submit-btn" class="btn btn-primary w-full"
        style="margin-top:var(--space-5);padding:14px;font-size:var(--text-base)"
        onclick="submitForm()">
        צור ליגה
      </button>

    </div>`

  shell.setContent(renderForm())

  // ── State ─────────────────────────────────────────────────
  let selectedSport = ''
  let isPublic      = true

  // ── Handlers (attached to window for inline onclick) ──────

  window.validateName = (input) => {
    const count = input.value.length
    document.getElementById('name-count').textContent = `${count} / 60`
    const err = document.getElementById('name-error')
    if (count > 0 && count < 3) {
      err.style.display = 'block'
    } else {
      err.style.display = 'none'
    }
  }

  window.selectSport = (value) => {
    selectedSport = value
    document.querySelectorAll('#sport-chips .chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.sport === value)
    })
    const customInput = document.getElementById('custom-sport')
    if (value === 'other') {
      customInput.style.display = 'block'
      customInput.focus()
    } else {
      customInput.style.display = 'none'
      customSport = ''
    }
  }

  window.setVisibility = (pub) => {
    isPublic = pub
    document.getElementById('vis-public-label').style.borderColor =
      pub ? 'var(--gn-orange)' : 'var(--border-mid)'
    document.getElementById('vis-private-label').style.borderColor =
      !pub ? 'var(--gn-orange)' : 'var(--border-mid)'
  }

  window.handleFileSelect = (event, type) => {
    const file = event.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showError('הקובץ גדול מ-5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      if (type === 'cover') {
        coverFile    = file
        coverPreview = e.target.result
        const drop   = document.getElementById('cover-drop')
        drop.style.background = `url(${coverPreview}) center/cover no-repeat`
        drop.innerHTML = `
          <button onclick="event.stopPropagation();clearImage('cover')"
            style="position:absolute;top:8px;inset-inline-end:8px;
              background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:50%;
              width:28px;height:28px;cursor:pointer;font-size:14px;
              display:flex;align-items:center;justify-content:center">✕</button>`
      } else {
        logoFile    = file
        logoPreview = e.target.result
        const prev  = document.getElementById('logo-preview')
        if (prev) {
          prev.style.background = `url(${logoPreview}) center/cover no-repeat`
          prev.innerHTML = ''
        }
      }
    }
    reader.readAsDataURL(file)
  }

  window.handleDrop = (event, type) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      const fakeEvent = { target: { files: [file] } }
      window.handleFileSelect(fakeEvent, type)
    }
  }

  window.clearImage = (type) => {
    if (type === 'cover') {
      coverFile = null; coverPreview = null
      const drop = document.getElementById('cover-drop')
      drop.style.background = 'var(--bg-surface-2)'
      drop.innerHTML = `
        <div style="text-align:center;color:var(--text-tertiary)">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"
               stroke="currentColor" stroke-width="1.5" style="margin:0 auto 8px">
            <rect x="2" y="6" width="28" height="20" rx="3"/>
            <circle cx="11" cy="13" r="3"/><path d="M2 22l7-7 5 5 4-4 7 6"/>
          </svg>
          <div style="font-size:13px;font-weight:500">גרור תמונה או לחץ לבחירה</div>
          <div style="font-size:11px;margin-top:4px">JPG, PNG עד 5MB</div>
        </div>`
    } else {
      logoFile = null; logoPreview = null
      const prev = document.getElementById('logo-preview')
      if (prev) {
        prev.style.background = 'var(--bg-surface-2)'
        prev.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"
          stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="2" width="16" height="16" rx="3"/>
          <circle cx="7" cy="7" r="2"/><path d="M2 14l4-4 3 3 3-3 4 4"/>
        </svg>`
      }
    }
  }

  function showError(msg) {
    const el = document.getElementById('form-error')
    if (!el) return
    el.textContent = msg
    el.style.display = 'block'
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function hideError() {
    const el = document.getElementById('form-error')
    if (el) el.style.display = 'none'
  }

  window.submitForm = async () => {
    if (isSubmitting) return
    hideError()

    // Validate
    const name = document.getElementById('league-name')?.value?.trim()
    if (!name || name.length < 3) {
      showError('שם הליגה חייב להכיל לפחות 3 תווים')
      document.getElementById('league-name')?.focus()
      return
    }

    const finalSport = selectedSport === 'other'
      ? (customSport.trim() || 'other')
      : selectedSport

    if (!finalSport) {
      showError('יש לבחור ענף ספורט')
      document.getElementById('sport-chips')?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    const season = document.getElementById('season')?.value?.trim() || null

    // Submit
    isSubmitting = true
    const btn = document.getElementById('submit-btn')
    if (btn) {
      btn.disabled     = true
      btn.textContent  = 'יוצר ליגה...'
    }

    try {
      // Upload images if selected
      let coverUrl = null
      let logoUrl  = null

      if (coverFile) {
        coverUrl = await uploadImage(coverFile, authUser.id, 'league-covers')
      }
      if (logoFile && profile?.plan === 'pro') {
        logoUrl = await uploadImage(logoFile, authUser.id, 'league-logos')
      }

      const league = await createLeague({
        userId:    authUser.id,
        name,
        sportType: finalSport,
        isPublic,
        season,
        coverUrl,
        logoUrl,
      })

      // ── Success screen ───────────────────────────────────
      shell.setContent(`
        <div dir="rtl" style="max-width:480px;margin:var(--space-12) auto;text-align:center">
          <div style="font-size:64px;margin-bottom:var(--space-4)">🎉</div>
          <h2 style="font-size:var(--text-xl);font-weight:700;color:var(--text-primary);
            margin-bottom:var(--space-2)">${name} נוצרה בהצלחה!</h2>
          <p style="color:var(--text-secondary);margin-bottom:var(--space-6)">
            שתף את קוד ההזמנה עם חברים
          </p>

          <!-- Invite code -->
          <div style="background:var(--bg-surface-2);border-radius:var(--radius-lg);
            padding:var(--space-5);margin-bottom:var(--space-6);
            border:1px solid var(--border-light)">
            <div style="font-size:12px;color:var(--text-tertiary);
              text-transform:uppercase;letter-spacing:.5px;margin-bottom:var(--space-2)">
              קוד הזמנה
            </div>
            <div style="font-size:36px;font-weight:700;letter-spacing:6px;
              color:var(--gn-orange);font-family:var(--font-mono);margin-bottom:var(--space-3)">
              ${league.invite_code}
            </div>
            <button class="btn btn-secondary btn-sm" id="copy-invite-btn"
              onclick="copyInvite('${league.invite_code}')">
              העתק קוד
            </button>
          </div>

          <div style="display:flex;flex-direction:column;gap:var(--space-3)">
            <button class="btn btn-primary" style="padding:14px"
              onclick="navigate('/league/${league.id}')">
              כנס לליגה
            </button>
            <button class="btn btn-ghost"
              onclick="navigate('/home')">
              חזרה לדף הבית
            </button>
          </div>
        </div>`)

      window.copyInvite = async (code) => {
        await navigator.clipboard.writeText(code).catch(() => {})
        const btn = document.getElementById('copy-invite-btn')
        if (btn) { btn.textContent = 'הועתק! ✓'; setTimeout(() => btn.textContent = 'העתק קוד', 2000) }
      }

    } catch (err) {
      console.error('[CreateLeague]', err)
      showError(err.message || 'שגיאה ביצירת הליגה. נסה שוב.')
      if (btn) { btn.disabled = false; btn.textContent = 'צור ליגה' }
    } finally {
      isSubmitting = false
    }
  }
}
