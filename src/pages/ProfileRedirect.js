// ── pages/ProfileRedirect.js ─────────────────────────────────
// /profile → /player/:myId
import { getCurrentUser } from '../lib/auth.js'
import { navigate }       from '../router.js'

export async function render() {
  const user = await getCurrentUser()
  if (!user) { navigate('/login'); return }
  navigate(`/player/${user.id}`)
}
