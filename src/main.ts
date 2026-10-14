import './styles/main.css';
import { PartyApp } from './ui/PartyApp.ts';

function initApp(): void {
  const root = document.getElementById('app');
  if (!root) {
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'padding:24px;text-align:center;color:#fff;background:#0a0c16;font-family:system-ui';
    errDiv.innerHTML = '<h2>⚠️ App container not found</h2><p>Please reload the page.</p>';
    document.body.appendChild(errDiv);
    return;
  }
  try {
    new PartyApp(root);
  } catch (e) {
    console.error('PartyApp init failed:', e);
    root.innerHTML = '<div style="padding:32px;text-align:center"><h2>⚠️ Failed to start</h2><p>Please refresh the page.</p><button onclick="location.reload()" style="margin-top:16px;padding:10px 20px;border-radius:10px;border:none;background:#6366f1;color:#fff;font-weight:700;cursor:pointer">Reload</button></div>';
  }

  // Register PWA Service Worker
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration note:', err);
    });
  }

  window.addEventListener('error', e => console.error('Global error:', e.error || e.message));
  window.addEventListener('unhandledrejection', e => console.error('Unhandled rejection:', e.reason));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
