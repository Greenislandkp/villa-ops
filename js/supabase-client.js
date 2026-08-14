// Client Supabase — infra déjà provisionnée, ne pas modifier l'URL/la clé ici
// sans mettre à jour le projet Supabase correspondant.
// La lib @supabase/supabase-js est vendorisée en local (js/vendor/supabase.js,
// chargée en <script> classique avant ce module) pour ne pas dépendre d'un
// CDN externe au runtime — cf. window.supabase (UMD) chargé dans index.html.
const { createClient } = window.supabase;

const SUPABASE_URL = 'https://ohmercemusyijkipquld.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fjyq1HQcjej7LtrkdY_vIQ_hZLEAeDF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const ENTRY_PHOTOS_BUCKET = 'entry-photos';
