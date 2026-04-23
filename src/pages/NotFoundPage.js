import { navigate } from '../router.js'

export async function render(root) {
  root.innerHTML = `
    <div style="
      display:flex;flex-direction:column;align-items:center;
      justify-content:center;min-height:100dvh;
      font-family:var(--font-base);direction:rtl;gap:16px;
    ">
      <h1 style="font-size:72px;font-weight:700;color:var(--gn-orange);line-height:1">404</h1>
      <h2 style="color:var(--text-primary)">הדף לא נמצא</h2>
      <p style="color:var(--text-secondary)">נראה שהקישור שגוי או שהדף הוסר</p>
      <button onclick="navigate('/home')"
        style="margin-top:8px;padding:10px 24px;background:var(--gn-orange);
               color:#fff;border:none;border-radius:8px;cursor:pointer;
               font-family:var(--font-base);font-size:15px;font-weight:600">
        חזרה לדף הבית
      </button>
    </div>
  `
  // Expose navigate to inline onclick
  window.navigate = navigate
}
