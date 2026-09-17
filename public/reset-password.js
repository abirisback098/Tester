import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.__SUPABASE_CONFIG__ || {};
const supabase = cfg.url && cfg.key ? createClient(cfg.url, cfg.key) : null;
const $ = (id) => document.getElementById(id);
const form = $('reset-form');
const submit = $('reset-submit');
let recoverySession = null;
let ready = false;
let errorShown = false;

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast show';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function showReady() {
  if (ready) return;
  ready = true;
  $('reset-title').textContent = 'Set a new password';
  $('reset-message').textContent = 'Enter your new password below.';
  $('reset-footnote').textContent = 'Your new password will be used the next time you sign in.';
  submit.disabled = false;
  document.body.classList.remove('auth-boot');
}

function showError(message) {
  if (errorShown) return;
  errorShown = true;
  $('reset-title').textContent = 'Reset link unavailable';
  $('reset-message').textContent = message;
  $('reset-footnote').textContent = 'Request a new password reset email from the sign-in page.';
  form.classList.add('hidden');
  document.body.classList.remove('auth-boot');
}

$('password-toggle').onclick = () => {
  const input = $('password');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  $('password-toggle').textContent = show ? 'Hide' : 'Show';
  $('password-toggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  $('password-toggle').setAttribute('aria-pressed', String(show));
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase || !recoverySession) {
    toast('This reset link is no longer active.');
    return;
  }

  const password = $('password').value;
  const confirm = $('confirm-password').value;
  if (password.length < 6) return toast('Password must be at least 6 characters.');
  if (password !== confirm) return toast('The passwords do not match.');

  submit.disabled = true;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    submit.disabled = false;
    toast(error.message);
    return;
  }

  await supabase.auth.signOut();
  window.location.replace('/login.html?reset=success');
});

async function initialize() {
  if (!supabase) {
    showError('Account service is not configured.');
    return;
  }

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const recovery = hash.get('type') === 'recovery' || query.get('type') === 'recovery';

  const recoveryTimer = recovery ? setTimeout(() => {
    if (!recoverySession) showError('This reset link has expired or has already been used.');
  }, 6000) : null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    showError('We could not open the password reset session.');
    return;
  }

  if (data.session) {
    recoverySession = data.session;
    if (recoveryTimer) clearTimeout(recoveryTimer);
    showReady();
    return;
  }

  if (!recovery) {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    showError('Open the password reset link from your email to continue.');
  }
}

supabase?.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' && session) {
    recoverySession = session;
    showReady();
  }
});

initialize();
