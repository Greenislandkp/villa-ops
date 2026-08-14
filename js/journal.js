import { fetchJournalEntries } from './data.js';
import { state, entryContext } from './store.js';
import { entryCardHtml } from './entry-card.js';
import { escapeHtml } from './utils.js';

let categoryFilter = 'all';

function renderCatFilter() {
  const box = document.getElementById('journal-cat-filter');
  const chips = [`<button class="cat-chip${categoryFilter === 'all' ? ' active' : ''}" data-cat="all">All</button>`];
  state.categories.forEach((c) => {
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

async function renderList() {
  const list = document.getElementById('journal-list');
  list.innerHTML = '<div class="loading-row">Loading…</div>';
  try {
    const entries = await fetchJournalEntries({ villaId: state.selectedVillaId, categoryId: categoryFilter });
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
  renderCatFilter();
  await renderList();
}

export function refreshJournalIfActive() {
  if (state.currentView === 'journal') renderList();
}
