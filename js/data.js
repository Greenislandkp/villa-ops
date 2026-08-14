// Accès aux données `entries` / `reservations` / `categories`.
// Par choix : pas d'embedding PostgREST (select imbriqué) pour éviter de
// dépendre du nom exact des contraintes FK du schéma déjà en place côté
// Supabase. On récupère les entrées "à plat" et on les recompose côté
// client à partir des listes déjà chargées (villas/catégories/équipe),
// déjà filtrées par les policies RLS de toute façon.
import { supabase, ENTRY_PHOTOS_BUCKET } from './supabase-client.js';

const ENTRY_COLUMNS = 'id, villa_id, category_id, title, description, author_id, assigned_to_id, status, event_date, check_in_time, check_out_time, photo_url, created_at, updated_at';

export async function fetchJournalEntries({ villaId, categoryId, limit = 100 }) {
  let q = supabase.from('entries').select(ENTRY_COLUMNS).order('created_at', { ascending: false }).limit(limit);
  if (villaId && villaId !== 'all') q = q.eq('villa_id', villaId);
  if (categoryId && categoryId !== 'all') q = q.eq('category_id', categoryId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchTaskEntries({ villaId, limit = 200 }) {
  let q = supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .in('status', ['a_faire', 'en_cours'])
    .order('event_date', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (villaId && villaId !== 'all') q = q.eq('villa_id', villaId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchEntriesForMonth({ villaId, startIso, endIso }) {
  let q = supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .gte('event_date', startIso)
    .lte('event_date', endIso)
    .order('event_date', { ascending: true });
  if (villaId && villaId !== 'all') q = q.eq('villa_id', villaId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function fetchRecentEntriesForVillas(villaIds, perVillaLimit = 300) {
  if (!villaIds.length) return [];
  const { data, error } = await supabase
    .from('entries')
    .select('id, villa_id, title, status, created_at')
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
