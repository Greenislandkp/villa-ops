import { state } from './store.js';
import { fetchEntryById, fetchReservationsForEntries, updateEntryStatus } from './data.js';
import { supabase, ENTRY_PHOTOS_BUCKET } from './supabase-client.js';
import { escapeHtml, formatEntryTimestamp, statusLabel, hexOrFallback, getSignedPhotoUrl } from './utils.js';

function closeSheet() {
  document.getElementById('sheet-root').innerHTML = '';
}

export async function openEntryDetail(entryId, onChanged) {
  const overlayHtml = `<div class="sheet-overlay" id="detail-overlay"><div class="sheet"><div class="loading-row">Chargement…</div></div></div>`;
  document.getElementById('sheet-root').innerHTML = overlayHtml;
  const overlay = document.getElementById('detail-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });

  let entry;
  try {
    entry = await fetchEntryById(entryId);
  } catch (err) {
    document.getElementById('sheet-root').innerHTML = '';
    return;
  }
  if (!entry) { closeSheet(); return; }

  let reservation = null;
  const cat = state.categoriesById.get(entry.category_id);
  if (cat) {
    const map = await fetchReservationsForEntries([entry.id]);
    reservation = map.get(entry.id) || null;
  }

  let photoUrl = null;
  if (entry.photo_url) {
    photoUrl = await getSignedPhotoUrl(supabase, ENTRY_PHOTOS_BUCKET, entry.photo_url);
  }

  renderDetail(entry, reservation, photoUrl, onChanged);
}

function renderDetail(entry, reservation, photoUrl, onChanged) {
  const cat = state.categoriesById.get(entry.category_id);
  const color = hexOrFallback(cat && cat.color);
  const author = state.teamMembersById.get(entry.author_id);
  const assigned = entry.assigned_to_id ? state.teamMembersById.get(entry.assigned_to_id) : null;
  const villa = state.villasById.get(entry.villa_id);

  const html = `
  <div class="sheet-overlay" id="detail-overlay">
    <div class="sheet">
      <button type="button" class="sheet-close" id="detail-close">✕</button>
      <div class="sheet-handle"></div>
      <span class="entry-label" style="color:${color}">${escapeHtml(cat ? cat.label : 'Autre')}</span>
      <p class="sheet-title" style="margin-top:6px;">${escapeHtml(entry.title)}</p>

      ${entry.description ? `<p class="entry-desc" style="margin-bottom:16px;">${escapeHtml(entry.description)}</p>` : ''}
      ${photoUrl ? `<img src="${photoUrl}" alt="Photo de l'entrée" class="photo-preview show" style="margin-bottom:16px;">` : ''}

      <div class="form-grid" style="gap:10px; margin-bottom:18px;">
        <div class="entry-meta" style="font-size:13px;">
          ${villa ? `<span>${escapeHtml(villa.name)}</span><span class="sep">·</span>` : ''}
          <span>${formatEntryTimestamp(entry.created_at)}</span>
        </div>
        <div class="entry-meta" style="font-size:13px;">
          <span class="avatar">${escapeHtml((author && author.full_name || '?').slice(0, 2).toUpperCase())}</span>
          <span>Ajouté par ${escapeHtml((author && author.full_name) || 'Inconnu')}</span>
        </div>
        ${assigned ? `<div class="entry-meta" style="font-size:13px;">→ Assigné à ${escapeHtml(assigned.full_name)}</div>` : ''}
        ${reservation ? reservationSummaryHtml(reservation, entry) : ''}
      </div>

      <div class="field">
        <label>Statut</label>
        <div class="chip-select" id="detail-status-chips">
          <button type="button" class="status-option a_faire${entry.status === 'a_faire' ? ' active a_faire' : ''}" data-status="a_faire">À faire</button>
          <button type="button" class="status-option en_cours${entry.status === 'en_cours' ? ' active en_cours' : ''}" data-status="en_cours">En cours</button>
          <button type="button" class="status-option fait${entry.status === 'fait' ? ' active fait' : ''}" data-status="fait">Fait</button>
        </div>
      </div>
      <div class="form-error" id="detail-error"></div>
    </div>
  </div>`;

  document.getElementById('sheet-root').innerHTML = html;

  const overlay = document.getElementById('detail-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });
  document.getElementById('detail-close').addEventListener('click', closeSheet);

  document.getElementById('detail-status-chips').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn || btn.classList.contains('active')) return;
    const newStatus = btn.dataset.status;
    try {
      await updateEntryStatus(entry.id, newStatus);
      document.querySelectorAll('#detail-status-chips .status-option').forEach((b) => {
        b.classList.toggle('active', b.dataset.status === newStatus);
      });
      entry.status = newStatus;
      if (onChanged) onChanged();
    } catch (err) {
      const box = document.getElementById('detail-error');
      box.textContent = err.message || 'Mise à jour impossible.';
      box.classList.add('show');
    }
  });
}

function reservationSummaryHtml(reservation, entry) {
  const bits = [];
  if (reservation.guest_count) bits.push(`${reservation.guest_count} pers.`);
  if (reservation.platform) bits.push(reservation.platform);
  if (entry.check_in_time) bits.push(`Check-in ${entry.check_in_time.slice(0, 5)}`);
  if (entry.check_out_time) bits.push(`Check-out ${entry.check_out_time.slice(0, 5)}`);
  if (reservation.amount) bits.push(`${reservation.amount} ${reservation.currency || ''}`.trim());
  return `<div class="entry-meta" style="font-size:13px;">${escapeHtml(reservation.guest_name || '')}${bits.length ? ' · ' + escapeHtml(bits.join(' · ')) : ''}</div>`;
}
