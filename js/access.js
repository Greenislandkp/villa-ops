// Resolves the access context of the logged-in user.
// Villa-level access control is enforced server-side by RLS policies (see
// brief, "Security" section): this module only relays what Supabase already
// agrees to return, it does not reimplement the access logic.
import { supabase } from './supabase-client.js';

export async function loadCurrentTeamMember(userId) {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data; // null if the admin hasn't created a team_members profile yet
}

export async function loadAccessibleVillas() {
  // RLS already limits the result to villas the logged-in user can access.
  const { data, error } = await supabase
    .from('villas')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false })
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
