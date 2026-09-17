import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.__SUPABASE_CONFIG__ || {};
const supabase = cfg.url && cfg.key ? createClient(cfg.url, cfg.key) : null;
let mode = 'signin';

const $ = (id) => document.getElementById(id);
const toast = (text) => {
  const el = document.createElement('div');
  el.className = 'toast show';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
};

function setMode(next) {
  mode = next;
  const signup = mode === 'signup';
  $('auth-title').textContent = signup ? 'Create your account' : 'Welcome back';
  $('auth-message').textContent = signup
    ? 'Create an account to keep your routines synced across devices.'
    : 'Sign in to continue to your routine.';
  $('auth-submit').textContent = signup ? 'Create account' : 'Sign in';
  $('auth-switch').textContent = signup ? 'I already have an account' : 'Create an account';
  $('auth-reset').style.display = signup ? 'none' : 'block';
  $('password').setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
  $('password').value = '';
}

async function redirectIfSignedIn() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) window.location.replace('/dashboard.html');
}

$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) {
    toast('Account service is not configured.');
    return;
  }
  const email = $('email').value.trim();
  const password = $('password').value;
  const button = $('auth-submit');
  button.disabled = true;
  const result = mode === 'signin'
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password });
  button.disabled = false;
  if (result.error) {
    toast(result.error.message);
    return;
  }
  if (mode === 'signup' && !result.data.session) {
    toast('Check your email to confirm your account.');
    return;
  }
  window.location.replace('/dashboard.html');
});

$('auth-switch').onclick = () => setMode(mode === 'signin' ? 'signup' : 'signin');
$('auth-reset').onclick = async () => {
  if (!supabase) return toast('Account service is not configured.');
  const email = $('email').value.trim();
  if (!email) return toast('Enter your email first.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login.html` });
  toast(error ? error.message : 'Password reset email sent.');
};
$('password-toggle').onclick = () => {
  const input = $('password');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  $('password-toggle').textContent = show ? 'Hide' : 'Show';
  $('password-toggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  $('password-toggle').setAttribute('aria-pressed', String(show));
};

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) window.location.replace('/dashboard.html');
  });
  redirectIfSignedIn();
}

document.body.classList.remove('auth-boot');
