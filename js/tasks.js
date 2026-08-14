import { fetchTaskEntries } from './data.js';
import { state, entryContext } from './store.js';
import { entryCardHtml } from './entry-card.js';
import { escapeHtml } from './utils.js';

export async function renderTasks() {
  const list = document.getElementById('tasks-list');
  list.innerHTML = '<div class="loading-row">Chargement…</div>';
  try {
    const entries = await fetchTaskEntries({ villaId: state.selectedVillaId });
    updateTasksBadge(entries.length);
    if (!entries.length) {
      list.innerHTML = `<div class="empty-state"><b>Aucune tâche en cours</b>Tout est à jour pour cette sélection.</div>`;
      return;
    }
    const showVilla = state.selectedVillaId === 'all';
    const ctx = entryContext(showVilla);
    list.innerHTML = entries.map((e) => entryCardHtml(e, ctx)).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><b>Erreur de chargement</b>${escapeHtml(err.message || 'Réessaie dans un instant.')}</div>`;
  }
}

export async function updateTasksBadgeCount() {
  try {
    const entries = await fetchTaskEntries({ villaId: state.selectedVillaId });
    updateTasksBadge(entries.length);
  } catch (_) {
    /* silencieux : le badge n'est qu'indicatif */
  }
}

function updateTasksBadge(count) {
  const badge = document.getElementById('tasks-badge');
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

export function refreshTasksIfActive() {
  if (state.currentView === 'tasks') renderTasks();
  else updateTasksBadgeCount();
}
