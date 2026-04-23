// ── lib/notifications.js ─────────────────────────────────────
// Notification system:
//   - Realtime listener (Supabase channel)
//   - In-app toast display
//   - Mark as read
//   - Fetch unread count

import { supabase } from './supabase.js'

// ── Notification type definitions ────────────────────────────
export const NOTIF_TYPES = {
  GAME_RESULT:     'game_result',
  NEW_FOLLOWER:    'new_follower',
  LEAGUE_INVITE:   'league_invite',
  GAME_REMINDER:   'game_reminder',
  XP_LEVELUP:      'xp_levelup',
  BADGE_UNLOCKED:  'badge_unlocked',
}

// ── Human-readable labels + icons ────────────────────────────
const NOTIF_META = {
  game_result:    { icon: '⚽', label: 'תוצאה חדשה' },
  new_follower:   { icon: '👤', label: 'עוקב חדש' },
  league_invite:  { icon: '🏆', label: 'הזמנה לליגה' },
  game_reminder:  { icon: '⏰', label: 'תזכורת משחק' },
  xp_levelup:     { icon: '⬆️', label: 'עלית רמה' },
  badge_unlocked: { icon: '🏅', label: 'הישג חדש' },
}

// ── Singleton listener state ──────────────────────────────────
let _channel      = null
let _callbacks    = []

// ── Subscribe to realtime notifications ──────────────────────
// Returns unsubscribe function.
// onNotification(notif) is called for each new notification.
export function subscribeNotifications(userId, onNotification) {
  if (!userId) return () => {}

  // Only one channel per session
  if (_channel) supabase.removeChannel(_channel)

  _channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const notif = payload.new
        _callbacks.forEach(cb => cb(notif))
        if (onNotification) onNotification(notif)
        showToast(notif)
      }
    )
    .subscribe()

  return () => {
    if (_channel) {
      supabase.removeChannel(_channel)
      _channel = null
    }
  }
}

// ── Add a callback (for components that need to react) ───────
export function onNotification(cb) {
  _callbacks.push(cb)
  return () => { _callbacks = _callbacks.filter(x => x !== cb) }
}

// ── Fetch notifications for the current user ─────────────────
export async function fetchNotifications(userId, { unreadOnly = false, limit = 30 } = {}) {
  let query = supabase
    .from('notifications')
    .select('id, type, payload, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.is('read_at', null)

  const { data } = await query
  return data || []
}

// ── Get unread count ──────────────────────────────────────────
export async function getUnreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  return count || 0
}

// ── Mark single notification as read ─────────────────────────
export async function markRead(notifId) {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notifId)
}

// ── Mark all notifications as read ───────────────────────────
export async function markAllRead(userId) {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
}

// ── Insert a notification (server-side / edge function use) ──
// On the client, notifications are created by DB triggers.
// This helper is exposed for edge functions / admin use.
export async function insertNotification({ userId, type, payload = {} }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, payload })
    .select('id')
    .single()
  if (error) console.warn('[notif] insert error:', error.message)
  return data
}

// ── Toast renderer ────────────────────────────────────────────
// Shows a GameNight-styled in-app toast for incoming notifications.
export function showToast(notif) {
  const meta    = NOTIF_META[notif.type] || { icon: '🔔', label: 'עדכון' }
  const message = buildMessage(notif)

  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.className = 'notif-toast'
  toast.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px">
      <span style="font-size:20px;flex-shrink:0">${meta.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--gn-orange);
          text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">
          ${meta.label}
        </div>
        <div style="font-size:13px;color:var(--gn-light);line-height:1.4">${message}</div>
      </div>
      <button onclick="this.closest('.notif-toast').remove()"
        style="background:none;border:none;color:rgba(255,255,255,.4);
          cursor:pointer;font-size:16px;padding:0;flex-shrink:0;line-height:1">✕</button>
    </div>`

  toast.style.cssText = `
    background: var(--gn-dark);
    border: 1px solid rgba(255,155,81,0.3);
    border-inline-start: 3px solid var(--gn-orange);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    min-width: 280px;
    max-width: 340px;
    box-shadow: var(--shadow-lg);
    animation: toastIn 220ms ease forwards;
    cursor: pointer;
    direction: rtl;`

  container.appendChild(toast)

  // Auto-dismiss after 5s
  const timer = setTimeout(() => {
    toast.style.animation = 'toastOut 200ms ease forwards'
    setTimeout(() => toast.remove(), 200)
  }, 5000)

  toast.addEventListener('click', () => {
    clearTimeout(timer)
    toast.remove()
    handleNotifClick(notif)
  })

  // Inject animation keyframes once
  if (!document.getElementById('notif-toast-styles')) {
    const style = document.createElement('style')
    style.id = 'notif-toast-styles'
    style.textContent = `
      #toast-container {
        position: fixed;
        bottom: 80px;
        inset-inline-end: 16px;
        z-index: 999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      .notif-toast { pointer-events: auto; }
      @keyframes toastIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes toastOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(8px)} }
    `
    document.head.appendChild(style)
  }
}

// ── Build human-readable message from payload ─────────────────
function buildMessage(notif) {
  const p = notif.payload || {}
  switch (notif.type) {
    case NOTIF_TYPES.GAME_RESULT:
      return `${p.home_name||'?'} ${p.home_score??'—'} : ${p.away_score??'—'} ${p.away_name||'?'}`
    case NOTIF_TYPES.NEW_FOLLOWER:
      return `${p.follower_name||'מישהו'} התחיל לעקוב אחריך`
    case NOTIF_TYPES.LEAGUE_INVITE:
      return `הוזמנת להצטרף ל-${p.league_name||'ליגה'}`
    case NOTIF_TYPES.GAME_REMINDER:
      return `משחק ב-${p.league_name||'ליגה'} מחר`
    case NOTIF_TYPES.XP_LEVELUP:
      return `עלית לרמה ${p.new_level||'?'} 🎉`
    case NOTIF_TYPES.BADGE_UNLOCKED:
      return `השגת את ה-badge: ${p.badge_label||'?'}`
    default:
      return p.message || 'עדכון חדש'
  }
}

// ── Navigate on notification click ───────────────────────────
function handleNotifClick(notif) {
  const p = notif.payload || {}
  const nav = window.navigate
  if (!nav) return
  switch (notif.type) {
    case NOTIF_TYPES.GAME_RESULT:
      if (p.league_id) nav(`/league/${p.league_id}`)
      break
    case NOTIF_TYPES.NEW_FOLLOWER:
      if (p.follower_id) nav(`/player/${p.follower_id}`)
      break
    case NOTIF_TYPES.LEAGUE_INVITE:
      if (p.league_id) nav(`/league/${p.league_id}`)
      break
    default:
      nav('/notifications')
  }
}

// ── Format time for notification list ────────────────────────
export function formatNotifTime(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)    return 'עכשיו'
  if (diff < 3600)  return `לפני ${Math.floor(diff/60)} דק'`
  if (diff < 86400) return `לפני ${Math.floor(diff/3600)} שע'`
  if (diff < 604800)return `לפני ${Math.floor(diff/86400)} ימים`
  return new Date(dateStr).toLocaleDateString('he-IL')
}

// ── Notification list renderer (for /notifications page) ─────
export function renderNotificationList(notifications) {
  if (!notifications.length) return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <h3>אין התראות</h3>
      <p>כשיהיו עדכונים הם יופיעו כאן</p>
    </div>`

  return notifications.map(n => {
    const meta    = NOTIF_META[n.type] || { icon: '🔔', label: 'עדכון' }
    const message = buildMessage(n)
    const unread  = !n.read_at

    return `
      <div class="card" style="
        padding: var(--space-3) var(--space-4);
        margin-bottom: var(--space-2);
        ${unread ? 'border-inline-start: 3px solid var(--gn-orange);' : ''}
        cursor: pointer; transition: background var(--transition-fast);"
        onclick="handleNotifClick_${n.id}()"
        onmouseover="this.style.background='var(--bg-surface-2)'"
        onmouseout="this.style.background=''">
        <div style="display:flex;align-items:flex-start;gap:var(--space-3)">
          <span style="font-size:22px;flex-shrink:0;margin-top:2px">${meta.icon}</span>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)">
              <span style="font-size:12px;font-weight:600;color:var(--text-tertiary);
                text-transform:uppercase;letter-spacing:.4px">${meta.label}</span>
              <span style="font-size:11px;color:var(--text-tertiary);white-space:nowrap">
                ${formatNotifTime(n.created_at)}
              </span>
            </div>
            <p style="font-size:14px;color:${unread?'var(--text-primary)':'var(--text-secondary)'};
              margin-top:2px;line-height:1.4;font-weight:${unread?'500':'400'}">${message}</p>
          </div>
          ${unread ? `<div style="width:8px;height:8px;border-radius:50%;
            background:var(--gn-orange);flex-shrink:0;margin-top:6px"></div>` : ''}
        </div>
      </div>
      <script>
        window.handleNotifClick_${n.id} = () => handleNotifClick(${JSON.stringify(n)})
      </script>`
  }).join('')
}
