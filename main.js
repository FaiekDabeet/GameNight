// ── main.js ──────────────────────────────────────────────────
// App entry point.
// Imports styles, initialises theme, then starts the router.

import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import { initRouter } from './router.js'

// ── Theme: apply saved preference or system default ──────────
function initTheme() {
  const saved  = localStorage.getItem('gn-theme')
  const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  const theme  = saved || system
  document.documentElement.setAttribute('data-theme', theme)
}

// ── Locale: apply saved preference ───────────────────────────
function initLocale() {
  const locale = localStorage.getItem('gn-locale') || 'he'
  document.documentElement.lang = locale
  document.documentElement.dir  = locale === 'he' ? 'rtl' : 'ltr'
}

// ── Boot ─────────────────────────────────────────────────────
initTheme()
initLocale()
initRouter()

// ── Theme toggle helper (callable from any page) ─────────────
window.toggleTheme = () => {
  const current = document.documentElement.getAttribute('data-theme')
  const next    = current === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('gn-theme', next)
}

// ── Locale toggle helper ─────────────────────────────────────
window.setLocale = (locale) => {
  document.documentElement.lang = locale
  document.documentElement.dir  = locale === 'he' ? 'rtl' : 'ltr'
  localStorage.setItem('gn-locale', locale)
}
