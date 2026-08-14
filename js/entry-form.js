import { state, addCategory } from './store.js';
import {
  createCategory,
  createEntry,
  createReservation,
  updateEntry,
  saveReservationForEntry,
  deleteReservationForEntry,
  fetchLinkedTaskByCategory,
  deleteLinkedTasks,
  uploadEntryPhoto,
  updateEntryPhoto,
  deleteEntry,
} from './data.js';
import { supabase, ENTRY_PHOTOS_BUCKET } from './supabase-client.js';
import { escapeHtml, todayIso, isReservationCategory, isCleaningCategory, normalizeLabel, showToast, getSignedPhotoUrl, memberInitials } from './utils.js';

const CATEGORY_COLORS = ['#3E7C59', '#D98E04', '#B5502A', '#8B9A93', '#C99A3D', '#5B7FA6', '#8B5FBF'];
const CHECKIN_CATEGORY = { label: 'Check-in', color: '#3AA6A0' };
const CHECKOUT_CATEGORY = { label: 'Checkout', color: '#8B5FBF' };

let selectedVillaId = null;
let selectedCategoryId = null;
let selectedStatus = 'a_faire';
let newCategoryColor = CATEGORY_COLORS[0];
let photoFile = null;
let editingEntry = null;
let editingReservation = null;

function closeSheet() {
  document.getElementById('sheet-root').innerHTML = '';
  photoFile = null;
  editingEntry = null;
  editingReservation = null;
}

// Pass `entry` (+ its `reservation` row, if any) to edit an existing entry
// instead of creating a new one.
export function openEntryForm(onDone, entry = null, reservation = null) {
  if (!state.currentTeamMember) {
    showToast("Your Villa Ops profile isn't set up yet. Contact the administrator.");
    return;
  }
  if (!state.villas.length) {
    showToast('No accessible villa to create an entry for.');
    return;
  }

  editingEntry = entry;
  editingReservation = reservation;
  photoFile = null;

  if (entry) {
    selectedVillaId = entry.villa_id;
    selectedCategoryId = entry.category_id;
    selectedStatus = entry.status || 'a_faire';
  } else {
    selectedVillaId = state.selectedVillaId !== 'all' ? state.selectedVillaId : state.villas[0].id;
    selectedCategoryId = state.categories[0] ? state.categories[0].id : null;
    selectedStatus = 'a_faire';
  }

  renderSheet();
  wireSheet(onDone);

  if (entry && entry.photo_url) {
    getSignedPhotoUrl(supabase, ENTRY_PHOTOS_BUCKET, entry.photo_url).then((url) => {
      if (!url) return;
      const preview = document.getElementById('photo-preview');
      const label = document.getElementById('photo-label');
      if (!preview || !label) return;
      preview.src = url;
      preview.classList.add('show');
      label.textContent = '📷 Current photo (tap to replace)';
    });
  }
}

function villaChipsHtml() {
  return state.villas
    .map((v) => `<button type="button" class="chip-option${v.id === selectedVillaId ? ' active' : ''}" data-villa="${v.id}">${escapeHtml(v.name)}</button>`)
    .join('');
}

function categoryChipsHtml() {
  return state.categories
    .map((c) => `<button type="button" class="chip-option${c.id === selectedCategoryId ? ' active' : ''}" data-cat="${c.id}" style="${c.id === selectedCategoryId ? `background:${c.color};color:#16231F;border-color:${c.color}` : ''}">${escapeHtml(c.label)}</button>`)
    .join('');
}

function assigneeOptionsHtml(selectedId) {
  const opts = state.teamMembers
    .map((m) => `<option value="${m.id}"${m.id === selectedId ? ' selected' : ''}>${escapeHtml(memberInitials(m))}</option>`)
    .join('');
  return `<option value=""${selectedId ? '' : ' selected'}>No one in particular</option>${opts}`;
}

function platformOptionsHtml(selected) {
  return ['Airbnb', 'Booking', 'Direct', 'Other']
    .map((p) => `<option value="${p}"${p === selected ? ' selected' : ''}>${p}</option>`)
    .join('');
}

function colorSwatchesHtml() {
  return CATEGORY_COLORS.map((c) => `<button type="button" class="color-swatch${c === newCategoryColor ? ' active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');
}

function renderSheet() {
  const cat = state.categoriesById.get(selectedCategoryId);
  const isReservation = isReservationCategory(cat);
  const isCleaning = isCleaningCategory(cat);
  const isStandard = !isReservation && !isCleaning;
  const isEdit = !!editingEntry;

  const defaultTitle = editingEntry && isStandard ? editingEntry.title : '';
  const defaultDesc = editingEntry && isStandard ? (editingEntry.description || '') : '';
  const defaultDate = (editingEntry && editingEntry.event_date) || todayIso();
  const defaultCleanTime = (editingEntry && editingEntry.check_in_time) ? editingEntry.check_in_time.slice(0, 5) : '';
  const defaultGuest = editingReservation ? editingReservation.guest_name || '' : '';
  const defaultGuestCount = editingReservation && editingReservation.guest_count ? editingReservation.guest_count : '';
  const defaultArrival = (editingEntry && editingEntry.event_date) || todayIso();
  const defaultDeparture = editingReservation ? editingReservation.check_out_date || '' : '';
  const defaultCheckin = (editingEntry && editingEntry.check_in_time) ? editingEntry.check_in_time.slice(0, 5) : '';
  const defaultCheckout = (editingEntry && editingEntry.check_out_time) ? editingEntry.check_out_time.slice(0, 5) : '';
  const defaultAmount = editingReservation && editingReservation.amount ? editingReservation.amount : '';
  const defaultCurrency = editingReservation ? editingReservation.currency || '' : '';

  const html = `
  <div class="sheet-overlay" id="entry-overlay">
    <div class="sheet">
      <button type="button" class="sheet-close" id="entry-close">✕</button>
      <div class="sheet-handle"></div>
      <p class="sheet-title">${isEdit ? 'Edit entry' : 'New entry'}</p>
      <form id="entry-form" class="form-grid">
        <div class="field">
          <label>Villa</label>
          <div class="chip-select" id="villa-chips">${villaChipsHtml()}</div>
        </div>

        <div class="field">
          <label>Category</label>
          <div class="chip-select" id="cat-chips">${categoryChipsHtml()}</div>
          <button type="button" class="new-cat-toggle" id="new-cat-toggle">+ New category</button>
          <div class="new-cat-form hidden" id="new-cat-form">
            <input type="text" id="new-cat-label" placeholder="Category name" maxlength="40">
            <div class="color-swatches" id="new-cat-colors">${colorSwatchesHtml()}</div>
            <button type="button" class="btn-secondary" id="new-cat-save" style="padding:10px 14px; white-space:nowrap;">Create</button>
          </div>
        </div>

        <div class="field${isStandard ? '' : ' hidden'}" id="title-field">
          <label for="entry-title">Title</label>
          <input type="text" id="entry-title" maxlength="140" placeholder="e.g. AC leak in bedroom 2" value="${escapeHtml(defaultTitle)}">
        </div>

        <div class="field${isStandard ? '' : ' hidden'}" id="desc-field">
          <label for="entry-desc">Description (optional)</label>
          <textarea id="entry-desc" class="field-textarea" placeholder="More details…">${escapeHtml(defaultDesc)}</textarea>
        </div>

        <div class="form-row-2">
          <div class="field${isReservation ? ' hidden' : ''}" id="date-field">
            <label for="entry-date">Date</label>
            <input type="date" id="entry-date" value="${defaultDate}">
          </div>
          <div class="field${isCleaning ? '' : ' hidden'}" id="clean-time-field">
            <label for="clean-time">Time (optional)</label>
            <input type="time" id="clean-time" value="${defaultCleanTime}">
          </div>
          <div class="field">
            <label for="entry-assignee">Assigned to</label>
            <select id="entry-assignee" class="field-select">${assigneeOptionsHtml(editingEntry ? editingEntry.assigned_to_id : null)}</select>
          </div>
        </div>

        <div class="field${isReservation ? ' hidden' : ''}" id="status-field">
          <label>Status</label>
          <div class="chip-select" id="status-chips">
            <button type="button" class="status-option a_faire${selectedStatus === 'a_faire' ? ' active a_faire' : ''}" data-status="a_faire">To do</button>
            <button type="button" class="status-option en_cours${selectedStatus === 'en_cours' ? ' active en_cours' : ''}" data-status="en_cours">In progress</button>
            <button type="button" class="status-option fait${selectedStatus === 'fait' ? ' active fait' : ''}" data-status="fait">Done</button>
          </div>
        </div>

        <div class="field${isReservation ? ' hidden' : ''}" id="photo-field">
          <label>Photo (optional)</label>
          <label class="photo-input-btn" for="entry-photo" id="photo-label">📷 Add a photo</label>
          <input type="file" id="entry-photo" accept="image/*" capture="environment" class="hidden">
          <img id="photo-preview" class="photo-preview" alt="Photo preview">
        </div>

        <div class="reservation-fields${isReservation ? ' show' : ''}" id="reservation-fields">
          <p class="reservation-fields-title">Reservation details</p>
          <div class="field">
            <label for="res-guest">Guest name</label>
            <input type="text" id="res-guest" maxlength="100" value="${escapeHtml(defaultGuest)}">
          </div>
          <div class="form-row-2">
            <div class="field">
              <label for="res-count">Guests</label>
              <input type="number" id="res-count" min="1" max="40" value="${defaultGuestCount}">
            </div>
            <div class="field">
              <label for="res-platform">Platform</label>
              <select id="res-platform" class="field-select">${platformOptionsHtml(editingReservation ? editingReservation.platform : 'Airbnb')}</select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="field">
              <label for="res-arrival">Arrival date</label>
              <input type="date" id="res-arrival" value="${defaultArrival}">
            </div>
            <div class="field">
              <label for="res-departure">Departure date</label>
              <input type="date" id="res-departure" min="${defaultArrival}" value="${defaultDeparture}">
            </div>
          </div>
          <div class="form-row-2">
            <div class="field">
              <label for="res-checkin">Check-in time</label>
              <input type="time" id="res-checkin" value="${defaultCheckin}">
            </div>
            <div class="field">
              <label for="res-checkout">Check-out time</label>
              <input type="time" id="res-checkout" value="${defaultCheckout}">
            </div>
          </div>
          <div class="form-row-2">
            <div class="field">
              <label for="res-amount">Amount</label>
              <input type="number" id="res-amount" min="0" step="0.01" value="${defaultAmount}">
            </div>
            <div class="field">
              <label for="res-currency">Currency</label>
              <input type="text" id="res-currency" maxlength="8" placeholder="THB" value="${escapeHtml(defaultCurrency)}">
            </div>
          </div>
        </div>

        <div class="form-error" id="entry-form-error"></div>

        <div class="sheet-actions">
          <button type="button" class="btn-secondary" id="entry-cancel">Cancel</button>
          <button type="submit" class="btn-primary" id="entry-submit">${isEdit ? 'Save changes' : 'Add'}</button>
        </div>
      </form>
    </div>
  </div>`;

  document.getElementById('sheet-root').innerHTML = html;
}

function wireSheet(onDone) {
  const overlay = document.getElementById('entry-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSheet(); });
  document.getElementById('entry-close').addEventListener('click', closeSheet);
  document.getElementById('entry-cancel').addEventListener('click', closeSheet);

  document.getElementById('villa-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-villa]');
    if (!btn) return;
    selectedVillaId = btn.dataset.villa;
    renderVillaChipsActive();
  });

  document.getElementById('cat-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    selectedCategoryId = btn.dataset.cat;
    refreshCategoryUI();
  });

  document.getElementById('status-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    selectedStatus = btn.dataset.status;
    document.querySelectorAll('#status-chips .status-option').forEach((b) => {
      b.classList.toggle('active', b.dataset.status === selectedStatus);
    });
  });

  document.getElementById('new-cat-toggle').addEventListener('click', () => {
    document.getElementById('new-cat-form').classList.toggle('hidden');
  });

  document.getElementById('new-cat-colors').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;
    newCategoryColor = btn.dataset.color;
    document.querySelectorAll('#new-cat-colors .color-swatch').forEach((b) => b.classList.toggle('active', b.dataset.color === newCategoryColor));
  });

  document.getElementById('new-cat-save').addEventListener('click', async () => {
    const input = document.getElementById('new-cat-label');
    const label = input.value.trim();
    if (!label) { input.focus(); return; }
    try {
      const cat = await createCategory({ label, color: newCategoryColor });
      addCategory(cat);
      selectedCategoryId = cat.id;
      document.getElementById('cat-chips').innerHTML = categoryChipsHtml();
      document.getElementById('new-cat-form').classList.add('hidden');
      input.value = '';
      refreshCategoryUI();
    } catch (err) {
      showToast(err.message || 'Could not create the category.');
    }
  });

  document.getElementById('entry-photo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    photoFile = file;
    const preview = document.getElementById('photo-preview');
    preview.src = URL.createObjectURL(file);
    preview.classList.add('show');
    document.getElementById('photo-label').textContent = `📷 ${file.name}`;
  });

  document.getElementById('res-arrival').addEventListener('change', (e) => {
    const departure = document.getElementById('res-departure');
    departure.min = e.target.value;
    if (departure.value && departure.value < e.target.value) departure.value = '';
  });

  document.getElementById('entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitEntry(onDone);
  });
}

function renderVillaChipsActive() {
  document.querySelectorAll('#villa-chips .chip-option').forEach((b) => b.classList.toggle('active', b.dataset.villa === selectedVillaId));
}

function refreshCategoryUI() {
  document.querySelectorAll('#cat-chips .chip-option').forEach((b) => {
    const isActive = b.dataset.cat === selectedCategoryId;
    b.classList.toggle('active', isActive);
    const cat = state.categoriesById.get(b.dataset.cat);
    b.style.cssText = isActive && cat ? `background:${cat.color};color:#16231F;border-color:${cat.color}` : '';
  });

  const cat = state.categoriesById.get(selectedCategoryId);
  const isReservation = isReservationCategory(cat);
  const isCleaning = isCleaningCategory(cat);
  const isStandard = !isReservation && !isCleaning;

  document.getElementById('title-field').classList.toggle('hidden', !isStandard);
  document.getElementById('desc-field').classList.toggle('hidden', !isStandard);
  document.getElementById('date-field').classList.toggle('hidden', isReservation);
  document.getElementById('clean-time-field').classList.toggle('hidden', !isCleaning);
  document.getElementById('status-field').classList.toggle('hidden', isReservation);
  document.getElementById('photo-field').classList.toggle('hidden', isReservation);
  document.getElementById('reservation-fields').classList.toggle('show', isReservation);
}

async function getOrCreateCategoryByLabel({ label, color }) {
  const existing = state.categories.find((c) => normalizeLabel(c.label) === normalizeLabel(label));
  if (existing) return existing;
  const cat = await createCategory({ label, color });
  addCategory(cat);
  return cat;
}

// Creates or updates the aux task (Check-in / Checkout) linked to a
// reservation entry via related_entry_id + category, so re-saving the
// same stay never duplicates it.
async function syncAuxTask({ reservationEntry, isEdit, categoryDef, titlePrefix, guestName, eventDate, time, assignedToId }) {
  const payload = {
    villa_id: reservationEntry.villa_id,
    title: `${titlePrefix} — ${guestName}`,
    assigned_to_id: assignedToId,
    event_date: eventDate,
    check_in_time: time || null,
  };
  const cat = await getOrCreateCategoryByLabel(categoryDef);
  const existingTask = isEdit ? await fetchLinkedTaskByCategory(reservationEntry.id, cat.id) : null;
  if (existingTask) {
    await updateEntry(existingTask.id, payload);
  } else {
    await createEntry({
      ...payload,
      category_id: cat.id,
      description: null,
      author_id: state.currentTeamMember.id,
      status: 'a_faire',
      check_out_time: null,
      photo_url: null,
      related_entry_id: reservationEntry.id,
    });
  }
}

async function submitEntry(onDone) {
  const errorBox = document.getElementById('entry-form-error');
  errorBox.classList.remove('show');
  const submitBtn = document.getElementById('entry-submit');
  const isEdit = !!editingEntry;

  const cat = state.categoriesById.get(selectedCategoryId);
  const isReservation = isReservationCategory(cat);
  const isCleaning = isCleaningCategory(cat);
  const isStandard = !isReservation && !isCleaning;

  if (!selectedVillaId || !selectedCategoryId) {
    errorBox.textContent = 'Villa and category are required.';
    errorBox.classList.add('show');
    return;
  }

  let title;
  let eventDate;
  let guestName = '';

  if (isReservation) {
    guestName = document.getElementById('res-guest').value.trim();
    const arrival = document.getElementById('res-arrival').value;
    const departure = document.getElementById('res-departure').value;
    if (!guestName) {
      errorBox.textContent = 'Guest name is required for a reservation.';
      errorBox.classList.add('show');
      return;
    }
    if (!arrival || !departure) {
      errorBox.textContent = 'Arrival and departure dates are required.';
      errorBox.classList.add('show');
      return;
    }
    if (departure < arrival) {
      errorBox.textContent = 'Departure date must be on or after the arrival date.';
      errorBox.classList.add('show');
      return;
    }
    title = `Reservation — ${guestName}`;
    eventDate = arrival;
  } else if (isCleaning) {
    title = `Cleaning`;
    eventDate = document.getElementById('entry-date').value;
    if (!eventDate) {
      errorBox.textContent = 'Date is required.';
      errorBox.classList.add('show');
      return;
    }
  } else {
    title = document.getElementById('entry-title').value.trim();
    eventDate = document.getElementById('entry-date').value;
    if (!title) {
      errorBox.textContent = 'Title is required.';
      errorBox.classList.add('show');
      return;
    }
    if (!eventDate) {
      errorBox.textContent = 'Date is required.';
      errorBox.classList.add('show');
      return;
    }
  }

  submitBtn.disabled = true;
  submitBtn.textContent = isEdit ? 'Saving…' : 'Adding…';

  try {
    const checkInTime = isReservation
      ? document.getElementById('res-checkin').value || null
      : isCleaning
        ? document.getElementById('clean-time').value || null
        : null;
    const checkOutTime = isReservation ? document.getElementById('res-checkout').value || null : null;

    const basePayload = {
      villa_id: selectedVillaId,
      category_id: selectedCategoryId,
      title,
      description: isStandard ? (document.getElementById('entry-desc').value.trim() || null) : null,
      assigned_to_id: document.getElementById('entry-assignee').value || null,
      status: isReservation ? 'fait' : selectedStatus,
      event_date: eventDate,
      check_in_time: checkInTime,
      check_out_time: checkOutTime,
    };

    let entry;
    if (isEdit) {
      entry = await updateEntry(editingEntry.id, basePayload);
    } else {
      entry = await createEntry({ ...basePayload, author_id: state.currentTeamMember.id, photo_url: null });
    }

    if (isReservation) {
      const guestCount = document.getElementById('res-count').value;
      const amount = document.getElementById('res-amount').value;
      const reservationPayload = {
        guest_name: guestName,
        guest_count: guestCount ? Number(guestCount) : null,
        platform: document.getElementById('res-platform').value || null,
        amount: amount ? Number(amount) : null,
        currency: document.getElementById('res-currency').value.trim() || null,
        check_out_date: document.getElementById('res-departure').value,
      };
      try {
        if (isEdit) {
          await saveReservationForEntry(entry.id, reservationPayload);
        } else {
          await createReservation({ entry_id: entry.id, ...reservationPayload });
        }
      } catch (resErr) {
        if (!isEdit) {
          // Roll back the entry so we never leave an orphaned journal row
          // without its reservation details.
          await deleteEntry(entry).catch(() => {});
        }
        throw resErr;
      }
    } else if (isEdit && editingReservation) {
      // Category was switched away from Reservation: drop the now-stale
      // reservation row and its linked Check-in/Checkout tasks.
      await deleteReservationForEntry(entry.id).catch(() => {});
      await deleteLinkedTasks(entry.id).catch(() => {});
    }

    if (photoFile) {
      try {
        const path = await uploadEntryPhoto(selectedVillaId, entry.id, photoFile);
        await updateEntryPhoto(entry.id, path);
      } catch (photoErr) {
        showToast(`Entry ${isEdit ? 'updated' : 'added'}, but the photo upload failed.`);
      }
    }

    // Keep the auto-generated Check-in/Checkout tasks in sync with the
    // stay's dates: created on first save, updated (date/time/title/villa/
    // assignee) on every later edit — never duplicated, since each is
    // found via related_entry_id + its own category rather than guessed
    // by title.
    if (isReservation) {
      const assignedToId = document.getElementById('entry-assignee').value || null;
      try {
        await syncAuxTask({
          reservationEntry: entry,
          isEdit,
          categoryDef: CHECKIN_CATEGORY,
          titlePrefix: 'Reservation Check-in',
          guestName,
          eventDate: document.getElementById('res-arrival').value,
          time: document.getElementById('res-checkin').value,
          assignedToId,
        });
        await syncAuxTask({
          reservationEntry: entry,
          isEdit,
          categoryDef: CHECKOUT_CATEGORY,
          titlePrefix: 'Checkout',
          guestName,
          eventDate: document.getElementById('res-departure').value,
          time: document.getElementById('res-checkout').value,
          assignedToId,
        });
      } catch (taskErr) {
        showToast(`Reservation ${isEdit ? 'updated' : 'added'}, but the check-in/checkout tasks could not be synced.`);
      }
    }

    closeSheet();
    showToast(isEdit ? 'Entry updated.' : 'Entry added.');
    if (onDone) onDone();
  } catch (err) {
    errorBox.textContent = err.message || `Couldn't ${isEdit ? 'save' : 'add'} this entry right now.`;
    errorBox.classList.add('show');
    submitBtn.disabled = false;
    submitBtn.textContent = isEdit ? 'Save changes' : 'Add';
  }
}
