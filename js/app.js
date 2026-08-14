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

  const { data: { user } } = await supabase.auth.getUser();

  // Chaque requête est isolée : l'échec d'une table (ex. villas si les
  // policies RLS bloquent) ne doit pas être confondu avec "profil absent".
  const [teamMemberResult, villasResult, categoriesResult, teamMembersResult] = await Promise.allSettled([
    loadCurrentTeamMember(user.id),
    loadAccessibleVillas(),
    loadCategories(),
    loadTeamMembers(),
  ]);

  const errors = [];
  if (teamMemberResult.status === 'rejected') errors.push(`team_members : ${teamMemberResult.reason.message || teamMemberResult.reason}`);
  if (villasResult.status === 'rejected') errors.push(`villas : ${villasResult.reason.message || villasResult.reason}`);
  if (categoriesResult.status === 'rejected') errors.push(`categories : ${categoriesResult.reason.message || categoriesResult.reason}`);
  if (teamMembersResult.status === 'rejected') errors.push(`team_members (liste) : ${teamMembersResult.reason.message || teamMembersResult.reason}`);

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

function renderBootError(errors) {
  document.getElementById('villa-switch').innerHTML = '';
  document.getElementById('legend').innerHTML = '';
  document.getElementById('header-title').textContent = 'Villa Ops';
  document.getElementById('header-eyebrow').textContent = 'Erreur de chargement';
  document.querySelector('.views-wrap').innerHTML = `
    <div class="view">
      <div class="empty-state" style="padding-top:40px; text-align:left;">
        <b style="text-align:center; display:block;">Erreur au chargement des données</b>
        <p style="margin:14px 0 6px;">Le détail technique ci-dessous aide à diagnostiquer le souci (policy RLS, table, etc.) :</p>
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
  wireNav();
  wireVillaSwitchClicks();
  wireFab();
  wireLogout();
  wireEntryClickDelegation();

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
