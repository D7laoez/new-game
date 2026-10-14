import './styles/main.css';
import { PartyApp } from './ui/PartyApp.ts';

function applyA11yPrefs(): void {
  try {
    const raw = localStorage.getItem('party_game_app_colorblind');
    const raw2 = localStorage.getItem('party_game_app_reduce_motion');
    const parse = (v: string | null) => { if (!v) return false; try { const j = JSON.parse(v); return !!(j && typeof j === 'object' && '__data' in j ? j.__data : j); } catch { return v === 'true'; } };
    if (parse(raw)) document.documentElement.classList.add('color-blind');
    if (parse(raw2)) document.documentElement.classList.add('reduce-motion');
  } catch {}
}
function initApp(): void {
  const root = document.getElementById('app');
  if (!root) {
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'padding:24px;text-align:center;color:#fff;background:#0a0c16;font-family:system-ui';
    errDiv.innerHTML = '<h2>App container not found</h2><p>Please reload the page.</p>';
    document.body.appendChild(errDiv);
    return;
  }
  applyA11yPrefs();
  try {
    new PartyApp(root);
  } catch (e) {
    console.error('PartyApp init failed:', e);
    root.innerHTML = '<div style="padding:32px;text-align:center"><h2>Failed to start</h2><p>Please refresh the page.</p><button onclick="location.reload()" style="margin-top:16px;padding:10px 20px;border-radius:10px;border:none;background:#6366f1;color:#fff;font-weight:700;cursor:pointer">Reload</button></div>';
  }

  // PWA Service Worker: register + auto-reload on update when user accepts
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Check for updates periodically (every 30 min) while app is open
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      // When new SW takes over, show toast and offer reload
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available: notify user
            const bar = document.createElement('div');
            bar.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:12px 18px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.4);z-index:9999;display:flex;gap:12px;align-items:center;font-family:system-ui;font-size:14px;';
            bar.innerHTML = '<span>Update available</span><button id="pwa-reload" style="background:#6366f1;color:#fff;border:none;padding:8px 14px;border-radius:10px;font-weight:700;cursor:pointer">Reload</button><button id="pwa-dismiss" style="background:transparent;color:#94a3b8;border:1px solid rgba(255,255,255,.15);padding:8px 14px;border-radius:10px;cursor:pointer">Later</button>';
            document.body.appendChild(bar);
            bar.querySelector('#pwa-reload')?.addEventListener('click', () => {
              worker.postMessage({ type: 'SKIP_WAITING' });
            });
            bar.querySelector('#pwa-dismiss')?.addEventListener('click', () => bar.remove());
            setTimeout(() => { try { bar.remove(); } catch {} }, 12000);
          }
        });
      });
    }).catch(err => {
      console.log('SW registration note:', err);
    });
  }

  // Global error logging (sanitized: avoid leaking sensitive data to console in prod)
  window.addEventListener('error', e => console.error('Global error:', e.error?.message ?? e.message));
  window.addEventListener('unhandledrejection', e => console.error('Unhandled rejection:', e.reason?.message ?? String(e.reason).slice(0, 400)));
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
