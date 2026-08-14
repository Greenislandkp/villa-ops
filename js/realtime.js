import { supabase } from './supabase-client.js';

let channel = null;

// Écoute les changements sur `entries`. Le filtrage par villa est déjà fait
// par les policies RLS côté serveur : seules les lignes autorisées pour
// l'utilisateur connecté sont livrées ici.
export function subscribeEntries(onChange) {
  if (channel) return channel;
  channel = supabase
    .channel('entries-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, () => {
      onChange();
    })
    .subscribe();
  return channel;
}

export function unsubscribeEntries() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
