import { fetchTaskEntries } from './data.js';
import { state, entryContext, getReservationCategory } from './store.js';
import { entryCardHtml } from './entry-card.js';
import { escapeHtml } from './utils.js';

let sortBy = 'due'; // 'due' (event_date, default) or 'added' (created_at)

function reservationCategoryId() {
  const cat = getReservationCategory();
  return cat ? cat.id : null;
}

function renderSortToggle() {
  const box = document.getElementById('tasks-sort-toggle');
  box.innerHTML = `
    <button class="cat-chip${sortBy === 'due' ? ' active' : ''}" data-sort="due">Due date</button>
    <button class="cat-chip${sortBy === 'added' ? ' active' : ''}" data-sort="added">Date added</button>
  `;
  box.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sortBy = btn.dataset.sort;
      renderSortToggle();
      renderTasks();
    });
  });
}

export async function renderTasks() {
  renderSortToggle();
  const list = document.getElementById('tasks-list');
  list.innerHTML = '<div class="loading-row">Loading…</div>';
  try {
    const entries = await fetchTaskEntries({ villaId: state.selectedVillaId, excludeCategoryId: reservationCategoryId(), sortBy });
    updateTasksBadge(entries.length);
    if (!entries.length) {
      list.innerHTML = `<div class="empty-state"><b>No tasks in progress</b>Everything is up to date for this selection.</div>`;
      return;
    }
    const showVilla = state.selectedVillaId === 'all';
    const ctx = entryContext(showVilla);
    list.innerHTML = entries.map((e) => entryCardHtml(e, ctx)).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><b>Loading error</b>${escapeHtml(err.message || 'Try again in a moment.')}</div>`;
  }
}

export async function updateTasksBadgeCount() {
  try {
    const entries = await fetchTaskEntries({ villaId: state.selectedVillaId, excludeCategoryId: reservationCategoryId() });
    updateTasksBadge(entries.length);
  } catch (_) {
    /* silent: the badge is only indicative */
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
