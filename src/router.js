// ── router.js ────────────────────────────────────────────────
import { isAuthenticated, onAuthStateChange } from './lib/auth.js'

const routes = {
  '/':                      { redirect: '/login' },
  '/login':                 { page: 'LoginPage',         public: true },
  '/auth/callback':         { page: 'AuthCallback',      public: true },
  '/home':                  { page: 'HomePage',          protected: true },
  '/leagues/create':        { page: 'CreateLeaguePage',  protected: true },
  '/league/:id/edit':       { page: 'EditLeaguePage',    protected: true },
  '/league/:id/games/add':  { page: 'AddGamePage',       protected: true },
  '/league/:id':            { page: 'LeaguePage',        protected: true },
  '/team/:id':              { page: 'TeamPage',          protected: true },
  '/player/:id':            { page: 'PlayerCardPage',    protected: true },
  '/notifications':         { page: 'NotificationsPage', protected: true },
  '/profile':               { page: 'ProfileRedirect',   protected: true },
  '/settings':              { page: 'SettingsPage',      protected: true },
  '/discover':              { page: 'DiscoverPage',      protected: true },
  '/404':                   { page: 'NotFoundPage',      public: true },
}

function matchRoute(path) {
  // Normalize trailing slash
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  for (const [pattern, config] of Object.entries(routes)) {
    if (pattern === path) return { config, params: {} }

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

const pageModules = {
  LoginPage:         () => import('./pages/LoginPage.js'),
  AuthCallback:      () => import('./pages/AuthCallback.js'),
  HomePage:          () => import('./pages/HomePage.js'),
  LeaguePage:        () => import('./pages/LeaguePage.js'),
  TeamPage:          () => import('./pages/TeamPage.js'),
  PlayerCardPage:    () => import('./pages/PlayerCardPage.js'),
  CreateLeaguePage:  () => import('./pages/CreateLeaguePage.js'),
  AddGamePage:       () => import('./pages/AddGamePage.js'),
  EditLeaguePage:    () => import('./pages/EditLeaguePage.js'),
  NotificationsPage: () => import('./pages/NotificationsPage.js'),
  ProfileRedirect:   () => import('./pages/ProfileRedirect.js'),
  SettingsPage:      () => import('./pages/SettingsPage.js'),
  DiscoverPage:      () => import('./pages/DiscoverPage.js'),
  UpgradePage:       () => import('./pages/UpgradePage.js'),
  NotFoundPage:      () => import('./pages/NotFoundPage.js'),
}

export function navigate(path) {
  history.pushState({}, '', path)
  renderRoute(path)
}

async function renderRoute(path) {
  // Normalize trailing slash
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  const root = document.getElementById('app')
  if (!root) return

  const { config, params } = matchRoute(path)

  if (config.redirect) {
    navigate(config.redirect)
    return
  }

  if (config.protected) {
    const authed = await isAuthenticated()
    if (!authed) {
      navigate('/login')
      return
    }
  }

  if (config.public && config.page === 'LoginPage') {
    const authed = await isAuthenticated()
    if (authed) {
      navigate('/home')
      return
    }
  }

  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;
      min-height:100dvh;color:var(--text-secondary);
      font-family:var(--font-base);font-size:14px">
      <div style="text-align:center">
        <div style="width:32px;height:32px;border-radius:50%;
          border:2px solid var(--gn-light-dim);
          border-top-color:var(--gn-orange);
          animation:spin 0.7s linear infinite;
          margin:0 auto 12px"></div>
        טוען...
      </div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`

  try {
    const module = await pageModules[config.page]()
    if (typeof module.render === 'function') {
      await module.render(root, params)
    }
  } catch (err) {
    console.error('[router] Failed to load page:', err)
    root.innerHTML = `
      <div style="padding:40px;text-align:center;font-family:var(--font-base)">
        <h2 style="color:var(--text-primary)">שגיאה בטעינת הדף</h2>
        <p style="color:var(--text-secondary);margin-top:8px">${err.message}</p>
        <button onclick="location.reload()"
          style="margin-top:16px;padding:8px 20px;background:var(--gn-orange);
            color:#fff;border:none;border-radius:8px;cursor:pointer;
            font-family:var(--font-base)">רענן</button>
      </div>`
  }
}

export function initRouter() {
  window.addEventListener('popstate', () => {
    renderRoute(window.location.pathname)
  })

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]')
    if (!link) return
    const href = link.getAttribute('href')
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

  onAuthStateChange(({ event }) => {
    if (event === 'SIGNED_OUT') navigate('/login')
    if (event === 'SIGNED_IN')  navigate('/home')
  })

  renderRoute(window.location.pathname)
}
// Note: EditLeaguePage added below — append to pageModules manually if needed
