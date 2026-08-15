import { supabase } from './supabase-client.js';
import { getSession, onAuthStateChange, signOut, wireLoginForm } from './auth.js';
import { loadCurrentTeamMember, loadAccessibleVillas, loadTeamMembers, loadCategories } from './access.js';
import { state, setReferenceData } from './store.js';
import { renderJournal, refreshJournalIfActive } from './journal.js';
import { renderCalendar, refreshCalendarIfActive } from './calendar.js';
import { renderTasks, refreshTasksIfActive } from './tasks.js';
import { renderReservations, refreshReservationsIfActive } from './reservations.js';
import { renderVillas } from './villas.js';
import { openEntryForm } from './entry-form.js';
import { openEntryDetail } from './entry-detail.js';
import { subscribeEntries, unsubscribeEntries } from './realtime.js';
import { markSheetOpened, syncSheetFlag } from './nav-history.js';
import { escapeHtml, showToast } from './utils.js';

const VIEW_TITLES = {
  journal: 'Journal',
  calendar: 'Calendar',
  tasks: 'Tasks in progress',
  reservations: 'Reservations',
  villas: 'Villas',
};

let booted = false;

async function boot() {
  if (booted) return;
  booted = true;

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');

  const { data: { user } } = await supabase.auth.getUser();

  // Each query is isolated: a failure on one table (e.g. villas if an RLS
  // policy blocks it) must not be mistaken for "no profile".
  const [teamMemberResult, villasResult, categoriesResult, teamMembersResult] = await Promise.allSettled([
    loadCurrentTeamMember(user.id),
    loadAccessibleVillas(),
    loadCategories(),
    loadTeamMembers(),
  ]);

  const errors = [];
  if (teamMemberResult.status === 'rejected') errors.push(`team_members: ${teamMemberResult.reason.message || teamMemberResult.reason}`);
  if (villasResult.status === 'rejected') errors.push(`villas: ${villasResult.reason.message || villasResult.reason}`);
  if (categoriesResult.status === 'rejected') errors.push(`categories: ${categoriesResult.reason.message || categoriesResult.reason}`);
  if (teamMembersResult.status === 'rejected') errors.push(`team_members (list): ${teamMembersResult.reason.message || teamMembersResult.reason}`);

  const refData = {
    currentTeamMember: teamMemberResult.status === 'fulfilled' ? teamMemberResult.value : null,
    villas: villasResult.status === 'fulfilled' ? villasResult.value : [],
    categories: categoriesResult.status === 'fulfilled' ? categoriesResult.value : [],
    teamMembers: teamMembersResult.status === 'fulfilled' ? teamMembersResult.value : [],
  };

  setReferenceData(refData);

  if (errors.length) {
    renderBootError(errors);
    return;
  }

  if (!state.currentTeamMember) {
    renderNoProfileState();
    return;
  }

  renderVillaSwitch();
  renderLegend();

  await switchView('journal', false);
  history.replaceState({ type: 'view', view: 'journal' }, '');
  subscribeEntries(onRealtimeChange);
}

function teardown() {
  booted = false;
  unsubscribeEntries();
  document.getElementById('app-root').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

function renderBootError(errors) {
  document.getElementById('villa-switch').innerHTML = '';
  document.getElementById('legend').innerHTML = '';
  document.getElementById('header-title').textContent = 'Villa Ops';
  document.getElementById('header-eyebrow').textContent = 'Loading error';
  document.querySelector('.views-wrap').innerHTML = `
    <div class="view">
      <div class="empty-state" style="padding-top:40px; text-align:left;">
        <b style="text-align:center; display:block;">Error loading data</b>
        <p style="margin:14px 0 6px;">The technical detail below helps diagnose the issue (RLS policy, table, etc.):</p>
        <pre style="white-space:pre-wrap; background:var(--ink-2); border:1px solid var(--line); border-radius:10px; padding:12px; font-family:var(--font-mono); font-size:11.5px; color:#E8A088;">${escapeHtml(errors.join('\n'))}</pre>
      </div>
    </div>`;
  document.getElementById('fab-add').classList.add('hidden');
  document.querySelector('nav.bottomnav').classList.add('hidden');
}

function renderNoProfileState() {
  document.getElementById('villa-switch').innerHTML = '';
  document.getElementById('legend').innerHTML = '';
  document.getElementById('header-title').textContent = 'Villa Ops';
  document.getElementById('header-eyebrow').textContent = 'Incomplete profile';
  document.querySelector('.views-wrap').innerHTML = `
    <div class="view">
      <div class="empty-state" style="padding-top:60px;">
        <b>Profile not set up yet</b>
        Your account exists but no Villa Ops profile is linked to it yet.
        Contact the administrator to finish setting up your access.
      </div>
    </div>`;
  document.getElementById('fab-add').classList.add('hidden');
  document.querySelector('nav.bottomnav').classList.add('hidden');
}

function renderVillaSwitch() {
  const box = document.getElementById('villa-switch');
  const chips = [`<button type="button" class="villa-chip${state.selectedVillaId === 'all' ? ' active' : ''}" data-villa="all">All villas</button>`];
  state.villas.forEach((v) => {
    chips.push(`<button type="button" class="villa-chip${state.selectedVillaId === v.id ? ' active' : ''}" data-villa="${v.id}">${escapeHtml(v.name)}</button>`);
  });
  box.innerHTML = chips.join('');
}

function wireVillaSwitchClicks() {
  document.getElementById('villa-switch').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-villa]');
    if (!btn) return;
    state.selectedVillaId = btn.dataset.villa;
    document.querySelectorAll('#villa-switch .villa-chip').forEach((c) => c.classList.toggle('active', c === btn));
    updateHeaderEyebrow();
    refreshCurrentView();
    refreshTasksIfActive();
  });
}

function renderLegend() {
  const box = document.getElementById('legend');
  box.innerHTML = state.categories
    .map((c) => `<div class="legend-item"><span class="dot" style="background:${c.color || '#8B9A93'}"></span>${escapeHtml(c.label)}</div>`)
    .join('');
}

function updateHeaderEyebrow() {
  const eyebrow = document.getElementById('header-eyebrow');
  if (state.selectedVillaId === 'all') {
    eyebrow.textContent = 'All villas';
  } else {
    const villa = state.villasById.get(state.selectedVillaId);
    eyebrow.textContent = villa ? villa.name : 'Villa Ops';
  }
}

function wireNav() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

async function switchView(view, push = true) {
  if (push && view !== state.currentView) {
    history.pushState({ type: 'view', view }, '');
  }
  state.currentView = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  document.getElementById('header-title').textContent = VIEW_TITLES[view] || 'Villa Ops';
  updateHeaderEyebrow();

  if (view === 'journal') await renderJournal();
  else if (view === 'calendar') await renderCalendar();
  else if (view === 'tasks') await renderTasks();
  else if (view === 'reservations') await renderReservations();
  else if (view === 'villas') await renderVillas();
}

function refreshCurrentView() {
  switch (state.currentView) {
    case 'journal': return refreshJournalIfActive();
    case 'calendar': return refreshCalendarIfActive();
    case 'tasks': return refreshTasksIfActive();
    case 'reservations': return refreshReservationsIfActive();
    case 'villas': return renderVillas();
    default: return undefined;
  }
}

function wireFab() {
  document.getElementById('fab-add').addEventListener('click', () => {
    markSheetOpened();
    openEntryForm(() => {
      refreshCurrentView();
      refreshTasksIfActive();
    });
  });
}

function wireLogout() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut();
  });
}

function wireEntryClickDelegation() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-entry-id]');
    if (!el) return;
    if (!el.classList.contains('entry') && !el.classList.contains('slot')) return;
    markSheetOpened();
    openEntryDetail(el.dataset.entryId, () => {
      refreshCurrentView();
      refreshTasksIfActive();
    });
  });
}

// Makes the phone's back button close an open sheet or return to the
// previous tab instead of leaving the PWA — see nav-history.js.
function wirePopstate() {
  window.addEventListener('popstate', (e) => {
    const sheetRoot = document.getElementById('sheet-root');
    if (sheetRoot.innerHTML.trim() !== '') {
      sheetRoot.innerHTML = '';
      syncSheetFlag(false);
      return;
    }
    syncSheetFlag(false);
    const st = e.state;
    if (st && st.type === 'view' && st.view) {
      switchView(st.view, false);
    }
  });
}

function onRealtimeChange() {
  refreshCurrentView();
  refreshTasksIfActive();
}

async function init() {
  wireLoginForm();
  wireNav();
  wireVillaSwitchClicks();
  wireFab();
  wireLogout();
  wireEntryClickDelegation();
  wirePopstate();

  const session = await getSession();
  if (session) {
    await boot();
  }

  onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await boot();
    } else if (event === 'SIGNED_OUT') {
      teardown();
    }
  });
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
