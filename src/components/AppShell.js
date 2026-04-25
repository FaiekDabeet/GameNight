// ── components/AppShell.js ───────────────────────────────────
// Responsive app shell:
//   Mobile  (≤768px)  → top header + bottom navigation bar
//   Desktop (≥769px)  → left/right sidebar + top header
//
// Usage:
//   import { AppShell } from '../components/AppShell.js'
//   const shell = new AppShell({ user, activePage: 'home' })
//   shell.mount(root)                  // renders shell into root
//   shell.setContent(htmlString)       // sets the main content area
//   shell.setContent(htmlString, true) // append instead of replace

import { signOut, getUserProfile } from '../lib/auth.js'
import { navigate } from '../router.js'
import { supabase } from '../lib/supabase.js'

// ── Nav items ────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    id:    'home',
    label: 'בית',
    href:  '/home',
    icon:  `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9.5L11 3l8 6.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
              <path d="M8 20V12h6v8"/>
            </svg>`,
  },
  {
    id:    'leagues',
    label: 'ליגות',
    href:  '/leagues',
    icon:  `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 4h10M6 4a2 2 0 0 0-2 2v1a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5V6a2 2 0 0 0-2-2"/>
              <path d="M11 12v5M7 17h8"/>
            </svg>`,
  },
  {
    id:    'discover',
    label: 'גלה',
    href:  '/discover',
    icon:  `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="M14.5 7.5l-2.5 5-5 2.5 2.5-5 5-2.5z"/>
            </svg>`,
  },
  {
    id:    'notifications',
    label: 'התראות',
    href:  '/notifications',
    icon:  `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8A7 7 0 1 0 4 8c0 7-3 9-3 9h20s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>`,
  },
  {
    id:    'profile',
    label: 'פרופיל',
    href:  '/profile',
    icon:  `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="8" r="4"/>
              <path d="M3 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>`,
  },
]

export class AppShell {
  constructor({ user, activePage = 'home' }) {
    this.user       = user
    this.activePage = activePage
    this.root       = null
    this.unreadCount = 0
    this._unsubNotif = null
  }

  // ── Mount shell into container ───────────────────────────
  async mount(container) {
    this.root = container

    // Fetch unread notification count
    await this._fetchUnread()

    container.innerHTML = this._renderShell()
    this._attachEvents()
    this._subscribeNotifications()
  }

  // ── Set main content area ────────────────────────────────
  setContent(html) {
    const main = this.root?.querySelector('#shell-main')
    if (main) main.innerHTML = html
  }

  // ── Append to main content area ──────────────────────────
  appendContent(html) {
    const main = this.root?.querySelector('#shell-main')
    if (main) main.insertAdjacentHTML('beforeend', html)
  }

  // ── Cleanup (call when navigating away) ─────────────────
  destroy() {
    this._unsubNotif?.()
  }

  // ── Fetch unread notifications count ────────────────────
  async _fetchUnread() {
    if (!this.user?.id) return
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', this.user.id)
      .is('read_at', null)
    this.unreadCount = count || 0
  }

  // ── Subscribe to realtime notifications ─────────────────
  _subscribeNotifications() {
  if (!this.user?.id) return
  
  // יצירת channel חדש בכל פעם
  const channel = supabase
    .channel(`notifications:${this.user.id}:${Date.now()}`)
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'notifications',
      filter: `user_id=eq.${this.user.id}`,
    }, () => {
      this.unreadCount++
      this._updateNotifBadge()
    })

  channel.subscribe()
  this._unsubNotif = () => supabase.removeChannel(channel)
}

  // ── Update notification badge in DOM ────────────────────
  _updateNotifBadge() {
    const dots = this.root?.querySelectorAll('.notif-badge')
    dots?.forEach(dot => {
      dot.style.display = this.unreadCount > 0 ? 'block' : 'none'
      dot.textContent   = this.unreadCount > 9 ? '9+' : this.unreadCount
    })
  }

  // ── Avatar helper ────────────────────────────────────────
  _avatarHtml(size = 'md') {
    const px = { sm: 28, md: 36, lg: 52 }[size]
    if (this.user?.avatar_url) {
      return `<img src="${this.user.avatar_url}" class="avatar avatar-${size}"
                   width="${px}" height="${px}" alt="${this.user.display_name}" loading="lazy">`
    }
    const initials = (this.user?.display_name || '?')
      .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    return `<span class="avatar-placeholder avatar-${size}">${initials}</span>`
  }

  // ── Plan badge ───────────────────────────────────────────
  _planBadge() {
    return this.user?.plan === 'pro'
      ? `<span class="badge badge-pro">PRO</span>`
      : `<span class="badge badge-free">Free</span>`
  }

  // ── Ad slot ──────────────────────────────────────────────
  _adSlot(type = 'banner') {
    if (this.user?.plan === 'pro') return ''
    return `
      <div class="ad-slot ad-slot-${type}" role="complementary" aria-label="פרסומת">
        <span>פרסומת</span>
        <span class="ad-slot-label">Ad</span>
      </div>`
  }

  // ── XP bar ───────────────────────────────────────────────
  _xpBar() {
    const xp    = this.user?.xp_total  || 0
    const level = this.user?.level     || 1
    // XP needed to next level (simplified: level * 100)
    const toNext  = level * 100
    const progress = Math.min(100, Math.round((xp % toNext) / toNext * 100))
    return `
      <div class="xp-bar-wrap">
        <span class="xp-level-chip">Lv ${level}</span>
        <div class="xp-bar-track">
          <div class="xp-bar-fill" style="width:${progress}%"></div>
        </div>
        <span>${xp} XP</span>
      </div>`
  }

  // ── Main render ──────────────────────────────────────────
  _renderShell() {
    const navItems = NAV_ITEMS.map(item => {
      const active = item.id === this.activePage
      const notifDot = item.id === 'notifications' && this.unreadCount > 0
        ? `<span class="notif-badge" style="
              position:absolute;top:2px;inset-inline-end:2px;
              background:var(--gn-orange);color:#fff;
              border-radius:var(--radius-full);
              font-size:9px;font-weight:700;
              min-width:16px;height:16px;
              display:flex;align-items:center;justify-content:center;
              border:2px solid var(--bg-nav);
           ">${this.unreadCount > 9 ? '9+' : this.unreadCount}</span>`
        : `<span class="notif-badge" style="display:none"></span>`

      return { ...item, active, notifDot }
    })

    return `
    <div class="shell-wrap" dir="rtl">

      <!-- ── Top header ───────────────────────────────────── -->
      <header class="shell-header">
        <div class="shell-header-inner">

          <!-- Logo -->
          <a href="/home" class="shell-logo">
            <svg width="30" height="30" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="10" fill="#FF9B51"/>
              <path d="M12 34L20 18l8 10 5-7 8 13" stroke="#25343F" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="35" cy="14" r="4" fill="#25343F"/>
            </svg>
            <span class="shell-logo-text">GameNight</span>
          </a>

          <!-- Right side: search + notif + avatar -->
          <div class="shell-header-actions">

            <!-- Search -->
            <button class="btn-icon shell-search-btn" aria-label="חיפוש" id="search-btn">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                   stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <circle cx="8" cy="8" r="5.5"/>
                <path d="M12.5 12.5L16 16"/>
              </svg>
            </button>

            <!-- Theme toggle -->
            <button class="btn-icon" aria-label="החלף מצב תצוגה" id="theme-btn">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                   stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <circle cx="9" cy="9" r="4"/>
                <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.5 3.5l1.4 1.4M13.1 13.1l1.4 1.4M3.5 14.5l1.4-1.4M13.1 4.9l1.4-1.4"/>
              </svg>
            </button>

            <!-- Notifications (desktop only) -->
            <button class="btn-icon desktop-only shell-notif-btn" aria-label="התראות"
                    style="position:relative" id="notif-btn">
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none"
                   stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M18 8A7 7 0 1 0 4 8c0 7-3 9-3 9h20s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span class="notif-badge" style="${this.unreadCount > 0 ? '' : 'display:none'}
                position:absolute;top:2px;inset-inline-end:2px;
                background:var(--gn-orange);color:#fff;border-radius:var(--radius-full);
                font-size:9px;font-weight:700;min-width:14px;height:14px;
                display:flex;align-items:center;justify-content:center;
                border:2px solid var(--bg-surface)">
                ${this.unreadCount > 9 ? '9+' : this.unreadCount}
              </span>
            </button>

            <!-- Avatar dropdown trigger -->
            <button class="shell-avatar-btn" id="avatar-btn" aria-label="תפריט משתמש">
              ${this._avatarHtml('sm')}
            </button>

          </div>
        </div>

        <!-- Ad banner (Free users, below header) -->
        ${this._adSlot('banner')}
      </header>

      <!-- ── Desktop sidebar + content ────────────────────── -->
      <div class="shell-body">

        <!-- Sidebar (desktop) -->
        <aside class="shell-sidebar desktop-only">

          <!-- User info -->
          <div class="sidebar-user">
            ${this._avatarHtml('md')}
            <div class="sidebar-user-info">
              <div class="sidebar-username">${this.user?.display_name || 'שחקן'}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
                ${this._planBadge()}
              </div>
            </div>
          </div>

          ${this._xpBar()}

          <nav class="sidebar-nav" aria-label="ניווט ראשי">
            ${navItems.map(item => `
              <a href="${item.href}" class="sidebar-nav-item ${item.active ? 'active' : ''}"
                 aria-current="${item.active ? 'page' : 'false'}">
                <span class="sidebar-nav-icon" style="position:relative">
                  ${item.icon}
                  ${item.notifDot}
                </span>
                <span>${item.label}</span>
              </a>
            `).join('')}
          </nav>

          <!-- Quick action -->
          <div class="sidebar-footer">
            <button class="btn btn-primary w-full" id="create-league-btn">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M8 2v12M2 8h12"/>
              </svg>
              צור ליגה
            </button>
            <button class="btn btn-ghost w-full" id="signout-btn" style="margin-top:6px">
              יציאה
            </button>
          </div>

        </aside>

        <!-- Main content area -->
        <main class="shell-main" id="shell-main">
          <!-- Page content injected here -->
        </main>

      </div>

      <!-- ── Bottom nav (mobile) ───────────────────────────── -->
      <nav class="bottom-nav mobile-only" aria-label="ניווט תחתון">
        ${navItems.map(item => `
          <a href="${item.href}" class="bottom-nav-item ${item.active ? 'active' : ''}"
             aria-current="${item.active ? 'page' : 'false'}">
            <span style="position:relative;display:flex;align-items:center;justify-content:center">
              ${item.icon}
              ${item.notifDot}
            </span>
            <span class="bottom-nav-label">${item.label}</span>
          </a>
        `).join('')}
      </nav>

      <!-- ── Avatar dropdown menu ─────────────────────────── -->
      <div class="avatar-menu" id="avatar-menu" hidden>
        <div class="avatar-menu-header">
          <div class="avatar-menu-name">${this.user?.display_name}</div>
          <div class="avatar-menu-email" style="font-size:11px;color:var(--text-tertiary)">
            ${this._planBadge()}
          </div>
        </div>
        <a href="/profile" class="avatar-menu-item">הפרופיל שלי</a>
        <a href="/settings" class="avatar-menu-item">הגדרות</a>
        <div style="height:1px;background:var(--border-light);margin:4px 0"></div>
        <button class="avatar-menu-item avatar-menu-signout" id="avatar-signout">יציאה</button>
      </div>

    </div>

    <style>
      /* ── Shell layout ─────────────────────────────────── */
      .shell-wrap {
        display:        flex;
        flex-direction: column;
        min-height:     100dvh;
      }

      /* ── Header ───────────────────────────────────────── */
      .shell-header {
        background:  var(--bg-nav);
        position:    sticky;
        top:         0;
        z-index:     var(--z-nav);
        flex-shrink: 0;
      }

      .shell-header-inner {
        display:         flex;
        align-items:     center;
        justify-content: space-between;
        padding:         0 var(--space-5);
        height:          56px;
        max-width:       1400px;
        margin:          0 auto;
        width:           100%;
      }

      .shell-logo {
        display:     flex;
        align-items: center;
        gap:         var(--space-2);
        text-decoration: none;
      }
      .shell-logo-text {
        font-size:   var(--text-md);
        font-weight: var(--weight-bold);
        color:       var(--gn-white);
        letter-spacing: -0.3px;
      }

      .shell-header-actions {
        display:     flex;
        align-items: center;
        gap:         var(--space-1);
      }

      .shell-avatar-btn {
        background:    none;
        border:        none;
        cursor:        pointer;
        padding:       2px;
        border-radius: var(--radius-full);
        display:       flex;
        align-items:   center;
        margin-inline-start: var(--space-1);
      }
      .shell-avatar-btn img,
      .shell-avatar-btn .avatar-placeholder {
        width: 32px; height: 32px;
        border: 2px solid rgba(255,255,255,0.2);
      }
      .shell-avatar-btn:hover img,
      .shell-avatar-btn:hover .avatar-placeholder {
        border-color: var(--gn-orange);
      }

      /* ── Body (sidebar + main) ───────────────────────── */
      .shell-body {
        display:    flex;
        flex:       1;
        max-width:  1400px;
        margin:     0 auto;
        width:      100%;
      }

      /* ── Sidebar ─────────────────────────────────────── */
      .shell-sidebar {
        width:           240px;
        flex-shrink:     0;
        padding:         var(--space-5) var(--space-4);
        display:         flex;
        flex-direction:  column;
        gap:             var(--space-4);
        border-inline-end: 1px solid var(--border-light);
        position:        sticky;
        top:             56px;
        height:          calc(100dvh - 56px);
        overflow-y:      auto;
      }

      .sidebar-user {
        display:     flex;
        align-items: center;
        gap:         var(--space-3);
        padding:     var(--space-2) 0;
      }
      .sidebar-user-info { flex: 1; min-width: 0; }
      .sidebar-username {
        font-size:   var(--text-sm);
        font-weight: var(--weight-semibold);
        color:       var(--text-primary);
        white-space: nowrap;
        overflow:    hidden;
        text-overflow: ellipsis;
      }

      .sidebar-nav {
        display:        flex;
        flex-direction: column;
        gap:            2px;
        flex:           1;
      }

      .sidebar-nav-item {
        display:       flex;
        align-items:   center;
        gap:           var(--space-3);
        padding:       10px var(--space-3);
        border-radius: var(--radius-md);
        color:         var(--text-secondary);
        text-decoration: none;
        font-size:     var(--text-sm);
        font-weight:   var(--weight-medium);
        transition:    background var(--transition-fast), color var(--transition-fast);
      }
      .sidebar-nav-item:hover {
        background: var(--bg-surface-2);
        color:      var(--text-primary);
      }
      .sidebar-nav-item.active {
        background: var(--gn-orange-pale);
        color:      var(--gn-orange-dim);
        font-weight: var(--weight-semibold);
      }
      .sidebar-nav-icon { flex-shrink: 0; }

      .sidebar-footer {
        padding-top:  var(--space-4);
        border-top:   1px solid var(--border-light);
      }

      /* ── Main content ────────────────────────────────── */
      .shell-main {
        flex:       1;
        padding:    var(--space-6);
        min-width:  0;
        overflow-x: hidden;
      }

      @media (max-width: 600px) {
        .shell-main { padding: var(--space-4) var(--space-3); }
      }

      /* ── Bottom nav ──────────────────────────────────── */
      .bottom-nav {
        position:        fixed;
        bottom:          0;
        inset-inline:    0;
        z-index:         var(--z-nav);
        background:      var(--bg-nav);
        display:         flex;
        border-top:      1px solid rgba(255,255,255,0.08);
        padding-bottom:  env(safe-area-inset-bottom, 0px);
      }

      .bottom-nav-item {
        flex:            1;
        display:         flex;
        flex-direction:  column;
        align-items:     center;
        justify-content: center;
        gap:             3px;
        padding:         8px 4px;
        color:           rgba(255,255,255,0.45);
        text-decoration: none;
        transition:      color var(--transition-fast);
        position:        relative;
      }
      .bottom-nav-item.active { color: var(--gn-orange); }
      .bottom-nav-item:hover  { color: rgba(255,255,255,0.75); }

      .bottom-nav-label {
        font-size:  10px;
        font-weight: var(--weight-medium);
        line-height: 1;
      }

      /* ── Avatar dropdown ─────────────────────────────── */
      .avatar-menu {
        position:      fixed;
        top:           60px;
        inset-inline-end: var(--space-4);
        z-index:       var(--z-modal);
        background:    var(--bg-surface);
        border:        1px solid var(--border-mid);
        border-radius: var(--radius-lg);
        box-shadow:    var(--shadow-lg);
        min-width:     200px;
        overflow:      hidden;
      }
      .avatar-menu[hidden] { display: none; }

      .avatar-menu-header {
        padding:       var(--space-3) var(--space-4);
        border-bottom: 1px solid var(--border-light);
      }
      .avatar-menu-name {
        font-size:   var(--text-sm);
        font-weight: var(--weight-semibold);
        color:       var(--text-primary);
      }
      .avatar-menu-item {
        display:     block;
        width:       100%;
        padding:     10px var(--space-4);
        font-size:   var(--text-sm);
        color:       var(--text-secondary);
        text-decoration: none;
        background:  none;
        border:      none;
        cursor:      pointer;
        text-align:  start;
        font-family: var(--font-base);
        font-weight: var(--weight-medium);
        transition:  background var(--transition-fast);
      }
      .avatar-menu-item:hover { background: var(--bg-surface-2); color: var(--text-primary); }
      .avatar-menu-signout    { color: #dc3545; }
      .avatar-menu-signout:hover { background: #fff5f5; }

      /* ── Responsive helpers ──────────────────────────── */
      .desktop-only { display: flex; }
      .mobile-only  { display: none; }

      @media (max-width: 768px) {
        .desktop-only { display: none !important; }
        .mobile-only  { display: flex !important; }
        .shell-main   { padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)); }
      }
    </style>
    `
  }

  // ── Event listeners ──────────────────────────────────────
  _attachEvents() {
    // Theme toggle
    this.root.querySelector('#theme-btn')?.addEventListener('click', () => {
      window.toggleTheme?.()
    })

    // Avatar dropdown
    const avatarBtn  = this.root.querySelector('#avatar-btn')
    const avatarMenu = this.root.querySelector('#avatar-menu')
    avatarBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      avatarMenu.hidden = !avatarMenu.hidden
    })
    document.addEventListener('click', () => { if (avatarMenu) avatarMenu.hidden = true })

    // Sign out (sidebar + dropdown)
    const signoutHandler = async () => {
      try { await signOut() } catch {}
    }
    this.root.querySelector('#signout-btn')?.addEventListener('click', signoutHandler)
    this.root.querySelector('#avatar-signout')?.addEventListener('click', signoutHandler)

    // Create league
    this.root.querySelector('#create-league-btn')?.addEventListener('click', () => {
      navigate('/leagues/create')
    })

    // Notifications
    this.root.querySelector('#notif-btn')?.addEventListener('click', () => {
      navigate('/notifications')
    })
  }
}
