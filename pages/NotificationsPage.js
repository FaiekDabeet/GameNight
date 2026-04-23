// ── pages/NotificationsPage.js ───────────────────────────────
import { AppShell } from '../components/AppShell.js'
import { getCurrentUser, getUserProfile } from '../lib/auth.js'
import {
  fetchNotifications, markAllRead, markRead,
  renderNotificationList, subscribeNotifications,
  getUnreadCount,
} from '../lib/notifications.js'
import { navigate } from '../router.js'

export async function render(root) {
  const authUser = await getCurrentUser()
  if (!authUser) { navigate('/login'); return }
  const profile = await getUserProfile(authUser.id)

  const shell = new AppShell({ user: profile, activePage: 'notifications' })
  await shell.mount(root)
  window.navigate = navigate

  shell.setContent(`<div dir="rtl">
    <div class="skeleton" style="height:40px;border-radius:var(--radius-md);margin-bottom:var(--space-3)"></div>
    ${Array(5).fill(`<div class="skeleton" style="height:72px;border-radius:var(--radius-lg);margin-bottom:var(--space-2)"></div>`).join('')}
  </div>`)

  let notifications = await fetchNotifications(authUser.id)
  let unreadOnly    = false

  const renderPage = () => {
    const displayed = unreadOnly
      ? notifications.filter(n => !n.read_at)
      : notifications
    const unreadCount = notifications.filter(n => !n.read_at).length

    return `
      <div dir="rtl">
        <div class="section-header" style="margin-bottom:var(--space-4)">
          <div>
            <h2 class="section-title">התראות</h2>
            ${unreadCount > 0
              ? `<p class="section-sub">${unreadCount} לא נקראות</p>`
              : `<p class="section-sub">הכל נקרא</p>`}
          </div>
          <div style="display:flex;gap:var(--space-2)">
            <button class="chip ${unreadOnly?'active':''}" id="filter-btn"
              onclick="toggleFilter()">
              לא נקראות בלבד
            </button>
            ${unreadCount > 0 ? `
              <button class="btn btn-ghost btn-sm" id="mark-all-btn"
                onclick="markAll()">סמן הכל כנקרא</button>` : ''}
          </div>
        </div>

        <div id="notif-list">
          ${renderNotificationList(displayed)}
        </div>
      </div>`
  }

  shell.setContent(renderPage())

  window.toggleFilter = () => {
    unreadOnly = !unreadOnly
    shell.setContent(renderPage())
  }

  window.markAll = async () => {
    await markAllRead(authUser.id)
    notifications = notifications.map(n => ({ ...n, read_at: new Date().toISOString() }))
    shell.setContent(renderPage())
  }

  // Realtime — add incoming notifications to top of list
  subscribeNotifications(authUser.id, (notif) => {
    notifications.unshift(notif)
    shell.setContent(renderPage())
  })
}
