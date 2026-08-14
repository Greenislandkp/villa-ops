// Small utilities shared between views.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayIso() {
  return isoDate(new Date());
}

export function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

// event_date + created_at -> label "Today, 09:12" / "Yesterday, 17:05" / "Mon 10 Aug"
export function formatEntryTimestamp(createdAt) {
  const d = new Date(createdAt);
  const now = new Date();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dToday = isoDate(d) === isoDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const dYesterday = isoDate(d) === isoDate(yesterday);

  if (dToday) return `Today, ${time}`;
  if (dYesterday) return `Yesterday, ${time}`;
  return `${DOW_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatDateLong(isoStr) {
  const d = new Date(isoStr + 'T00:00:00');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatDateShort(isoStr) {
  const d = new Date(isoStr + 'T00:00:00');
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function formatMonthLabel(year, month) {
  return `${MONTHS[month]} ${year}`;
}

export function initials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function statusLabel(status) {
  return { a_faire: 'To do', en_cours: 'In progress', fait: 'Done' }[status] || status;
}

// Turning a hex color unreadable doesn't matter here : it's only ever used
// as an accent (stripe/dot), never as text background.
export function hexOrFallback(hex, fallback = '#8B9A93') {
  return /^#[0-9a-fA-F]{6}$/.test(hex || '') ? hex : fallback;
}

let toastTimer = null;
export function showToast(message) {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div class="toast">${escapeHtml(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 3200);
}

// Short-lived cache of signed URLs (avoids re-signing on every re-render)
const signedUrlCache = new Map(); // path -> { url, expiresAt }
export async function getSignedPhotoUrl(supabase, bucket, path) {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data) return null;
  signedUrlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export function normalizeLabel(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function isReservationCategory(category) {
  return !!category && normalizeLabel(category.label) === 'reservation';
}

export function isCleaningCategory(category) {
  if (!category) return false;
  const n = normalizeLabel(category.label);
  return n === 'cleaning' || n === 'menage' || n === 'housekeeping';
}
