(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const form = $('#auth-form'), notice = $('#auth-notice'), usernameWrap = $('#username-wrap');
  let mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login';
  const redirectTo = new URL('index.html', location.href).href;
  function message(text, isError) { notice.textContent = text; notice.classList.toggle('error', Boolean(isError)); notice.hidden = false; }
  function setMode(next) {
    mode = next;
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    usernameWrap.hidden = mode !== 'signup';
    $('#username').required = mode === 'signup';
    $('#password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('#auth-title').textContent = mode === 'signup' ? 'Create your account' : 'Welcome back';
    $('#auth-subtitle').textContent = mode === 'signup' ? 'Use any email address you can access, plus a unique username.' : 'Log in to continue to your money dashboard.';
    $('#submit-btn').textContent = mode === 'signup' ? 'Create account' : 'Log in';
    notice.hidden = true;
  }
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  if (!window.pwSupabaseReady) {
    message('Supabase is not configured yet. Open supabase-config.js and add your project URL and publishable/anon key.', true);
    $('#submit-btn').disabled = true; $('#google-btn').disabled = true;
  } else {
    window.pwSupabase.auth.getSession().then(({ data }) => { if (data.session) location.replace(redirectTo); });
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.pwSupabaseReady) return;
    const email = $('#email').value.trim().toLowerCase(), password = $('#password').value;
    const username = $('#username').value.trim().toLowerCase();
    if (mode === 'signup') {
      if (!/^[a-z0-9_]{3,24}$/.test(username)) return message('Username must be 3–24 characters using letters, numbers or underscores.', true);
      if (password.length < 8) return message('Use a password with at least 8 characters.', true);
    }
    $('#submit-btn').disabled = true; $('#google-btn').disabled = true;
    $('#submit-btn').textContent = mode === 'signup' ? 'Creating account…' : 'Logging in…'; notice.hidden = true;
    try {
      if (mode === 'signup') {
        const { data, error } = await window.pwSupabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (data.session) location.replace(redirectTo);
        else message('Account created. Check your email for the confirmation link, then log in. If you do not receive it, check Supabase Auth email settings.');
      } else {
        const { error } = await window.pwSupabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.replace(redirectTo);
      }
    } catch (err) { message(err.message || 'Authentication failed. Please try again.', true); }
    finally { $('#submit-btn').disabled = false; $('#google-btn').disabled = false; $('#submit-btn').textContent = mode === 'signup' ? 'Create account' : 'Log in'; }
  });
  $('#google-btn').addEventListener('click', async () => {
    if (!window.pwSupabaseReady) return;
    $('#google-btn').disabled = true; message('Connecting to Google…');
    try {
      const { error } = await window.pwSupabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'select_account' } } });
      if (error) throw error;
    } catch (err) { message(err.message || 'Google sign-in failed.', true); $('#google-btn').disabled = false; }
  });
  setMode(mode);
})();
