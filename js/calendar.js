import { fetchEntriesForMonth, fetchReservationEntriesNear, fetchReservationsForEntries } from './data.js';
import { state, getReservationCategory, getCategoryByLabel } from './store.js';
import { escapeHtml, formatMonthLabel, isoDate, formatDateLong, hexOrFallback } from './utils.js';

const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-indexed
let selectedDate = isoDate(today);
let monthEntries = []; // non-reservation entries, single-day
let staySpans = []; // reservation stays: { entry, reservation, arrival, departure }
let wired = false;
let calMode = 'full'; // 'full' (everything) or 'resa' (reservations only, colored by villa)
let calVillaIds = null; // Set of villa ids narrowed within "All villas"; null = not narrowed yet

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
  document.querySelectorAll('#cal-toggle .cal-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === calMode) return;
      calMode = btn.dataset.mode;
      document.querySelectorAll('#cal-toggle .cal-toggle-btn').forEach((b) => b.classList.toggle('active', b === btn));
      renderGrid();
      renderDayDetail();
    });
  });
  document.getElementById('cal-villa-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-villa-id]');
    if (!btn) return;
    const id = btn.dataset.villaId;
    if (calVillaIds.has(id)) {
      if (calVillaIds.size === 1) return; // always keep at least one villa selected
      calVillaIds.delete(id);
    } else {
      calVillaIds.add(id);
    }
    loadAndRender();
  });
}

// When the global villa-switch picks a single villa, the calendar just
// follows it. Only in "All villas" does the calendar's own multi-select
// (chip row) come into play, defaulting to every accessible villa.
function effectiveVillaIds() {
  if (state.selectedVillaId !== 'all') return [state.selectedVillaId];
  if (!calVillaIds) calVillaIds = new Set(state.villas.map((v) => v.id));
  return [...calVillaIds];
}

function renderVillaFilterChips() {
  const box = document.getElementById('cal-villa-filter');
  if (!box) return;
  if (state.selectedVillaId !== 'all' || state.villas.length < 2) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML = state.villas
    .map((v) => {
      const active = calVillaIds && calVillaIds.has(v.id);
      const color = hexOrFallback(v.color, '#8B9A93');
      return `<button type="button" class="cal-villa-chip${active ? ' active' : ''}" data-villa-id="${v.id}" style="${active ? `background:${color};border-color:${color};` : ''}">${escapeHtml(v.name)}</button>`;
    })
    .join('');
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

// dateIso -> array of active stay spans that day
function spansByDate(startIso, endIso) {
  const map = new Map();
  staySpans.forEach((span) => {
    const from = span.arrival < startIso ? startIso : span.arrival;
    const to = span.departure > endIso ? endIso : span.departure;
    for (let d = new Date(from + 'T00:00:00'); isoDate(d) <= to; d.setDate(d.getDate() + 1)) {
      const dIso = isoDate(d);
      if (!map.has(dIso)) map.set(dIso, []);
      map.get(dIso).push(span);
    }
  });
  return map;
}

async function loadStaySpans(monthStart, monthEnd) {
  const reservationCat = getReservationCategory();
  if (!reservationCat) return [];
  const resEntries = await fetchReservationEntriesNear({
    villaIds: effectiveVillaIds(),
    categoryId: reservationCat.id,
    rangeStart: monthStart,
    rangeEnd: monthEnd,
  });
  if (!resEntries.length) return [];
  const resMap = await fetchReservationsForEntries(resEntries.map((e) => e.id));
  const spans = [];
  resEntries.forEach((entry) => {
    const reservation = resMap.get(entry.id) || null;
    const departure = (reservation && reservation.check_out_date) || entry.event_date;
    if (departure < monthStart) return; // stay entirely before the visible month
    spans.push({ entry, reservation, arrival: entry.event_date, departure });
  });
  assignLanes(spans);
  return spans;
}

// Gives every stay a fixed "lane" (like a Gantt chart track) for its whole
// duration, so the same reservation never jumps to a different row just
// because some other stay started or ended nearby. Greedy interval
// scheduling: sort by arrival, drop each span into the first lane whose
// last-used stay has already ended by this one's arrival.
function assignLanes(spans) {
  spans.sort((a, b) => (a.arrival < b.arrival ? -1 : a.arrival > b.arrival ? 1 : a.departure < b.departure ? -1 : 1));
  const laneEndDates = [];
  spans.forEach((span) => {
    let lane = laneEndDates.findIndex((endDate) => endDate < span.arrival);
    if (lane === -1) {
      lane = laneEndDates.length;
      laneEndDates.push(span.departure);
    } else {
      laneEndDates[lane] = span.departure;
    }
    span.lane = lane;
  });
}

// Resolve the Check-in / Reservation / Checkout category colors once, with
// sane fallbacks in case one of the auto-provisioned categories is missing.
function stayColors() {
  const reservationCat = getReservationCategory();
  const checkinCat = getCategoryByLabel('Check-in');
  const checkoutCat = getCategoryByLabel('Checkout');
  return {
    stay: hexOrFallback(reservationCat && reservationCat.color, '#3E7C59'),
    checkin: hexOrFallback(checkinCat && checkinCat.color, '#3AA6A0'),
    checkout: hexOrFallback(checkoutCat && checkoutCat.color, '#8B5FBF'),
  };
}

// One continuous bar per stay, spanning arrival -> departure within a
// week row. The reservation green never breaks: on the check-in day the
// guest only holds the room half the day, so that day is half teal/half
// green (green touching the next day's bar); check-out mirrors that
// with half green/half purple. Middle "staying" days are plain green,
// square-edged so they connect seamlessly to their neighbours.
function spanSegmentStyle(span, dateIso, colors) {
  const isStart = dateIso === span.arrival;
  const isEnd = dateIso === span.departure;
  if (isStart && isEnd) {
    return { background: `linear-gradient(90deg, ${colors.checkin} 50%, ${colors.checkout} 50%)`, radius: '1px' };
  }
  if (isStart) {
    return { background: `linear-gradient(90deg, ${colors.checkin} 50%, ${colors.stay} 50%)`, radius: '1px 0 0 1px' };
  }
  if (isEnd) {
    return { background: `linear-gradient(90deg, ${colors.stay} 50%, ${colors.checkout} 50%)`, radius: '0 1px 1px 0' };
  }
  return { background: colors.stay, radius: '0' };
}

// Reservations-mode bars: solid villa color for the whole stay (no
// check-in/check-out color split — the villa color is what matters here),
// thicker than the full-view bars since it's the only marker shown per day.
function villaSpanSegmentStyle(span, dateIso) {
  const villa = state.villasById.get(span.entry.villa_id);
  const color = hexOrFallback(villa && villa.color, '#8B9A93');
  const isStart = dateIso === span.arrival;
  const isEnd = dateIso === span.departure;
  let radius = '0';
  if (isStart && isEnd) radius = '2px';
  else if (isStart) radius = '2px 0 0 2px';
  else if (isEnd) radius = '0 2px 2px 0';
  return { background: color, radius };
}

function renderResaLegend() {
  const box = document.getElementById('cal-legend-resa');
  if (!box) return;
  box.classList.toggle('active', calMode === 'resa');
  if (calMode !== 'resa') { box.innerHTML = ''; return; }
  const shownIds = new Set(effectiveVillaIds());
  box.innerHTML = state.villas
    .filter((v) => shownIds.has(v.id))
    .map((v) => `<div class="legend-item"><span class="dot" style="background:${hexOrFallback(v.color, '#8B9A93')}"></span>${escapeHtml(v.name)}</div>`)
    .join('');
}

function renderGrid() {
  const grid = document.getElementById('cal-grid');
  document.getElementById('cal-month-label').textContent = formatMonthLabel(viewYear, viewMonth);
  renderResaLegend();
  renderVillaFilterChips();

  const { startIso, endIso } = monthBounds(viewYear, viewMonth);
  const byDate = entriesByDate();
  const bySpanDate = spansByDate(startIso, endIso);
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  // Monday = 0 ... Sunday = 6
  const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  const dowLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  dowLabels.forEach((d) => cells.push(`<div class="cal-dow">${d}</div>`));

  for (let i = leadingBlank; i > 0; i--) {
    cells.push(`<div class="cal-day muted">${prevMonthDays - i + 1}</div>`);
  }

  const todayIsoStr = isoDate(new Date());
  const colors = stayColors();
  // Lanes are assigned globally (so a stay never changes row once picked),
  // but a lane only costs vertical space on days that actually need it —
  // compact to the lanes truly used within *this visible month* so an
  // overlap elsewhere in the loaded range (lookback window for spans that
  // started earlier) doesn't pad every day's height with empty rows.
  const usedLanes = new Set();
  bySpanDate.forEach((list) => list.forEach((s) => usedLanes.add(s.lane)));
  const sortedLanes = [...usedLanes].sort((a, b) => a - b).slice(0, 5);
  const laneCompact = new Map(sortedLanes.map((lane, i) => [lane, i]));
  const maxLanes = sortedLanes.length;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateIso = isoDate(new Date(viewYear, viewMonth, day));
    const dayEntries = byDate.get(dateIso) || [];
    const daySpansActive = bySpanDate.get(dateIso) || [];
    const laneMap = new Map();
    daySpansActive.forEach((s) => {
      if (laneCompact.has(s.lane)) laneMap.set(laneCompact.get(s.lane), s);
    });
    const laneSlots = [];
    for (let lane = 0; lane < maxLanes; lane++) laneSlots.push(laneMap.get(lane) || null);

    let dayBarsHtml = '';
    if (calMode === 'resa') {
      // Reservations only: one thicker, villa-colored bar per active stay,
      // nothing else on the day cell.
      const spanBarsHtml = laneSlots
        .map((span) => {
          if (!span) return '<div class="span-bar wide" style="visibility:hidden;"></div>';
          const seg = villaSpanSegmentStyle(span, dateIso);
          return `<div class="span-bar wide" style="background:${seg.background}; border-radius:${seg.radius};"></div>`;
        })
        .join('');
      dayBarsHtml = spanBarsHtml ? `<div class="day-bars resa">${spanBarsHtml}</div>` : '';
    } else {
      const spanBarsHtml = laneSlots
        .map((span) => {
          if (!span) return '<div class="span-bar" style="visibility:hidden;"></div>';
          const seg = spanSegmentStyle(span, dateIso, colors);
          return `<div class="span-bar" style="background:${seg.background}; border-radius:${seg.radius};"></div>`;
        })
        .join('');

      const entryColors = [...new Set(dayEntries.map((e) => hexOrFallback(state.categoriesById.get(e.category_id)?.color)))].slice(0, 4);
      const entryBarsHtml = entryColors.length
        ? `<div class="bars">${entryColors.map((c) => `<div class="bar" style="background:${c}"></div>`).join('')}</div>`
        : '';

      dayBarsHtml = spanBarsHtml || entryBarsHtml ? `<div class="day-bars">${spanBarsHtml}${entryBarsHtml}</div>` : '';
    }

    const classes = ['cal-day', 'clickable'];
    if (dateIso === todayIsoStr) classes.push('today');
    if (dateIso === selectedDate) classes.push('selected');
    cells.push(`<div class="${classes.join(' ')}" data-date="${dateIso}"><span class="cal-day-num">${day}</span>${dayBarsHtml}</div>`);
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

function stayLabel(span, dateIso) {
  const name = (span.reservation && span.reservation.guest_name) || span.entry.title;
  if (dateIso === span.arrival) return { verb: 'Check-in', time: (span.entry.check_in_time || '').slice(0, 5) };
  if (dateIso === span.departure) return { verb: 'Check-out', time: (span.entry.check_out_time || '').slice(0, 5) };
  return { verb: 'Staying', time: '' };
}

function renderDayDetail() {
  const box = document.getElementById('cal-day-detail');
  const { startIso, endIso } = monthBounds(viewYear, viewMonth);
  const byDate = entriesByDate();
  const bySpanDate = spansByDate(startIso, endIso);

  // Reservations mode only ever shows stay slots — other entry types
  // (cleaning, maintenance, notes...) stay out of this view entirely.
  const dayEntries = calMode === 'resa' ? [] : (byDate.get(selectedDate) || []).slice();
  const daySpans = (bySpanDate.get(selectedDate) || []).slice();

  const isToday = selectedDate === isoDate(new Date());
  const heading = isToday ? 'Today' : formatDateLong(selectedDate);

  if (!dayEntries.length && !daySpans.length) {
    const emptyMsg = calMode === 'resa' ? 'No reservation that day.' : 'Nothing planned that day.';
    box.innerHTML = `<h3>${escapeHtml(heading)}</h3><div class="empty-state" style="padding:20px 4px;">${emptyMsg}</div>`;
    return;
  }

  const spanSlots = daySpans.map((span) => {
    const villa = state.villasById.get(span.entry.villa_id);
    const { verb, time } = stayLabel(span, selectedDate);
    const name = (span.reservation && span.reservation.guest_name) || span.entry.title;
    const context = [villa ? villa.name : null, verb].filter(Boolean).join(' · ');
    return `<div class="slot" data-entry-id="${span.entry.id}" style="cursor:pointer;">
      <span class="slot-time">${escapeHtml(time || '—')}</span>
      <div class="slot-text"><b>${escapeHtml(name)}</b><span>${escapeHtml(context)}</span></div>
    </div>`;
  });

  const entrySlots = dayEntries
    .slice()
    .sort((a, b) => (a.check_in_time || a.check_out_time || '99:99').localeCompare(b.check_in_time || b.check_out_time || '99:99'))
    .map((e) => {
      const cat = state.categoriesById.get(e.category_id);
      const villa = state.villasById.get(e.villa_id);
      const time = (e.check_in_time || e.check_out_time || '').slice(0, 5) || '—';
      const context = [villa ? villa.name : null, cat ? cat.label : null].filter(Boolean).join(' · ');
      return `<div class="slot" data-entry-id="${e.id}" style="cursor:pointer;">
        <span class="slot-time">${escapeHtml(time)}</span>
        <div class="slot-text"><b>${escapeHtml(e.title)}</b><span>${escapeHtml(context)}</span></div>
      </div>`;
    });

  box.innerHTML = `<h3>${escapeHtml(heading)}</h3>${spanSlots.join('')}${entrySlots.join('')}`;
}

async function loadAndRender() {
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '<div class="loading-row">Loading…</div>';
  try {
    const { startIso, endIso } = monthBounds(viewYear, viewMonth);
    // Reservation stays are already fully represented via the day-span
    // logic below (check-in/staying/check-out) — excluding all three
    // related categories from the regular per-day bucket avoids showing
    // the same stay twice on its check-in/check-out day.
    const excludeCategoryIds = [getReservationCategory(), getCategoryByLabel('Check-in'), getCategoryByLabel('Checkout')]
      .filter(Boolean)
      .map((c) => c.id);
    const [entries, spans] = await Promise.all([
      fetchEntriesForMonth({ villaIds: effectiveVillaIds(), startIso, endIso, excludeCategoryIds }),
      loadStaySpans(startIso, endIso),
    ]);
    monthEntries = entries;
    staySpans = spans;
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><b>Loading error</b>${escapeHtml(err.message || '')}</div>`;
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
