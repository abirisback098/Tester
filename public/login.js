import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.__SUPABASE_CONFIG__ || {};
const supabase = cfg.url && cfg.key ? createClient(cfg.url, cfg.key) : null;
const appUrl = (cfg.appUrl || 'https://routine-planner-qyj2.onrender.com').replace(/\/$/, '');
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
  const reset = mode === 'reset';

  $('auth-title').textContent = reset ? 'Set a new password' : signup ? 'Create your account' : 'Welcome back';
  $('auth-message').textContent = reset
    ? 'Choose a new password for your Routine Planner account.'
    : signup
      ? 'Create an account to keep your routines synced across devices.'
      : 'Sign in to continue to your routine.';
  $('auth-submit').textContent = reset ? 'Update password' : signup ? 'Create account' : 'Sign in';
  $('auth-switch').style.display = reset ? 'none' : 'block';
  $('auth-switch').textContent = signup ? 'I already have an account' : 'Create an account';
  $('auth-reset').style.display = reset || signup ? 'none' : 'block';
  $('email-label').style.display = reset ? 'none' : 'block';
  $('email').required = !reset;
  $('password-label').firstChild.textContent = reset ? 'New password' : 'Password';
  $('password').setAttribute('autocomplete', reset || signup ? 'new-password' : 'current-password');
  $('password').placeholder = reset ? 'Enter your new password' : 'Enter your password';
  $('confirm-password-label').style.display = reset ? 'block' : 'none';
  $('confirm-password').required = reset;
  $('confirm-password').value = '';
  $('auth-footnote').textContent = reset
    ? 'Use a strong password you have not used elsewhere.'
    : 'Your routine is only available after you sign in.';
  $('password').value = '';
}

function isRecoveryUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return hash.get('type') === 'recovery' || query.get('type') === 'recovery';
}

async function redirectIfSignedIn() {
  if (!supabase || isRecoveryUrl()) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) window.location.replace('/dashboard.html');
}

$('auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabase) {
    toast('Account service is not configured.');
    return;
  }

  const button = $('auth-submit');
  button.disabled = true;

  try {
    if (mode === 'reset') {
      const password = $('password').value;
      const confirmPassword = $('confirm-password').value;
      if (password.length < 6) {
        toast('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        toast('The passwords do not match.');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast(error.message);
        return;
      }

      toast('Password updated. Opening your planner…');
      window.history.replaceState({}, document.title, '/login.html');
      setTimeout(() => window.location.replace('/dashboard.html'), 700);
      return;
    }

    const email = $('email').value.trim();
    const password = $('password').value;
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (result.error) {
      toast(result.error.message);
      return;
    }
    if (mode === 'signup' && !result.data.session) {
      toast('Check your email to confirm your account.');
      return;
    }
    window.location.replace('/dashboard.html');
  } finally {
    button.disabled = false;
  }
});

$('auth-switch').onclick = () => setMode(mode === 'signin' ? 'signup' : 'signin');
$('auth-reset').onclick = async () => {
  if (!supabase) return toast('Account service is not configured.');
  const email = $('email').value.trim();
  if (!email) return toast('Enter your email first.');

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/login.html?type=recovery`
  });
  toast(error ? error.message : 'Password reset email sent. Check your inbox.');
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
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      setMode('reset');
      return;
    }
    if (session && mode !== 'reset' && !isRecoveryUrl()) {
      window.location.replace('/dashboard.html');
    }
  });

  if (isRecoveryUrl()) {
    setMode('reset');
  } else {
    redirectIfSignedIn();
  }
}

document.body.classList.remove('auth-boot');
