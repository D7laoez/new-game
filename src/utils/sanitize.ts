/**
 * Minimal XSS-safe sanitizer for player-controlled strings inserted into innerHTML.
 * - Escapes &, <, >, ", ', `, =
 * - Trims & limits length
 */
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

export function sanitizeName(input: unknown, maxLen = 14, fallback = 'Player'): string {
  const raw = String(input ?? '').trim();
  if (!raw) return fallback;
  // Allow letters (any script), numbers, spaces, _ - .
  // Strip control chars and strip HTML-like content via escape
  let cleaned = raw
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, maxLen)
    .trim();
  if (!cleaned) return fallback;
  return escapeHtml(cleaned);
}

export function validateAvatar(input: unknown, allowed: string[], fallback = '🦊'): string {
  const val = String(input ?? '');
  return allowed.includes(val) ? val : fallback;
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
