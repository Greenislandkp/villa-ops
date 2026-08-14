import { supabase } from './supabase-client.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return data.subscription;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Branche le formulaire de connexion. Échoue proprement (message clair, pas
// de blocage) tant qu'aucun compte n'a été créé côté Supabase par l'admin.
export function wireLoginForm() {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('show');
    errorBox.textContent = '';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion…';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';

    if (error) {
      errorBox.textContent = translateAuthError(error);
      errorBox.classList.add('show');
    }
    // succès : onAuthStateChange (branché dans app.js) prend le relais.
  });
}

function translateAuthError(error) {
  const msg = (error && error.message) || '';
  if (/invalid login credentials/i.test(msg)) {
    return "Identifiants incorrects, ou compte pas encore créé pour cette adresse. Contacte l'administrateur de Villa Ops.";
  }
  if (/email not confirmed/i.test(msg)) {
    return "Ce compte n'a pas encore été confirmé. Contacte l'administrateur de Villa Ops.";
  }
  return "Connexion impossible pour le moment. Réessaie dans un instant.";
}
