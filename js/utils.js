// Petits utilitaires partagés entre les vues.

const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_SHORT = ['Jan.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sep.', 'Oct.', 'Nov.', 'Déc.'];

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

// event_date + created_at -> libellé "Aujourd'hui, 09:12" / "Hier, 17:05" / "Lun. 10 août"
export function formatEntryTimestamp(createdAt) {
  const d = new Date(createdAt);
  const now = new Date();
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dToday = isoDate(d) === isoDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const dYesterday = isoDate(d) === isoDate(yesterday);

  if (dToday) return `Aujourd'hui, ${time}`;
  if (dYesterday) return `Hier, ${time}`;
  return `${DOW[d.getDay()]}. ${d.getDate()} ${MONTHS_SHORT[d.getMonth()].replace('.', '').toLowerCase()}`;
}

export function formatDateLong(isoStr) {
  const d = new Date(isoStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`;
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
  return { a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait' }[status] || status;
}

// Rend une couleur hex lisible en la mélangeant sur --paper si trop sombre/claire n'a pas
// d'importance ici : on l'utilise uniquement en accent (stripe/dot), jamais en fond de texte.
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

// Cache court des URLs signées (évite de re-signer à chaque re-render)
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
