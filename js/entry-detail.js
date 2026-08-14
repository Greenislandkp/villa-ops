import { state, isAdmin } from './store.js';
import { fetchEntryById, fetchReservationsForEntries, updateEntryStatus, deleteEntry } from './data.js';
import { supabase, ENTRY_PHOTOS_BUCKET } from './supabase-client.js';
import { escapeHtml, formatEntryTimestamp, formatDueDate, formatDateShort, statusLabel, hexOrFallback, getSignedPhotoUrl, isReservationCategory, memberInitials, showToast } from './utils.js';
import { openEntryForm } from './entry-form.js';

function closeSheet() {
  document.getElementById('sheet-root').innerHTML = '';
}

export async function openEntryDetail(entryId, onChanged) {
  const overlayHtml = `<div class="sheet-overlay" id="detail-overlay"><div class="sheet"><div class="loading-row">Loading…</div></div></div>`;
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
  const isReservation = isReservationCategory(cat);

  const html = `
  <div class="sheet-overlay" id="detail-overlay">
    <div class="sheet">
      <button type="button" class="sheet-close" id="detail-close">✕</button>
      <div class="sheet-handle"></div>
      <span class="entry-label" style="color:${color}">${escapeHtml(cat ? cat.label : 'Other')}</span>
      <p class="sheet-title" style="margin-top:6px;">${escapeHtml(entry.title)}</p>

      ${entry.description ? `<p class="entry-desc" style="margin-bottom:16px;">${escapeHtml(entry.description)}</p>` : ''}
      ${photoUrl ? `<img src="${photoUrl}" alt="Entry photo" class="photo-preview show" style="margin-bottom:16px;">` : ''}

      <div class="form-grid" style="gap:10px; margin-bottom:18px;">
        <div class="entry-meta" style="font-size:13px;">
          ${villa ? `<span>${escapeHtml(villa.name)}</span><span class="sep">·</span>` : ''}
          <span>Added ${formatEntryTimestamp(entry.created_at)}</span>
        </div>
        ${isReservation ? '' : `<div class="entry-meta" style="font-size:13px;"><span>Due ${escapeHtml(formatDueDate(entry.event_date))}</span></div>`}
        <div class="entry-meta" style="font-size:13px;">
          <span class="avatar">${escapeHtml(memberInitials(author))}</span>
          <span>Added by ${escapeHtml((author && author.full_name) || 'Unknown')}</span>
        </div>
        ${assigned ? `<div class="entry-meta" style="font-size:13px;">→ Assigned to ${escapeHtml(assigned.full_name)}</div>` : ''}
        ${reservation ? reservationSummaryHtml(reservation, entry) : ''}
      </div>

      <div class="field${isReservation ? ' hidden' : ''}">
        <label>Status</label>
        <div class="chip-select" id="detail-status-chips">
          <button type="button" class="status-option a_faire${entry.status === 'a_faire' ? ' active a_faire' : ''}" data-status="a_faire">To do</button>
          <button type="button" class="status-option en_cours${entry.status === 'en_cours' ? ' active en_cours' : ''}" data-status="en_cours">In progress</button>
          <button type="button" class="status-option fait${entry.status === 'fait' ? ' active fait' : ''}" data-status="fait">Done</button>
        </div>
      </div>
      <div class="form-error" id="detail-error"></div>

      <div class="sheet-actions" style="margin-top:18px;">
        <button type="button" class="btn-secondary" id="detail-edit">Edit entry</button>
        ${isAdmin() ? `<button type="button" class="btn-secondary" id="detail-delete" style="color:#E8A088; border-color:rgba(181,80,42,0.4);">Delete entry</button>` : ''}
      </div>
    </div>
  </div>`;

  document.getElementById('sheet-root').innerHTML = html;

  const overlay = document.getElementById('detail-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });
  document.getElementById('detail-close').addEventListener('click', closeSheet);

  const statusChips = document.getElementById('detail-status-chips');
  if (statusChips) {
    statusChips.addEventListener('click', async (e) => {
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
        box.textContent = err.message || 'Update failed.';
        box.classList.add('show');
      }
    });
  }

  document.getElementById('detail-edit').addEventListener('click', () => {
    closeSheet();
    openEntryForm(onChanged, entry, reservation);
  });

  const deleteBtn = document.getElementById('detail-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const confirmed = window.confirm(`Delete "${entry.title}"? This can't be undone.`);
      if (!confirmed) return;
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting…';
      try {
        await deleteEntry(entry);
        closeSheet();
        showToast('Entry deleted.');
        if (onChanged) onChanged();
      } catch (err) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Delete entry';
        const box = document.getElementById('detail-error');
        box.textContent = err.message || 'Could not delete this entry.';
        box.classList.add('show');
      }
    });
  }
}

function reservationSummaryHtml(reservation, entry) {
  const bits = [];
  if (reservation.guest_count) bits.push(`${reservation.guest_count} guests`);
  if (reservation.platform) bits.push(reservation.platform);
  const arrival = entry.event_date ? formatDateShort(entry.event_date) : null;
  const departure = reservation.check_out_date ? formatDateShort(reservation.check_out_date) : null;
  if (arrival && departure) bits.push(`${arrival} → ${departure}`);
  else if (arrival) bits.push(`From ${arrival}`);
  if (entry.check_in_time) bits.push(`Check-in ${entry.check_in_time.slice(0, 5)}`);
  if (entry.check_out_time) bits.push(`Check-out ${entry.check_out_time.slice(0, 5)}`);
  if (reservation.amount) bits.push(`${reservation.amount} ${reservation.currency || ''}`.trim());
  return `<div class="entry-meta" style="font-size:13px;">${escapeHtml(reservation.guest_name || '')}${bits.length ? ' · ' + escapeHtml(bits.join(' · ')) : ''}</div>`;
}
