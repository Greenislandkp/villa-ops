import { fetchEntriesForMonth } from './data.js';
import { state } from './store.js';
import { escapeHtml, formatMonthLabel, isoDate, formatDateLong, hexOrFallback } from './utils.js';

const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexed
let selectedDate = isoDate(today);
let monthEntries = [];
let wired = false;

function wireNav() {
  if (wired) return;
  wired = true;
  document.getElementById('cal-prev').addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    loadAndRender();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    loadAndRender();
  });
}

function monthBounds(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { startIso: isoDate(start), endIso: isoDate(end) };
}

function entriesByDate() {
  const map = new Map();
  monthEntries.forEach((e) => {
    if (!map.has(e.event_date)) map.set(e.event_date, []);
    map.get(e.event_date).push(e);
  });
  return map;
}

function renderGrid() {
  const grid = document.getElementById('cal-grid');
  document.getElementById('cal-month-label').textContent = formatMonthLabel(viewYear, viewMonth);

  const byDate = entriesByDate();
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  // Lundi = 0 ... Dimanche = 6
  const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  const dowLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  dowLabels.forEach((d) => cells.push(`<div class="cal-dow">${d}</div>`));

  for (let i = leadingBlank; i > 0; i--) {
    cells.push(`<div class="cal-day muted">${prevMonthDays - i + 1}</div>`);
  }

  const todayIsoStr = isoDate(new Date());
  for (let day = 1; day <= daysInMonth; day++) {
    const dateIso = isoDate(new Date(viewYear, viewMonth, day));
    const dayEntries = byDate.get(dateIso) || [];
    const colors = [...new Set(dayEntries.map((e) => hexOrFallback(state.categoriesById.get(e.category_id)?.color)))].slice(0, 4);
    const barsHtml = colors.length
      ? `<div class="bars">${colors.map((c) => `<div class="bar" style="background:${c}"></div>`).join('')}</div>`
      : '';
    const classes = ['cal-day', 'clickable'];
    if (dateIso === todayIsoStr) classes.push('today');
    if (dateIso === selectedDate) classes.push('selected');
    cells.push(`<div class="${classes.join(' ')}" data-date="${dateIso}">${day}${barsHtml}</div>`);
  }

  const totalCells = leadingBlank + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    cells.push(`<div class="cal-day muted">${day}</div>`);
  }

  grid.innerHTML = cells.join('');
  grid.querySelectorAll('.cal-day.clickable').forEach((cell) => {
    cell.addEventListener('click', () => {
      selectedDate = cell.dataset.date;
      renderGrid();
      renderDayDetail();
    });
  });
}

function renderDayDetail() {
  const box = document.getElementById('cal-day-detail');
  const byDate = entriesByDate();
  const dayEntries = (byDate.get(selectedDate) || []).slice().sort((a, b) => {
    const ta = a.check_in_time || a.check_out_time || '99:99';
    const tb = b.check_in_time || b.check_out_time || '99:99';
    return ta.localeCompare(tb);
  });

  const isToday = selectedDate === isoDate(new Date());
  const heading = isToday ? "Aujourd'hui" : formatDateLong(selectedDate);

  if (!dayEntries.length) {
    box.innerHTML = `<h3>${escapeHtml(heading)}</h3><div class="empty-state" style="padding:20px 4px;">Rien de prévu ce jour-là.</div>`;
    return;
  }

  const slots = dayEntries.map((e) => {
    const cat = state.categoriesById.get(e.category_id);
    const villa = state.villasById.get(e.villa_id);
    const time = (e.check_in_time || e.check_out_time || '').slice(0, 5) || '—';
    const context = [villa ? villa.name : null, cat ? cat.label : null].filter(Boolean).join(' · ');
    return `<div class="slot" data-entry-id="${e.id}" style="cursor:pointer;">
      <span class="slot-time">${escapeHtml(time)}</span>
      <div class="slot-text"><b>${escapeHtml(e.title)}</b><span>${escapeHtml(context)}</span></div>
    </div>`;
  });

  box.innerHTML = `<h3>${escapeHtml(heading)}</h3>${slots.join('')}`;
}

async function loadAndRender() {
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '<div class="loading-row">Chargement…</div>';
  try {
    const { startIso, endIso } = monthBounds(viewYear, viewMonth);
    monthEntries = await fetchEntriesForMonth({ villaId: state.selectedVillaId, startIso, endIso });
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><b>Erreur de chargement</b>${escapeHtml(err.message || '')}</div>`;
    return;
  }
  renderGrid();
  renderDayDetail();
}

export async function renderCalendar() {
  wireNav();
  await loadAndRender();
}

export function refreshCalendarIfActive() {
  if (state.currentView === 'calendar') loadAndRender();
}
