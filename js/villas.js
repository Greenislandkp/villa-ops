import { fetchRecentEntriesForVillas } from './data.js';
import { state, getReservationCategory } from './store.js';
import { escapeHtml, formatEntryTimestamp, hexOrFallback } from './utils.js';

export async function renderVillas() {
  const list = document.getElementById('villas-list');
  list.innerHTML = '<div class="loading-row">Loading…</div>';

  if (!state.villas.length) {
    list.innerHTML = `<div class="empty-state"><b>No accessible villa</b>Contact the Villa Ops administrator if that's not expected.</div>`;
    return;
  }

  try {
    const reservationCat = getReservationCategory();
    const entries = await fetchRecentEntriesForVillas(state.villas.map((v) => v.id));
    const byVilla = new Map();
    state.villas.forEach((v) => byVilla.set(v.id, []));
    entries.forEach((e) => {
      if (byVilla.has(e.villa_id)) byVilla.get(e.villa_id).push(e);
    });

    const cards = state.villas.map((villa) => {
      const villaEntries = byVilla.get(villa.id) || [];
      const openCount = villaEntries.filter(
        (e) => (e.status === 'a_faire' || e.status === 'en_cours') && (!reservationCat || e.category_id !== reservationCat.id)
      ).length;
      const last = villaEntries[0]; // already sorted by created_at desc
      const color = hexOrFallback(villa.color, '#C99A3D');
      return `
      <div class="villa-card">
        <div class="villa-card-dot" style="background:${color}"></div>
        <div class="villa-card-body">
          <p class="villa-card-name">${escapeHtml(villa.name)}</p>
          ${villa.owner_name ? `<p class="villa-card-owner">${escapeHtml(villa.owner_name)}</p>` : ''}
          <div class="villa-card-stats">
            <span class="villa-stat"><b>${openCount}</b> task${openCount === 1 ? '' : 's'} in progress</span>
          </div>
          ${last ? `<p class="villa-card-last">Last entry: ${escapeHtml(last.title)} — ${formatEntryTimestamp(last.created_at)}</p>` : '<p class="villa-card-last">No entries yet.</p>'}
        </div>
      </div>`;
    });

    list.innerHTML = cards.join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><b>Loading error</b>${escapeHtml(err.message || '')}</div>`;
  }
}
