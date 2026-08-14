import { state, addCategory } from './store.js';
import { createCategory, createEntry, createReservation, uploadEntryPhoto, updateEntryPhoto } from './data.js';
import { escapeHtml, todayIso, isReservationCategory, showToast } from './utils.js';

const CATEGORY_COLORS = ['#3E7C59', '#D98E04', '#B5502A', '#8B9A93', '#C99A3D', '#5B7FA6', '#8B5FBF'];

let selectedVillaId = null;
let selectedCategoryId = null;
let selectedStatus = 'a_faire';
let newCategoryColor = CATEGORY_COLORS[0];
let photoFile = null;

function closeSheet() {
  document.getElementById('sheet-root').innerHTML = '';
  photoFile = null;
}

export function openEntryForm(onDone) {
  if (!state.currentTeamMember) {
    showToast("Ton profil Villa Ops n'est pas encore configuré. Contacte l'administrateur.");
    return;
  }
  if (!state.villas.length) {
    showToast('Aucune villa accessible pour créer une entrée.');
    return;
  }

  selectedVillaId = state.selectedVillaId !== 'all' ? state.selectedVillaId : state.villas[0].id;
  selectedCategoryId = state.categories[0] ? state.categories[0].id : null;
  selectedStatus = 'a_faire';
  photoFile = null;

  renderSheet();
  wireSheet(onDone);
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

function assigneeOptionsHtml() {
  const opts = state.teamMembers.map((m) => `<option value="${m.id}">${escapeHtml(m.full_name)}</option>`).join('');
  return `<option value="">Personne en particulier</option>${opts}`;
}

function colorSwatchesHtml() {
  return CATEGORY_COLORS.map((c) => `<button type="button" class="color-swatch${c === newCategoryColor ? ' active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');
}

function renderSheet() {
  const cat = state.categoriesById.get(selectedCategoryId);
  const showReservation = isReservationCategory(cat);

  const html = `
  <div class="sheet-overlay" id="entry-overlay">
    <div class="sheet">
      <button type="button" class="sheet-close" id="entry-close">✕</button>
      <div class="sheet-handle"></div>
      <p class="sheet-title">Nouvelle entrée</p>
      <form id="entry-form" class="form-grid">
        <div class="field">
          <label>Villa</label>
          <div class="chip-select" id="villa-chips">${villaChipsHtml()}</div>
        </div>

        <div class="field">
          <label>Catégorie</label>
          <div class="chip-select" id="cat-chips">${categoryChipsHtml()}</div>
          <button type="button" class="new-cat-toggle" id="new-cat-toggle">+ Nouvelle catégorie</button>
          <div class="new-cat-form hidden" id="new-cat-form">
            <input type="text" id="new-cat-label" placeholder="Nom de la catégorie" maxlength="40">
            <div class="color-swatches" id="new-cat-colors">${colorSwatchesHtml()}</div>
            <button type="button" class="btn-secondary" id="new-cat-save" style="padding:10px 14px; white-space:nowrap;">Créer</button>
          </div>
        </div>

        <div class="field">
          <label for="entry-title">Titre</label>
          <input type="text" id="entry-title" required maxlength="140" placeholder="Ex : Fuite climatisation chambre 2">
        </div>

        <div class="field">
          <label for="entry-desc">Description (optionnel)</label>
          <textarea id="entry-desc" class="field-textarea" placeholder="Détails supplémentaires…"></textarea>
        </div>

        <div class="form-row-2">
          <div class="field">
            <label for="entry-date">Date</label>
            <input type="date" id="entry-date" value="${todayIso()}" required>
          </div>
          <div class="field">
            <label for="entry-assignee">Assigné à</label>
            <select id="entry-assignee" class="field-select">${assigneeOptionsHtml()}</select>
          </div>
        </div>

        <div class="field">
          <label>Statut</label>
          <div class="chip-select" id="status-chips">
            <button type="button" class="status-option a_faire${selectedStatus === 'a_faire' ? ' active a_faire' : ''}" data-status="a_faire">À faire</button>
            <button type="button" class="status-option en_cours${selectedStatus === 'en_cours' ? ' active en_cours' : ''}" data-status="en_cours">En cours</button>
            <button type="button" class="status-option fait${selectedStatus === 'fait' ? ' active fait' : ''}" data-status="fait">Fait</button>
          </div>
        </div>

        <div class="field">
          <label>Photo (optionnel)</label>
          <label class="photo-input-btn" for="entry-photo" id="photo-label">📷 Ajouter une photo</label>
          <input type="file" id="entry-photo" accept="image/*" capture="environment" class="hidden">
          <img id="photo-preview" class="photo-preview" alt="Aperçu photo">
        </div>

        <div class="reservation-fields${showReservation ? ' show' : ''}" id="reservation-fields">
          <p class="reservation-fields-title">Détails réservation</p>
          <div class="field">
            <label for="res-guest">Nom du client</label>
            <input type="text" id="res-guest" maxlength="100">
          </div>
          <div class="form-row-2">
            <div class="field">
              <label for="res-count">Nb. personnes</label>
              <input type="number" id="res-count" min="1" max="40">
            </div>
            <div class="field">
              <label for="res-platform">Plateforme</label>
              <select id="res-platform" class="field-select">
                <option value="Airbnb">Airbnb</option>
                <option value="Booking">Booking</option>
                <option value="Direct">Direct</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
          </div>
          <div class="form-row-2">
            <div class="field">
              <label for="res-checkin">Heure check-in</label>
              <input type="time" id="res-checkin">
            </div>
            <div class="field">
              <label for="res-checkout">Heure check-out</label>
              <input type="time" id="res-checkout">
            </div>
          </div>
          <div class="form-row-2">
            <div class="field">
              <label for="res-amount">Montant</label>
              <input type="number" id="res-amount" min="0" step="0.01">
            </div>
            <div class="field">
              <label for="res-currency">Devise</label>
              <input type="text" id="res-currency" maxlength="8" placeholder="THB">
            </div>
          </div>
        </div>

        <div class="form-error" id="entry-form-error"></div>

        <div class="sheet-actions">
          <button type="button" class="btn-secondary" id="entry-cancel">Annuler</button>
          <button type="submit" class="btn-primary" id="entry-submit">Ajouter</button>
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
      showToast(err.message || 'Impossible de créer la catégorie.');
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
  document.getElementById('reservation-fields').classList.toggle('show', isReservationCategory(cat));
}

async function submitEntry(onDone) {
  const errorBox = document.getElementById('entry-form-error');
  errorBox.classList.remove('show');
  const submitBtn = document.getElementById('entry-submit');

  const title = document.getElementById('entry-title').value.trim();
  if (!title || !selectedVillaId || !selectedCategoryId) {
    errorBox.textContent = 'Villa, catégorie et titre sont requis.';
    errorBox.classList.add('show');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Ajout…';

  try {
    const cat = state.categoriesById.get(selectedCategoryId);
    const isReservation = isReservationCategory(cat);
    const checkIn = isReservation ? document.getElementById('res-checkin').value || null : null;
    const checkOut = isReservation ? document.getElementById('res-checkout').value || null : null;

    const entry = await createEntry({
      villa_id: selectedVillaId,
      category_id: selectedCategoryId,
      title,
      description: document.getElementById('entry-desc').value.trim() || null,
      author_id: state.currentTeamMember.id,
      assigned_to_id: document.getElementById('entry-assignee').value || null,
      status: selectedStatus,
      event_date: document.getElementById('entry-date').value,
      check_in_time: checkIn,
      check_out_time: checkOut,
      photo_url: null,
    });

    if (isReservation) {
      const guestName = document.getElementById('res-guest').value.trim();
      if (guestName) {
        const guestCount = document.getElementById('res-count').value;
        const amount = document.getElementById('res-amount').value;
        await createReservation({
          entry_id: entry.id,
          guest_name: guestName,
          guest_count: guestCount ? Number(guestCount) : null,
          platform: document.getElementById('res-platform').value || null,
          amount: amount ? Number(amount) : null,
          currency: document.getElementById('res-currency').value.trim() || null,
        });
      }
    }

    if (photoFile) {
      try {
        const path = await uploadEntryPhoto(selectedVillaId, entry.id, photoFile);
        await updateEntryPhoto(entry.id, path);
      } catch (photoErr) {
        showToast("Entrée ajoutée, mais l'upload de la photo a échoué.");
      }
    }

    closeSheet();
    showToast('Entrée ajoutée.');
    if (onDone) onDone();
  } catch (err) {
    errorBox.textContent = err.message || "Impossible d'ajouter cette entrée pour le moment.";
    errorBox.classList.add('show');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Ajouter';
  }
}
