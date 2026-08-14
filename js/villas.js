import { fetchRecentEntriesForVillas } from './data.js';
import { state } from './store.js';
import { escapeHtml, formatEntryTimestamp, hexOrFallback } from './utils.js';

export async function renderVillas() {
  const list = document.getElementById('villas-list');
  list.innerHTML = '<div class="loading-row">Chargement…</div>';

  if (!state.villas.length) {
    list.innerHTML = `<div class="empty-state"><b>Aucune villa accessible</b>Contacte l'administrateur de Villa Ops si ça ne devrait pas être le cas.</div>`;
    return;
  }

  try {
    const entries = await fetchRecentEntriesForVillas(state.villas.map((v) => v.id));
    const byVilla = new Map();
    state.villas.forEach((v) => byVilla.set(v.id, []));
    entries.forEach((e) => {
      if (byVilla.has(e.villa_id)) byVilla.get(e.villa_id).push(e);
    });

    const cards = state.villas.map((villa) => {
      const villaEntries = byVilla.get(villa.id) || [];
      const openCount = villaEntries.filter((e) => e.status === 'a_faire' || e.status === 'en_cours').length;
      const last = villaEntries[0]; // déjà trié par created_at desc
      const color = hexOrFallback(villa.color, '#C99A3D');
      return `
      <div class="villa-card">
        <div class="villa-card-dot" style="background:${color}"></div>
        <div class="villa-card-body">
          <p class="villa-card-name">${escapeHtml(villa.name)}</p>
          ${villa.owner_name ? `<p class="villa-card-owner">${escapeHtml(villa.owner_name)}</p>` : ''}
          <div class="villa-card-stats">
            <span class="villa-stat"><b>${openCount}</b> tâche${openCount === 1 ? '' : 's'} en cours</span>
          </div>
          ${last ? `<p class="villa-card-last">Dernière entrée : ${escapeHtml(last.title)} — ${formatEntryTimestamp(last.created_at)}</p>` : '<p class="villa-card-last">Aucune entrée pour l\'instant.</p>'}
        </div>
      </div>`;
    });

    list.innerHTML = cards.join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><b>Erreur de chargement</b>${escapeHtml(err.message || '')}</div>`;
  }
}
