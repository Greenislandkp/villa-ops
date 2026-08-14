import { supabase } from './supabase-client.js';
import { getSession, onAuthStateChange, signOut, wireLoginForm } from './auth.js';
import { loadCurrentTeamMember, loadAccessibleVillas, loadTeamMembers, loadCategories } from './access.js';
import { state, setReferenceData } from './store.js';
import { renderJournal, refreshJournalIfActive } from './journal.js';
import { renderCalendar, refreshCalendarIfActive } from './calendar.js';
import { renderTasks, refreshTasksIfActive } from './tasks.js';
import { renderVillas } from './villas.js';
import { openEntryForm } from './entry-form.js';
import { openEntryDetail } from './entry-detail.js';
import { subscribeEntries, unsubscribeEntries } from './realtime.js';
import { escapeHtml, showToast } from './utils.js';

const VIEW_TITLES = {
  journal: 'Journal',
  calendar: 'Calendrier',
  tasks: 'Tâches en cours',
  villas: 'Villas',
};

let booted = false;

async function boot() {
  if (booted) return;
  booted = true;

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-root').classList.remove('hidden');

  let refData;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const [currentTeamMember, villas, categories, teamMembers] = await Promise.all([
      loadCurrentTeamMember(user.id),
      loadAccessibleVillas(),
      loadCategories(),
      loadTeamMembers(),
    ]);
    refData = { currentTeamMember, villas, categories, teamMembers };
  } catch (err) {
    showToast(err.message || 'Erreur au chargement des données.');
    refData = { currentTeamMember: null, villas: [], categories: [], teamMembers: [] };
  }

  setReferenceData(refData);

  if (!state.currentTeamMember) {
    renderNoProfileState();
    wireLogout();
    return;
  }

  renderVillaSwitch();
  renderLegend();
  wireNav();
  wireVillaSwitchClicks();
  wireFab();
  wireLogout();
  wireEntryClickDelegation();

  await switchView('journal');
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

function renderNoProfileState() {
  document.getElementById('villa-switch').innerHTML = '';
  document.getElementById('legend').innerHTML = '';
  document.getElementById('header-title').textContent = 'Villa Ops';
  document.getElementById('header-eyebrow').textContent = 'Profil incomplet';
  document.querySelector('.views-wrap').innerHTML = `
    <div class="view">
      <div class="empty-state" style="padding-top:60px;">
        <b>Profil pas encore configuré</b>
        Ton compte existe mais aucun profil Villa Ops n'y est encore associé.
        Contacte l'administrateur pour finaliser ton accès.
      </div>
    </div>`;
  document.getElementById('fab-add').classList.add('hidden');
  document.querySelector('nav.bottomnav').classList.add('hidden');
}

function renderVillaSwitch() {
  const box = document.getElementById('villa-switch');
  const chips = [`<button type="button" class="villa-chip${state.selectedVillaId === 'all' ? ' active' : ''}" data-villa="all">Toutes les villas</button>`];
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
    eyebrow.textContent = 'Toutes les villas';
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

async function switchView(view) {
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
  else if (view === 'villas') await renderVillas();
}

function refreshCurrentView() {
  switch (state.currentView) {
    case 'journal': return refreshJournalIfActive();
    case 'calendar': return refreshCalendarIfActive();
    case 'tasks': return refreshTasksIfActive();
    case 'villas': return renderVillas();
    default: return undefined;
  }
}

function wireFab() {
  document.getElementById('fab-add').addEventListener('click', () => {
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
    openEntryDetail(el.dataset.entryId, () => {
      refreshCurrentView();
      refreshTasksIfActive();
    });
  });
}

function onRealtimeChange() {
  refreshCurrentView();
  refreshTasksIfActive();
}

async function init() {
  wireLoginForm();

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
