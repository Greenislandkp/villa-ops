import { fetchReservationEntries, fetchReservationsForEntries } from './data.js';
import { state, getReservationCategory } from './store.js';
import { escapeHtml, formatDateShort, memberInitials, hexOrFallback, villaTagCode } from './utils.js';

function reservationCardHtml(entry, reservation, ctx) {
  const cat = ctx.categoriesById.get(entry.category_id);
  const color = hexOrFallback(cat && cat.color);
  const assigned = entry.assigned_to_id ? ctx.teamMembersById.get(entry.assigned_to_id) : null;
  const villa = ctx.villasById.get(entry.villa_id);
  const tagCode = villa ? villaTagCode(villa.name) : '';

  const arrival = entry.event_date ? formatDateShort(entry.event_date) : '—';
  const departure = reservation && reservation.check_out_date ? formatDateShort(reservation.check_out_date) : '—';

  const metaParts = [];
  if (ctx.showVilla && villa) metaParts.push(escapeHtml(villa.name));
  if (reservation && reservation.guest_count) metaParts.push(`${reservation.guest_count} guests`);
  if (reservation && reservation.platform) metaParts.push(escapeHtml(reservation.platform));
  if (entry.check_in_time) metaParts.push(`<span style="font-family:var(--font-mono)">In ${escapeHtml(entry.check_in_time.slice(0, 5))}</span>`);
  if (entry.check_out_time) metaParts.push(`<span style="font-family:var(--font-mono)">Out ${escapeHtml(entry.check_out_time.slice(0, 5))}</span>`);
  if (reservation && reservation.amount) metaParts.push(`${reservation.amount} ${reservation.currency || ''}`.trim());
  if (assigned) metaParts.push(`<span class="avatar" title="${escapeHtml(assigned.full_name)}">${escapeHtml(memberInitials(assigned))}</span>`);

  const metaHtml = metaParts.map((p, i) => (i === 0 ? p : `<span class="sep">·</span> ${p}`)).join(' ');
  const guestName = (reservation && reservation.guest_name) || entry.title;

  return `
  <div class="entry clickable" data-entry-id="${entry.id}">
    <div class="tag">${tagCode ? `<span class="tag-label">${escapeHtml(tagCode)}</span>` : ''}<div class="stripe" style="background:${color}"></div></div>
    <div class="entry-body">
      <div class="entry-top">
        <span class="entry-label" style="color:${color}">${escapeHtml(cat ? cat.label : 'Reservation')}</span>
        <span class="entry-time">${escapeHtml(arrival)} → ${escapeHtml(departure)}</span>
      </div>
      <div class="entry-title">${escapeHtml(guestName)}</div>
      <div class="entry-meta">
        ${metaHtml}
      </div>
    </div>
  </div>`;
}

export async function renderReservations() {
  const list = document.getElementById('reservations-list');
  list.innerHTML = '<div class="loading-row">Loading…</div>';

  const cat = getReservationCategory();
  if (!cat) {
    list.innerHTML = `<div class="empty-state"><b>No Reservation category</b>Nothing to show yet.</div>`;
    return;
  }

  try {
    const entries = await fetchReservationEntries({ villaId: state.selectedVillaId, categoryId: cat.id });
    if (!entries.length) {
      list.innerHTML = `<div class="empty-state"><b>No reservations</b>No reservations for this selection. Tap + to add one.</div>`;
      return;
    }
    const reservationsMap = await fetchReservationsForEntries(entries.map((e) => e.id));
    const ctx = {
      categoriesById: state.categoriesById,
      teamMembersById: state.teamMembersById,
      villasById: state.villasById,
      showVilla: state.selectedVillaId === 'all',
    };
    list.innerHTML = entries.map((e) => reservationCardHtml(e, reservationsMap.get(e.id), ctx)).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><b>Loading error</b>${escapeHtml(err.message || 'Try again in a moment.')}</div>`;
  }
}

export function refreshReservationsIfActive() {
  if (state.currentView === 'reservations') renderReservations();
}
