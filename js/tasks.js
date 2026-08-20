import { fetchTaskEntries } from './data.js';
import { state, entryContext, getReservationCategory } from './store.js';
import { entryCardHtml } from './entry-card.js';
import { escapeHtml, sortEntriesByAssignee, filterEntriesByAssignee, assigneeFilterChipsHtml } from './utils.js';

let sortBy = 'due'; // 'due' (event_date, default), 'assignee' (initials), 'added' (created_at)
let assigneeFilter = 'all'; // only meaningful when sortBy === 'assignee'

function reservationCategoryId() {
  const cat = getReservationCategory();
  return cat ? cat.id : null;
}

function renderSortToggle() {
  const box = document.getElementById('tasks-sort-toggle');
  box.innerHTML = `
    <button class="cat-chip${sortBy === 'due' ? ' active' : ''}" data-sort="due">Due date</button>
    <button class="cat-chip${sortBy === 'assignee' ? ' active' : ''}" data-sort="assignee">Assigned</button>
    <button class="cat-chip${sortBy === 'added' ? ' active' : ''}" data-sort="added">Date added</button>
  `;
  box.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sortBy = btn.dataset.sort;
      if (sortBy !== 'assignee') assigneeFilter = 'all';
      renderSortToggle();
      renderAssigneeFilter();
      renderTasks();
    });
  });
}

function renderAssigneeFilter() {
  const box = document.getElementById('tasks-assignee-filter');
  box.classList.toggle('hidden', sortBy !== 'assignee');
  if (sortBy !== 'assignee') return;
  box.innerHTML = assigneeFilterChipsHtml(state.teamMembers, assigneeFilter);
  box.querySelectorAll('[data-assignee]').forEach((btn) => {
    btn.addEventListener('click', () => {
      assigneeFilter = btn.dataset.assignee;
      renderAssigneeFilter();
      renderTasks();
    });
  });
}

export async function renderTasks() {
  renderSortToggle();
  renderAssigneeFilter();
  const list = document.getElementById('tasks-list');
  list.innerHTML = '<div class="loading-row">Loading…</div>';
  try {
    let entries = await fetchTaskEntries({
      villaIds: state.selectedVillaIds,
      excludeCategoryId: reservationCategoryId(),
      sortBy: sortBy === 'assignee' ? 'due' : sortBy,
    });
    updateTasksBadge(entries.length); // total, unaffected by the assignee sub-filter
    if (sortBy === 'assignee') {
      entries = filterEntriesByAssignee(entries, assigneeFilter);
      entries = sortEntriesByAssignee(entries, state.teamMembersById);
    }
    if (!entries.length) {
      list.innerHTML = `<div class="empty-state"><b>No tasks in progress</b>Everything is up to date for this selection.</div>`;
      return;
    }
    const showVilla = state.selectedVillaIds.length > 1;
    const ctx = entryContext(showVilla);
    list.innerHTML = entries.map((e) => entryCardHtml(e, ctx)).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><b>Loading error</b>${escapeHtml(err.message || 'Try again in a moment.')}</div>`;
  }
}

export async function updateTasksBadgeCount() {
  try {
    const entries = await fetchTaskEntries({ villaIds: state.selectedVillaIds, excludeCategoryId: reservationCategoryId() });
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
