// ── router.js ────────────────────────────────────────────────
// Lightweight SPA router — no framework needed.
// Handles: hash-based routing, auth guard, page rendering.

import { isAuthenticated, onAuthStateChange } from './lib/auth.js'

// ── Route definitions ────────────────────────────────────────
// protected: true → redirects to /login if not authenticated
// public:    true → redirects to /home if already authenticated
const routes = {
  '/':              { redirect: '/login' },
  '/login':         { page: 'LoginPage',      public: true },
  '/auth/callback': { page: 'AuthCallback',   public: true },
'/home':          { page: 'HomePage',       protected: true },
  '/leagues/create':        { page: 'CreateLeaguePage', protected: true },
  '/league/:id/games/add':  { page: 'AddGamePage',      protected: true },
  '/league/:id':    { page: 'LeaguePage',     protected: true },
  '/team/:id':      { page: 'TeamPage',       protected: true },
  '/player/:id':      { page: 'PlayerCardPage',   protected: true },
  '/notifications':   { page: 'NotificationsPage', protected: true },
  '/profile':         { page: 'ProfileRedirect',  protected: true },
  '/discover':        { page: 'DiscoverPage',     protected: true },
  '/404':             { page: 'NotFoundPage',      public: true },
}

// ── Match a path against route patterns ──────────────────────
function matchRoute(path) {
  for (const [pattern, config] of Object.entries(routes)) {
    if (pattern === path) return { config, params: {} }

    // Handle dynamic segments like /league/:id
    const patternParts = pattern.split('/')
    const pathParts    = path.split('/')
    if (patternParts.length !== pathParts.length) continue

    const params = {}
    const matched = patternParts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = pathParts[i]
        return true
      }
      return part === pathParts[i]
    })

    if (matched) return { config, params }
  }
  return { config: { page: 'NotFoundPage', public: true }, params: {} }
}

// ── Lazy-load page modules ────────────────────────────────────
const pageModules = {
  LoginPage:      () => import('./pages/LoginPage.js'),
  AuthCallback:   () => import('./pages/AuthCallback.js'),
  HomePage:       () => import('./pages/HomePage.js'),
  LeaguePage:     () => import('./pages/LeaguePage.js'),
  TeamPage:       () => import('./pages/TeamPage.js'),
  PlayerCardPage: () => import('./pages/PlayerCardPage.js'),
  CreateLeaguePage:  () => import('./pages/CreateLeaguePage.js'),
  AddGamePage:       () => import('./pages/AddGamePage.js'),
  ProfileRedirect:   () => import('./pages/ProfileRedirect.js'),
  SettingsPage:      () => import('./pages/SettingsPage.js'),
  DiscoverPage:      () => import('./pages/DiscoverPage.js'),
  NotFoundPage:      () => import('./pages/NotFoundPage.js'),
}

// ── Navigate programmatically ────────────────────────────────
export function navigate(path) {
  history.pushState({}, '', path)
  renderRoute(path)
}

// ── Core render function ─────────────────────────────────────
async function renderRoute(path) {
  // Normalize trailing slash
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  
  const root = document.getElementById('app')
  ...
}

  // Redirect shorthand
  if (config.redirect) {
    navigate(config.redirect)
    return
  }

  // Auth guard — protected route
  if (config.protected) {
    const authed = await isAuthenticated()
    if (!authed) {
      navigate('/login')
      return
    }
  }

  // Public-only route (e.g. login) — redirect if already authed
  if (config.public && config.page === 'LoginPage') {
    const authed = await isAuthenticated()
    if (authed) {
      navigate('/home')
      return
    }
  }

  // Show loading state while page module loads
  root.innerHTML = `
    <div style="
      display:         flex;
      align-items:     center;
      justify-content: center;
      min-height:      100dvh;
      color:           var(--text-secondary);
      font-family:     var(--font-base);
      font-size:       14px;
    ">
      <div style="text-align:center">
        <div style="
          width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid var(--gn-light-dim);
          border-top-color: var(--gn-orange);
          animation: spin 0.7s linear infinite;
          margin: 0 auto 12px;
        "></div>
        טוען...
      </div>
    </div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `

  try {
    const module = await pageModules[config.page]()
    if (typeof module.render === 'function') {
      await module.render(root, params)
    } else {
      console.error(`[router] Page "${config.page}" has no render() export.`)
    }
  } catch (err) {
    console.error('[router] Failed to load page:', err)
    root.innerHTML = `
      <div style="padding:40px;text-align:center;font-family:var(--font-base)">
        <h2 style="color:var(--text-primary)">שגיאה בטעינת הדף</h2>
        <p style="color:var(--text-secondary);margin-top:8px">${err.message}</p>
        <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;background:var(--gn-orange);color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:var(--font-base)">
          רענן
        </button>
      </div>
    `
  }
}

// ── Router init ──────────────────────────────────────────────
export function initRouter() {
  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    renderRoute(window.location.pathname)
  })

  // Intercept internal link clicks (no full reload)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]')
    if (!link) return
    const href = link.getAttribute('href')

    // Only intercept same-origin, non-hash, non-external links
    if (
      href &&
      !href.startsWith('http') &&
      !href.startsWith('mailto') &&
      !href.startsWith('#') &&
      !link.hasAttribute('target')
    ) {
      e.preventDefault()
      navigate(href)
    }
  })

  // Re-render on auth state change
  onAuthStateChange(({ event }) => {
    if (event === 'SIGNED_OUT') navigate('/login')
    if (event === 'SIGNED_IN')  navigate('/home')
  })

  // Initial render
  renderRoute(window.location.pathname)
}
