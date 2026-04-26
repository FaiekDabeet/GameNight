// ── pages/UpgradePage.js ─────────────────────────────────────
import { AppShell }    from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import { supabase }    from '../lib/supabase.js'
import { navigate }    from '../router.js'

const PRICING = {
  monthly: { price: 29, label: 'לחודש' },
  yearly:  { price: 19, label: 'לחודש', total: 228, saving: 120 },
}

const PAYMENT = {
  paypal:   'https://paypal.me/YOUR_PAYPAL',
  bit:      'https://bit.ly/YOUR_BIT_LINK',
  whatsapp: 'https://wa.me/972XXXXXXXXX',
}

const FEATURES = [
  ['🏆', '10 ליגות בחודש', 'במקום 2 בגרסת Free'],
  ['👥', 'שחקנים ללא הגבלה', 'ללא תקרת 30 שחקנים'],
  ['🎨', 'לוגו מותאם', 'העלה לוגו לכל ליגה'],
  ['📊', 'סטטיסטיקות מתקדמות', 'נתונים מעמיקים'],
  ['📤', 'ייצוא CSV / PDF', 'בלחיצה אחת'],
  ['🤝', 'דף ספונסר', 'עיצוב מקצועי'],
  ['🚫', 'ללא פרסומות', 'חוויה נקייה'],
  ['⚡', 'תמיכה מועדפת', 'מענה תוך 24h'],
]

async function fetchProCount() {
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('plan', 'pro')
  return count || 0
}

export async function render(root) {
  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile  = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'profile' })
  await shell.mount(root)
  window.navigate = navigate

  shell.setContent(`<div dir="rtl" style="max-width:600px;margin:0 auto">
    ${[80,300,200].map(h => `<div class="skeleton"
      style="height:${h}px;border-radius:12px;margin-bottom:16px"></div>`).join('')}
  </div>`)

  const isPro     = profile?.plan === 'pro'
  const proCount  = await fetchProCount()
  // Social proof: only show when review count >= 10
  // Update this when you add a reviews table
  const showSocial = false

  let billing = 'monthly'

  const page = () => {
    const p = PRICING[billing]

    if (isPro) return `
      <div dir="rtl" style="max-width:600px;margin:0 auto;text-align:center;padding:48px 0">
        <div style="font-size:56px;margin-bottom:16px">👑</div>
        <span class="badge badge-pro" style="font-size:14px;padding:6px 18px;margin-bottom:16px;display:inline-block">PRO</span>
        <h1 style="font-size:24px;font-weight:700;color:var(--text-primary);margin-bottom:8px">
          אתה כבר Pro!
        </h1>
        <p style="font-size:14px;color:var(--text-secondary);margin-bottom:8px">
          ${profile?.display_name} — גישה מלאה לכל הפיצ'רים
        </p>
        ${proCount > 1 ? `<p style="font-size:13px;color:var(--text-tertiary);margin-bottom:24px">
          מצטרף ל-${proCount} משתמשי Pro 💪</p>` : ''}
        <button class="btn btn-primary" onclick="navigate('/home')">חזרה לדף הבית</button>
      </div>`

    return `
      <div dir="rtl" style="max-width:600px;margin:0 auto;padding-bottom:48px">

        <!-- Header -->
        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:40px;margin-bottom:10px">🚀</div>
          <h1 style="font-size:26px;font-weight:700;color:var(--text-primary);margin-bottom:6px">
            שדרג ל-GameNight Pro
          </h1>
          <p style="font-size:14px;color:var(--text-secondary)">
            כל הכלים לניהול ליגה מקצועית — ללא פרסומות, ללא מגבלות
          </p>
          ${proCount > 0 ? `<p style="font-size:13px;color:var(--text-tertiary);margin-top:6px">
            🔥 ${proCount} משתמשים כבר Pro</p>` : ''}
        </div>

        <!-- Billing toggle -->
        <div style="display:flex;justify-content:center;gap:10px;margin-bottom:24px">
          ${['monthly','yearly'].map(b => `
            <button onclick="setBilling('${b}')"
              style="padding:8px 22px;border-radius:20px;font-family:var(--font-base);
                font-size:14px;font-weight:600;cursor:pointer;border:2px solid;
                background:${billing===b?'var(--gn-orange)':'transparent'};
                color:${billing===b?'#fff':'var(--text-secondary)'};
                border-color:${billing===b?'var(--gn-orange)':'var(--border-mid)'}">
              ${b==='monthly'?'חודשי':'שנתי'}
              ${b==='yearly'?`<span style="font-size:10px;margin-inline-start:4px;
                background:${billing==='yearly'?'rgba(255,255,255,.25)':'#d4edda'};
                color:${billing==='yearly'?'#fff':'#155724'};
                padding:1px 6px;border-radius:10px">חסכון 34%</span>`:''}
            </button>`).join('')}
        </div>

        <!-- Plans side by side -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">

          <!-- Free -->
          <div class="card" style="padding:20px">
            <div style="font-size:12px;font-weight:600;color:var(--text-tertiary);
              text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Free</div>
            <div style="font-size:28px;font-weight:700;color:var(--text-primary);margin-bottom:2px">₪0</div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px">לתמיד</div>
            ${[
              ['2 ליגות / חודש', true],
              ['30 שחקנים', true],
              ['כרטיס שחקן', true],
              ['לוגו מותאם', false],
              ['ללא פרסומות', false],
              ['ייצוא נתונים', false],
            ].map(([f,ok]) => `
              <div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:6px">
                <span style="color:${ok?'#2e7d32':'var(--text-tertiary)'}">${ok?'✓':'✗'}</span>
                <span style="color:${ok?'var(--text-primary)':'var(--text-tertiary)'}">${f}</span>
              </div>`).join('')}
            <div style="margin-top:14px;padding:6px;text-align:center;
              border-radius:8px;background:var(--bg-surface-2);
              font-size:11px;color:var(--text-tertiary)">המסלול הנוכחי</div>
          </div>

          <!-- Pro -->
          <div class="card" style="padding:20px;border:2px solid var(--gn-orange)">
            <div style="font-size:12px;font-weight:600;color:var(--gn-orange-dim);
              text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Pro</div>
            <div style="display:flex;align-items:baseline;gap:3px;margin-bottom:2px">
              <span style="font-size:28px;font-weight:700;color:var(--text-primary)">₪${p.price}</span>
              <span style="font-size:12px;color:var(--text-tertiary)">${p.label}</span>
            </div>
            ${billing==='yearly'?`<div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px">
              ₪${PRICING.yearly.total}/שנה · חיסכון ₪${PRICING.yearly.saving}</div>`:
              `<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:4px"> </div>`}
            <div style="margin-bottom:12px"></div>
            ${[
              '10 ליגות / חודש',
              'שחקנים ללא הגבלה',
              'כרטיס שחקן',
              'לוגו מותאם',
              'ללא פרסומות',
              'ייצוא נתונים',
            ].map(f => `
              <div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:6px">
                <span style="color:#2e7d32">✓</span>
                <span style="color:var(--text-primary)">${f}</span>
              </div>`).join('')}
          </div>
        </div>

        <!-- Payment CTA -->
        <div class="card" style="padding:22px;margin-bottom:16px">
          <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);
            text-align:center;margin-bottom:4px">
            שדרג עכשיו — ₪${p.price} ${p.label}${billing==='yearly'?' (חיוב שנתי)':''}
          </h3>
          <p style="font-size:12px;color:var(--text-tertiary);text-align:center;margin-bottom:18px">
            בחר אמצעי תשלום
          </p>

          <div style="display:flex;flex-direction:column;gap:10px">
            <a href="${PAYMENT.paypal}" target="_blank" rel="noopener"
              style="display:flex;align-items:center;justify-content:center;gap:10px;
                padding:13px;border-radius:10px;background:#0070ba;color:#fff;
                text-decoration:none;font-family:var(--font-base);font-size:14px;font-weight:600">
              💙 תשלום עם PayPal
            </a>
            <a href="${PAYMENT.bit}" target="_blank" rel="noopener"
              style="display:flex;align-items:center;justify-content:center;gap:10px;
                padding:13px;border-radius:10px;background:#6c3dab;color:#fff;
                text-decoration:none;font-family:var(--font-base);font-size:14px;font-weight:600">
              💜 תשלום עם Bit
            </a>
            <a href="${PAYMENT.whatsapp}?text=${encodeURIComponent('היי, אני רוצה לשדרג ל-GameNight Pro')}"
              target="_blank" rel="noopener"
              style="display:flex;align-items:center;justify-content:center;gap:10px;
                padding:13px;border-radius:10px;background:#25D366;color:#fff;
                text-decoration:none;font-family:var(--font-base);font-size:14px;font-weight:600">
              💬 צור קשר ב-WhatsApp
            </a>
          </div>
          <p style="font-size:11px;color:var(--text-tertiary);text-align:center;margin-top:12px">
            לאחר התשלום שלח אישור ב-WhatsApp — נפעיל תוך שעה ⚡
          </p>
        </div>

        <!-- Features grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          ${FEATURES.map(([icon,title,desc]) => `
            <div class="card" style="padding:14px">
              <div style="font-size:22px;margin-bottom:6px">${icon}</div>
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:3px">${title}</div>
              <div style="font-size:11px;color:var(--text-tertiary)">${desc}</div>
            </div>`).join('')}
        </div>

        <!-- Social proof — only when showSocial = true -->
        ${showSocial ? `
          <div style="margin-bottom:16px">
            <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);
              text-align:center;margin-bottom:12px">מה אומרים המשתמשים</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div class="card" style="padding:14px">
                <div style="color:var(--gn-orange);font-size:13px;margin-bottom:6px">★★★★★</div>
                <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
                  "שינה לגמרי את ניהול הליגה שלנו"
                </p>
                <div style="font-size:11px;font-weight:600;color:var(--text-primary)">מנהל ליגת פאדל</div>
              </div>
              <div class="card" style="padding:14px">
                <div style="color:var(--gn-orange);font-size:13px;margin-bottom:6px">★★★★★</div>
                <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">
                  "שווה כל שקל — ללא פרסומות"
                </p>
                <div style="font-size:11px;font-weight:600;color:var(--text-primary)">שחקן כדורסל</div>
              </div>
            </div>
          </div>` : ''}

        <!-- FAQ -->
        <div class="card" style="padding:20px">
          <h3 style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:14px">שאלות נפוצות</h3>
          ${[
            ['איך מקבלים גישה?', 'לאחר התשלום שלח אישור ב-WhatsApp. נפעיל תוך שעה.'],
            ['אפשר לבטל?', 'כן — שלח הודעה ב-WhatsApp בכל עת. ללא התחייבות.'],
            ['מה קורה לנתונים?', 'נשמרים. הליגות חוזרות למגבלות Free בלבד.'],
            ['יש ניסיון חינם?', 'הגרסה החינמית זמינה ללא הגבלת זמן.'],
          ].map(([q,a]) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border-light)">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:3px">${q}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${a}</div>
            </div>`).join('')}
        </div>

      </div>`
  }

  shell.setContent(page())
  window.setBilling = (b) => { billing = b; shell.setContent(page()) }
}
