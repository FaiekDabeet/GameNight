// ── pages/LoginPage.js ───────────────────────────────────────
// Login page — Google OAuth only for MVP.
// Design: GameNight palette, Assistant font, dark hero panel + light form.

import { signInWithGoogle } from '../lib/auth.js'

export async function render(root) {
  root.innerHTML = `
    <div class="login-layout" dir="he">

      <!-- Left: Hero panel (hidden on mobile) -->
      <div class="login-hero" aria-hidden="true">
        <div class="hero-content">
          <div class="hero-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#FF9B51"/>
              <path d="M12 34L20 18l8 10 5-7 8 13" stroke="#25343F" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="35" cy="14" r="4" fill="#25343F"/>
            </svg>
            <span class="hero-brand">GameNight</span>
          </div>
          <h1 class="hero-title">ניהול ליגות חובבים<br>לכל משחק</h1>
          <p class="hero-sub">צור ליגה, הזמן חברים, עקוב אחר תוצאות — בכל מקום, מכל מכשיר.</p>

          <ul class="hero-features">
            <li>
              <span class="feat-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 9l4 4 8-8" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              טבלת מעמד בזמן אמת
            </li>
            <li>
              <span class="feat-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 9l4 4 8-8" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              מערכת XP ועיצובי ליגה
            </li>
            <li>
              <span class="feat-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 9l4 4 8-8" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              עקוב אחר שחקנים וליגות
            </li>
            <li>
              <span class="feat-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 9l4 4 8-8" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              כדורגל, פאדל, שחמט ועוד
            </li>
          </ul>
        </div>

        <!-- Decorative background shapes -->
        <div class="hero-decor hero-decor-1" aria-hidden="true"></div>
        <div class="hero-decor hero-decor-2" aria-hidden="true"></div>
      </div>

      <!-- Right: Login form -->
      <div class="login-form-panel">
        <div class="login-form-inner">

          <!-- Mobile logo (shown only on mobile) -->
          <div class="mobile-logo">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#FF9B51"/>
              <path d="M12 34L20 18l8 10 5-7 8 13" stroke="#25343F" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="35" cy="14" r="4" fill="#25343F"/>
            </svg>
            <span>GameNight</span>
          </div>

          <div class="form-header">
            <h2>ברוך הבא</h2>
            <p>התחבר כדי להמשיך לליגות שלך</p>
          </div>

          <button id="google-btn" class="google-btn" type="button">
            <svg width="20" height="20" viewBox="0 0 20 20">
              <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 3-4.33 3-7.31z" fill="#4285F4"/>
              <path d="M10 20c2.7 0 4.97-.9 6.63-2.42l-3.24-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H1.07v2.58A10 10 0 0 0 10 20z" fill="#34A853"/>
              <path d="M4.4 11.92A6.02 6.02 0 0 1 4.07 10c0-.67.12-1.32.33-1.92V5.5H1.07A10 10 0 0 0 0 10c0 1.61.38 3.13 1.07 4.5l3.33-2.58z" fill="#FBBC05"/>
              <path d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.96.9 12.7 0 10 0A10 10 0 0 0 1.07 5.5L4.4 8.08C5.19 5.72 7.4 3.96 10 3.96z" fill="#EA4335"/>
            </svg>
            <span id="google-btn-text">המשך עם Google</span>
          </button>

          <div class="login-divider">
            <span>הכניסה מאובטחת ומוצפנת</span>
          </div>

          <p class="login-terms">
            בהתחברות אתה מסכים ל
            <a href="/terms">תנאי השימוש</a>
            ול
            <a href="/privacy">מדיניות הפרטיות</a>
          </p>

        </div>
      </div>

    </div>

    <style>
      /* Layout */
      .login-layout {
        display:    flex;
        min-height: 100dvh;
        direction:  rtl;
      }

      /* Hero panel */
      .login-hero {
        flex:       1;
        background: var(--gn-dark);
        padding:    var(--space-12) var(--space-10);
        display:    flex;
        align-items: center;
        position:   relative;
        overflow:   hidden;
      }

      .hero-content {
        position: relative;
        z-index:  1;
        max-width: 420px;
      }

      .hero-logo {
        display:     flex;
        align-items: center;
        gap:         var(--space-3);
        margin-bottom: var(--space-8);
      }

      .hero-brand {
        font-size:   var(--text-xl);
        font-weight: var(--weight-bold);
        color:       var(--gn-white);
        letter-spacing: -0.5px;
      }

      .hero-title {
        font-size:   var(--text-2xl);
        font-weight: var(--weight-bold);
        color:       var(--gn-white);
        line-height: 1.2;
        margin-bottom: var(--space-4);
      }

      .hero-sub {
        font-size:   var(--text-md);
        color:       var(--gn-silver);
        line-height: var(--leading-snug);
        margin-bottom: var(--space-8);
      }

      .hero-features {
        list-style: none;
        display:    flex;
        flex-direction: column;
        gap:        var(--space-3);
      }

      .hero-features li {
        display:     flex;
        align-items: center;
        gap:         var(--space-3);
        font-size:   var(--text-base);
        color:       var(--gn-silver);
        font-weight: var(--weight-medium);
      }

      .feat-icon {
        width:           28px;
        height:          28px;
        border-radius:   var(--radius-full);
        background:      rgba(255, 155, 81, 0.15);
        color:           var(--gn-orange);
        display:         flex;
        align-items:     center;
        justify-content: center;
        flex-shrink:     0;
      }

      /* Decorative shapes */
      .hero-decor {
        position:      absolute;
        border-radius: 50%;
        pointer-events: none;
      }

      .hero-decor-1 {
        width:      400px;
        height:     400px;
        background: rgba(255, 155, 81, 0.06);
        top:        -100px;
        left:       -100px;
      }

      .hero-decor-2 {
        width:      300px;
        height:     300px;
        background: rgba(255, 155, 81, 0.04);
        bottom:     -80px;
        right:      -60px;
      }

      /* Form panel */
      .login-form-panel {
        width:           460px;
        flex-shrink:     0;
        background:      var(--bg-surface);
        display:         flex;
        align-items:     center;
        justify-content: center;
        padding:         var(--space-10);
      }

      .login-form-inner {
        width:    100%;
        max-width: 360px;
      }

      .mobile-logo {
        display:       none;
        align-items:   center;
        gap:           var(--space-2);
        font-size:     var(--text-lg);
        font-weight:   var(--weight-bold);
        color:         var(--text-primary);
        margin-bottom: var(--space-8);
      }

      .form-header {
        margin-bottom: var(--space-8);
      }

      .form-header h2 {
        font-size:     var(--text-xl);
        font-weight:   var(--weight-bold);
        color:         var(--text-primary);
        margin-bottom: var(--space-2);
      }

      .form-header p {
        font-size: var(--text-sm);
        color:     var(--text-secondary);
      }

      /* Google button */
      .google-btn {
        width:           100%;
        display:         flex;
        align-items:     center;
        justify-content: center;
        gap:             var(--space-3);
        padding:         14px var(--space-5);
        background:      var(--bg-surface);
        border:          1.5px solid var(--border-mid);
        border-radius:   var(--radius-md);
        font-family:     var(--font-base);
        font-size:       var(--text-base);
        font-weight:     var(--weight-semibold);
        color:           var(--text-primary);
        cursor:          pointer;
        transition:
          background var(--transition-fast),
          border-color var(--transition-fast),
          transform var(--transition-fast);
      }

      .google-btn:hover:not(:disabled) {
        background:   var(--bg-surface-2);
        border-color: var(--gn-orange);
        transform:    translateY(-1px);
      }

      .google-btn:active:not(:disabled) {
        transform: translateY(0);
      }

      .google-btn:disabled {
        opacity: 0.6;
        cursor:  not-allowed;
      }

      .login-divider {
        display:     flex;
        align-items: center;
        gap:         var(--space-3);
        margin:      var(--space-6) 0;
        color:       var(--text-tertiary);
        font-size:   var(--text-xs);
      }

      .login-divider::before,
      .login-divider::after {
        content: '';
        flex:    1;
        height:  1px;
        background: var(--border-light);
      }

      .login-terms {
        font-size:   var(--text-xs);
        color:       var(--text-tertiary);
        text-align:  center;
        line-height: var(--leading-loose);
      }

      .login-terms a {
        color: var(--text-accent);
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .login-layout    { flex-direction: column; }
        .login-hero      { display: none; }
        .login-form-panel {
          width:   100%;
          padding: var(--space-8) var(--space-5);
        }
        .mobile-logo { display: flex; }
      }
    </style>
  `

  // Attach Google sign-in handler
  const btn = document.getElementById('google-btn')
  btn.addEventListener('click', async () => {
    btn.disabled = true
    document.getElementById('google-btn-text').textContent = 'מתחבר...'
    try {
      await signInWithGoogle()
      // Redirect happens automatically via Supabase OAuth flow
    } catch (err) {
      console.error('[LoginPage] sign-in error:', err)
      btn.disabled = false
      document.getElementById('google-btn-text').textContent = 'המשך עם Google'
      // Show error toast
      showToast('שגיאה בהתחברות. נסה שוב.', 'error')
    }
  })
}

function showToast(msg, type = '') {
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div')
    el.id = 'toast-container'
    document.body.appendChild(el)
    return el
  })()
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = msg
  container.appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}
