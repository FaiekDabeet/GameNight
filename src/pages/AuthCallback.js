// ── pages/AuthCallback.js ────────────────────────────────────
// Handles the redirect from Google OAuth.
// Supabase picks up the URL hash automatically — we just wait
// for the session to be established, then redirect to /home.

import { supabase } from '../lib/supabase.js'
import { touchLoginStreak } from '../lib/auth.js'
import { navigate } from '../router.js'

export async function render(root) {
  root.innerHTML = `
    <div style="
      display:         flex;
      align-items:     center;
      justify-content: center;
      min-height:      100dvh;
      font-family:     var(--font-base);
      direction:       rtl;
    ">
      <div style="text-align:center; color: var(--text-secondary);">
        <div style="
          width: 40px; height: 40px;
          border: 2px solid var(--gn-light-dim);
          border-top-color: var(--gn-orange);
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          margin: 0 auto 16px;
        "></div>
        <p style="font-size:14px">מאמת כניסה...</p>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    </div>
  `

  // Wait for Supabase to exchange the OAuth code for a session
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session) {
    // Auth failed — redirect to login with error flag
    navigate('/login?error=auth_failed')
    return
  }

  // Touch login streak on every fresh sign-in
  await touchLoginStreak(data.session.user.id)

  // All good — go home
  navigate('/home')
}
