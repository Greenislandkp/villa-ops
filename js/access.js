// Résolution du contexte d'accès de l'utilisateur connecté.
// Le cloisonnement par villa est appliqué côté serveur par les policies RLS
// (voir brief, section "Sécurité") : ce module ne fait que relayer ce que
// Supabase accepte déjà de renvoyer, il ne réimplémente pas la logique d'accès.
import { supabase } from './supabase-client.js';

export async function loadCurrentTeamMember(userId) {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data; // null si le profil team_members n'a pas encore été créé par l'admin
}

export async function loadAccessibleVillas() {
  // RLS limite déjà le résultat aux villas accessibles par l'utilisateur connecté.
  const { data, error } = await supabase
    .from('villas')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function loadTeamMembers() {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('active', true)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function loadCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('is_default', { ascending: false })
    .order('label', { ascending: true });
  if (error) throw error;
  return data || [];
}
