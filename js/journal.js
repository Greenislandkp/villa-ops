import { fetchJournalEntries } from './data.js';
import { state, entryContext, getReservationCategory } from './store.js';
import { entryCardHtml } from './entry-card.js';
import { escapeHtml, sortEntriesByAssignee, filterEntriesByAssignee, assigneeFilterChipsHtml } from './utils.js';

let categoryFilter = 'all';
let sortBy = 'due'; // 'due' (event_date, default), 'assignee' (initials), 'added' (created_at)
let assigneeFilter = 'all'; // only meaningful when sortBy === 'assignee'

function renderSortToggle() {
  const box = document.getElementById('journal-sort-toggle');
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
      renderList();
    });
  });
}

function renderAssigneeFilter() {
  const box = document.getElementById('journal-assignee-filter');
  box.classList.toggle('hidden', sortBy !== 'assignee');
  if (sortBy !== 'assignee') return;
  box.innerHTML = assigneeFilterChipsHtml(state.teamMembers, assigneeFilter);
  box.querySelectorAll('[data-assignee]').forEach((btn) => {
    btn.addEventListener('click', () => {
      assigneeFilter = btn.dataset.assignee;
      renderAssigneeFilter();
      renderList();
    });
  });
}

function renderCatFilter() {
  const box = document.getElementById('journal-cat-filter');
  const chips = [`<button class="cat-chip${categoryFilter === 'all' ? ' active' : ''}" data-cat="all">All</button>`];
  // Reservations have their own tab now and never appear in the Journal.
  state.categories.filter((c) => c.id !== reservationCategoryId()).forEach((c) => {
    chips.push(
      `<button class="cat-chip${categoryFilter === c.id ? ' active' : ''}" data-cat="${c.id}"><span class="dot" style="background:${c.color || '#8B9A93'}"></span>${escapeHtml(c.label)}</button>`
    );
  });
  box.innerHTML = chips.join('');
  box.querySelectorAll('.cat-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      categoryFilter = btn.dataset.cat;
      renderCatFilter();
      renderList();
    });
  });
}

function reservationCategoryId() {
  const cat = getReservationCategory();
  return cat ? cat.id : null;
}

async function renderList() {
  const list = document.getElementById('journal-list');
  list.innerHTML = '<div class="loading-row">Loading…</div>';
  try {
    let entries = await fetchJournalEntries({
      villaId: state.selectedVillaId,
      categoryId: categoryFilter,
      sortBy: sortBy === 'assignee' ? 'due' : sortBy,
      excludeCategoryId: reservationCategoryId(),
    });
    if (sortBy === 'assignee') {
      entries = filterEntriesByAssignee(entries, assigneeFilter);
      entries = sortEntriesByAssignee(entries, state.teamMembersById);
    }
    if (!entries.length) {
      list.innerHTML = `<div class="empty-state"><b>Nothing to show</b>No entries for this selection. Tap + to add one.</div>`;
      return;
    }
    const showVilla = state.selectedVillaId === 'all';
    const ctx = entryContext(showVilla);
    list.innerHTML = entries.map((e) => entryCardHtml(e, ctx)).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><b>Loading error</b>${escapeHtml(err.message || 'Try again in a moment.')}</div>`;
  }
}

export async function renderJournal() {
  renderSortToggle();
  renderAssigneeFilter();
  renderCatFilter();
  await renderList();
}

export function refreshJournalIfActive() {
  if (state.currentView === 'journal') renderList();
}
