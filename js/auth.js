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

// Wires the login form. Fails cleanly (clear message, no crash) as long as
// no account has been created on the Supabase side by the admin.
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
    submitBtn.textContent = 'Signing in…';

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';

    if (error) {
      errorBox.textContent = translateAuthError(error);
      errorBox.classList.add('show');
    }
    // success: onAuthStateChange (wired in app.js) takes over.
  });
}

function translateAuthError(error) {
  const msg = (error && error.message) || '';
  if (/invalid login credentials/i.test(msg)) {
    return "Incorrect credentials, or no account created yet for this address. Contact the Villa Ops administrator.";
  }
  if (/email not confirmed/i.test(msg)) {
    return "This account hasn't been confirmed yet. Contact the Villa Ops administrator.";
  }
  return "Couldn't sign in right now. Try again in a moment.";
}
