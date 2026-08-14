// Access to `entries` / `reservations` / `categories` data.
// By choice: no PostgREST embedding (nested select) to avoid depending on
// the exact FK constraint names of the schema already in place on
// Supabase. Entries are fetched "flat" and recomposed client-side from
// the already-loaded lists (villas/categories/team), which are already
// filtered by RLS policies anyway.
import { supabase, ENTRY_PHOTOS_BUCKET } from './supabase-client.js';

const ENTRY_COLUMNS = 'id, villa_id, category_id, title, description, author_id, assigned_to_id, status, event_date, check_in_time, check_out_time, photo_url, related_entry_id, created_at, updated_at';

// sortBy: 'due' (event_date) or 'added' (created_at) — default 'added' to
// keep the classic chronological feed unless the caller asks otherwise.
export async function fetchJournalEntries({ villaId, categoryId, sortBy = 'added', excludeCategoryId, limit = 100 }) {
  let q = supabase.from('entries').select(ENTRY_COLUMNS).limit(limit);
  if (villaId && villaId !== 'all') q = q.eq('villa_id', villaId);
  if (categoryId && categoryId !== 'all') q = q.eq('category_id', categoryId);
  if (excludeCategoryId) q = q.neq('category_id', excludeCategoryId);
  q = sortBy === 'due'
    ? q.order('event_date', { ascending: true }).order('created_at', { ascending: false })
    : q.order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// excludeCategoryId: reservations aren't "tasks" (no meaningful to-do/in
// progress/done for a stay), so excluded regardless of their real status.
// sortBy: 'due' (event_date, default) or 'added' (created_at).
export async function fetchTaskEntries({ villaId, excludeCategoryId, sortBy = 'due', limit = 200 }) {
  let q = supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .in('status', ['a_faire', 'en_cours'])
    .limit(limit);
  if (villaId && villaId !== 'all') q = q.eq('villa_id', villaId);
  if (excludeCategoryId) q = q.neq('category_id', excludeCategoryId);
  q = sortBy === 'added'
    ? q.order('created_at', { ascending: false })
    : q.order('event_date', { ascending: true }).order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Report list for the dedicated Reservations tab — entries of the
// Reservation category, sorted by arrival date (soonest first).
export async function fetchReservationEntries({ villaId, categoryId, limit = 200 }) {
  let q = supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .eq('category_id', categoryId)
    .order('event_date', { ascending: true })
    .limit(limit);
  if (villaId && villaId !== 'all') q = q.eq('villa_id', villaId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchEntriesForMonth({ villaId, startIso, endIso, excludeCategoryId }) {
  let q = supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .gte('event_date', startIso)
    .lte('event_date', endIso)
    .order('event_date', { ascending: true });
  if (villaId && villaId !== 'all') q = q.eq('villa_id', villaId);
  if (excludeCategoryId) q = q.neq('category_id', excludeCategoryId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Réservations dont le séjour peut chevaucher la période visible : on part
// large (jusqu'à `maxStayDays` avant le début de la période) puisque
// check_out_date vit sur `reservations`, pas sur `entries` — impossible de
// filtrer précisément côté serveur sans embedding.
export async function fetchReservationEntriesNear({ villaId, categoryId, rangeStart, rangeEnd, maxStayDays = 60 }) {
  const earliest = new Date(rangeStart);
  earliest.setDate(earliest.getDate() - maxStayDays);
  const earliestIso = earliest.toISOString().slice(0, 10);

  let q = supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .eq('category_id', categoryId)
    .gte('event_date', earliestIso)
    .lte('event_date', rangeEnd);
  if (villaId && villaId !== 'all') q = q.eq('villa_id', villaId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchRecentEntriesForVillas(villaIds, perVillaLimit = 300) {
  if (!villaIds.length) return [];
  const { data, error } = await supabase
    .from('entries')
    .select('id, villa_id, category_id, title, status, created_at')
    .in('villa_id', villaIds)
    .order('created_at', { ascending: false })
    .limit(perVillaLimit * villaIds.length);
  if (error) throw error;
  return data || [];
}

export async function fetchEntryById(entryId) {
  const { data, error } = await supabase.from('entries').select(ENTRY_COLUMNS).eq('id', entryId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchReservationsForEntries(entryIds) {
  if (!entryIds.length) return new Map();
  const { data, error } = await supabase.from('reservations').select('*').in('entry_id', entryIds);
  if (error) throw error;
  const map = new Map();
  (data || []).forEach((r) => map.set(r.entry_id, r));
  return map;
}

export async function createCategory({ label, color }) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ label, color, is_default: false })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function createEntry(payload) {
  const { data, error } = await supabase.from('entries').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function createReservation(payload) {
  const { data, error } = await supabase.from('reservations').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateEntry(entryId, payload) {
  const { data, error } = await supabase.from('entries').update(payload).eq('id', entryId).select('*').single();
  if (error) throw error;
  return data;
}

// Update the reservation row tied to an entry, or create one if it didn't
// have one yet (e.g. entry was edited into the Reservation category).
export async function saveReservationForEntry(entryId, payload) {
  const { data: existing, error: fetchError } = await supabase
    .from('reservations')
    .select('id')
    .eq('entry_id', entryId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing) {
    const { error } = await supabase.from('reservations').update(payload).eq('entry_id', entryId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('reservations').insert({ entry_id: entryId, ...payload });
    if (error) throw error;
  }
}

export async function deleteReservationForEntry(entryId) {
  const { error } = await supabase.from('reservations').delete().eq('entry_id', entryId);
  if (error) throw error;
}

// A reservation entry can have several auto-generated aux tasks linked to
// it (Check-in, Checkout, one each) — disambiguated by category since they
// all share the same related_entry_id.
export async function fetchLinkedTaskByCategory(reservationEntryId, categoryId) {
  const { data, error } = await supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .eq('related_entry_id', reservationEntryId)
    .eq('category_id', categoryId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteLinkedTasks(reservationEntryId) {
  const { error } = await supabase.from('entries').delete().eq('related_entry_id', reservationEntryId);
  if (error) throw error;
}

export async function updateEntryPhoto(entryId, photoPath) {
  const { error } = await supabase.from('entries').update({ photo_url: photoPath }).eq('id', entryId);
  if (error) throw error;
}

export async function updateEntryStatus(entryId, status) {
  const { error } = await supabase.from('entries').update({ status }).eq('id', entryId);
  if (error) throw error;
}

export async function uploadEntryPhoto(villaId, entryId, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${villaId}/${entryId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(ENTRY_PHOTOS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// Suppression complète d'une entrée : réservation associée puis photo en
// storage (best-effort) puis la ligne entries elle-même. Réservé aux
// membres full_access côté UI (entry-detail.js) — non appliqué ici.
export async function deleteEntry(entry) {
  await supabase.from('reservations').delete().eq('entry_id', entry.id);
  await supabase.from('entries').delete().eq('related_entry_id', entry.id); // linked Checkout task, if any
  if (entry.photo_url) {
    try {
      await supabase.storage.from(ENTRY_PHOTOS_BUCKET).remove([entry.photo_url]);
    } catch (_) {
      /* best effort : ne bloque pas la suppression de l'entrée */
    }
  }
  const { error } = await supabase.from('entries').delete().eq('id', entry.id);
  if (error) throw error;
}
