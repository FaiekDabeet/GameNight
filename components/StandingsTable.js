// ── components/StandingsTable.js ─────────────────────────────
// Renders a standings table for a league.
// Supports both player-mode and team-mode.
// Shows avatar/logo, rank medal, stats columns.

export function StandingsTable({ standings, mode = 'player', currentUserId }) {
  if (!standings?.length) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="6" height="20" rx="1"/>
            <rect x="10" y="7" width="6" height="15" rx="1"/>
            <rect x="18" y="4" width="6" height="18" rx="1"/>
          </svg>
        </div>
        <h3>אין נתוני טבלה עדיין</h3>
        <p>הכנס תוצאות משחקים כדי לעדכן את הטבלה</p>
      </div>`
  }

  const medal = (rank) => {
    if (rank === 1) return `<span style="font-size:18px">🥇</span>`
    if (rank === 2) return `<span style="font-size:18px">🥈</span>`
    if (rank === 3) return `<span style="font-size:18px">🥉</span>`
    return `<span style="font-size:13px;font-weight:700;color:var(--text-tertiary)">${rank}</span>`
  }

  const avatarCell = (row) => {
    const name = mode === 'team'
      ? row.teams?.name
      : row.users?.display_name
    const url = mode === 'team'
      ? row.teams?.logo_url
      : row.users?.avatar_url
    const color = mode === 'team'
      ? (row.teams?.color || '#FF9B51')
      : '#FF9B51'

    if (url) {
      return `<img src="${url}" width="32" height="32" loading="lazy" alt="${name}"
        style="border-radius:${mode==='team'?'6px':'50%'};object-fit:cover;flex-shrink:0">`
    }
    const initials = (name || '?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()
    return `<span style="
      width:32px;height:32px;border-radius:${mode==='team'?'6px':'50%'};
      background:${color};color:#fff;flex-shrink:0;
      display:inline-flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700">${initials}</span>`
  }

  const gd = (row) => {
    const diff = (row.goals_for || 0) - (row.goals_against || 0)
    const color = diff > 0
      ? 'color:#2e7d32'
      : diff < 0
      ? 'color:#c62828'
      : 'color:var(--text-tertiary)'
    return `<span style="${color};font-weight:600">${diff > 0 ? '+' : ''}${diff}</span>`
  }

  const rows = standings.map((row, i) => {
    const rank     = i + 1
    const name     = mode === 'team' ? row.teams?.name : row.users?.display_name
    const isMe     = mode === 'player' && row.user_id === currentUserId
    const played   = (row.wins||0) + (row.draws||0) + (row.losses||0)

    return `
      <tr style="${isMe ? 'background:var(--gn-orange-pale);' : ''}
        transition:background 0.15s;cursor:default"
        onmouseover="this.style.background='var(--bg-surface-2)'"
        onmouseout="this.style.background='${isMe?'var(--gn-orange-pale)':'transparent'}'">

        <td style="padding:10px 12px;text-align:center;width:44px">
          ${medal(rank)}
        </td>

        <td style="padding:10px 8px">
          <div style="display:flex;align-items:center;gap:10px">
            ${avatarCell(row)}
            <div style="min-width:0">
              <div style="font-size:14px;font-weight:${isMe?700:500};
                color:var(--text-primary);white-space:nowrap;
                overflow:hidden;text-overflow:ellipsis;max-width:160px">
                ${name || '—'}
                ${isMe ? `<span style="font-size:10px;margin-inline-start:4px;
                  background:var(--gn-orange);color:#fff;border-radius:4px;
                  padding:1px 5px;font-weight:700">אני</span>` : ''}
              </div>
            </div>
          </div>
        </td>

        <td style="padding:10px 8px;text-align:center;font-size:13px;color:var(--text-secondary)">${played}</td>
        <td style="padding:10px 8px;text-align:center;font-size:13px;color:#2e7d32;font-weight:600">${row.wins||0}</td>
        <td style="padding:10px 8px;text-align:center;font-size:13px;color:var(--text-tertiary)" class="hide-mobile">${row.draws||0}</td>
        <td style="padding:10px 8px;text-align:center;font-size:13px;color:#c62828" class="hide-mobile">${row.losses||0}</td>
        <td style="padding:10px 8px;text-align:center;font-size:13px" class="hide-mobile">${gd(row)}</td>
        <td style="padding:10px 12px;text-align:center">
          <span style="font-size:16px;font-weight:700;color:var(--gn-orange-dim)">${row.points||0}</span>
        </td>
      </tr>`
  }).join('')

  return `
    <div style="overflow-x:auto;border-radius:var(--radius-lg);
      border:1px solid var(--border-light);background:var(--bg-surface)">
      <table style="width:100%;border-collapse:collapse;min-width:360px">
        <thead>
          <tr style="border-bottom:1px solid var(--border-light);background:var(--bg-surface-2)">
            <th style="padding:10px 12px;font-size:11px;font-weight:600;
              color:var(--text-tertiary);text-align:center;width:44px">#</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:600;
              color:var(--text-tertiary);text-align:start">
              ${mode === 'team' ? 'קבוצה' : 'שחקן'}
            </th>
            <th style="padding:10px 8px;font-size:11px;font-weight:600;
              color:var(--text-tertiary);text-align:center">מש'</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:600;
              color:var(--text-tertiary);text-align:center">נצ'</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:600;
              color:var(--text-tertiary);text-align:center"
              class="hide-mobile">תי'</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:600;
              color:var(--text-tertiary);text-align:center"
              class="hide-mobile">הפ'</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:600;
              color:var(--text-tertiary);text-align:center"
              class="hide-mobile">הפ"כ</th>
            <th style="padding:10px 12px;font-size:11px;font-weight:600;
              color:var(--text-tertiary);text-align:center">נק'</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <style>
        @media(max-width:520px){ .hide-mobile{ display:none } }
      </style>
    </div>`
}
