/* Auth gate + compatibility cloud adapter for the existing synchronous PW store.
   Financial logic remains in store.js; localStorage is a per-user working cache.
   Changes to financeApp_* keys are saved as one JSONB snapshot after a short debounce. */
(function () {
  'use strict';
  const CONFIGURED = window.pwSupabaseReady && window.pwSupabase;
  const INITIAL_BODY_HTML = document.body.innerHTML;
  const DATA_PREFIX = 'financeApp_';
  const DATA_TABLE = 'pennywise_user_data';
  const $ = (s, root) => (root || document).querySelector(s);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const escapeHTML = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let currentUser = null;
  let bodyReplaced = false;
  let signingOut = false; // blocks any cloud upload once sign-out has begun
  function showBlocking(title, detail, isError) {

    document.documentElement.classList.remove('pw-loading');
    bodyReplaced = true;
    if (bodyReplaced) document.body.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;background:#f4f8f5;color:#16352a;font-family:Poppins,Arial,sans-serif;padding:24px"><section style="max-width:520px;background:white;border:1px solid #e1e9e3;border-radius:20px;padding:28px;box-shadow:0 20px 60px #1232"><div style="font-size:24px;font-weight:700;color:${isError ? '#b42318' : '#08754d'}">${escapeHTML(title)}</div><p style="line-height:1.7;color:#617168">${escapeHTML(detail)}</p>${isError ? '<a href="auth.html" style="color:#08754d;font-weight:600">Return to sign in</a>' : ''}</section></main>`;
  }
  function snapshot() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DATA_PREFIX) && !key.endsWith('_corrupt')) out[key] = localStorage.getItem(key);
    }
    return out;
  }
  function hasMeaningfulLocalData(data) {
    const keys = ['financeApp_accounts', 'financeApp_transactions', 'financeApp_listapay', 'financeApp_payments'];
    return keys.some((key) => { try { const v = JSON.parse(data[key] || '[]'); return Array.isArray(v) && v.length > 0; } catch (_) { return Boolean(data[key]); } }) || Boolean(data.financeApp_monthlyBudget);
  }
  function backupLocal(userId, data) {
    try { localStorage.setItem(`pennywise_backup_${userId}_${Date.now()}`, JSON.stringify({ createdAt: new Date().toISOString(), data })); }
    catch (e) { console.warn('Could not create local migration backup. Export browser data before proceeding.', e); }
  }
  function replaceLocal(data) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DATA_PREFIX)) localStorage.removeItem(key);
    }
    Object.entries(data || {}).forEach(([key, value]) => { if (key.startsWith(DATA_PREFIX) && typeof value === 'string') localStorage.setItem(key, value); });
  }
  async function loadCloud(userId) {
    const { data, error } = await window.pwSupabase.from(DATA_TABLE).select('payload,updated_at').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data || null;
  }
  async function saveCloud(userId, payload) {
    const { error } = await window.pwSupabase.from(DATA_TABLE).upsert({ user_id: userId, payload }, { onConflict: 'user_id' });
    if (error) throw error;
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load ' + src)); document.body.appendChild(s); });
  }
  // Expose global sign-out function inside boot()
  window.pwSignOut = async function (btnElement) {
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.textContent = 'Signing out...';
    }
    try {
      await window.pwCloudSyncNow();
    } catch (e) {
      const proceed = confirm(
        'The latest changes could not be synced to the cloud. Sign out anyway? Unsynced changes may be lost from this device.'
      );
      if (!proceed) {
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.textContent = 'Sign out';
        }
        return;
      }
    }
    // Data is already synced (or the user accepted the risk). From here on, never upload.
    signingOut = true;
    if (currentUser) {
      backupLocal(currentUser.id, snapshot());
      localStorage.removeItem('pennywise_migration_done_' + currentUser.id); // force a cloud load next login
    }
    replaceLocal({});
    try { await window.pwSupabase.auth.signOut(); }
    catch (e) { console.error('Sign out error:', e); }
    location.replace('auth.html');
  };

  function addCloudControls(user, initialStatus) {
    // Empty function keeps widget hidden without breaking calls
  }

  function setCloudStatus(text, failed) {
    // Empty function prevents ReferenceError during background sync updates
  }
  async function boot() {
    if (!CONFIGURED) return showBlocking('Supabase setup required', 'Add your Supabase project URL and publishable/anon key in supabase-config.js. Never use a service_role key in browser code.', true);
    let sessionResult;
    try { sessionResult = await window.pwSupabase.auth.getSession(); }
    catch (e) { return showBlocking('Could not check your session', 'Check your internet connection and Supabase project configuration, then try again.', true); }
    const user = sessionResult.data && sessionResult.data.session && sessionResult.data.session.user;
    if (!user) return location.replace('auth.html');
    currentUser = user;
    try {
      const local = snapshot();
      const migrationKey = `pennywise_migration_done_${user.id}`;
      const hasLocalCache = Object.keys(local).length > 0;
      const migrationAlreadyResolved = localStorage.getItem(migrationKey) === '1' && hasLocalCache;

      // The localStorage cache is already initialized for this user after the first
      // successful migration. On ordinary page navigation, don't block the UI or
      // fetch the full cloud snapshot again; the cloud adapter syncs changes separately.
      if (!migrationAlreadyResolved) {
        showBlocking('Loading your PennyWise data…', 'Checking your account and securely loading its cloud records.');
        const cloud = await loadCloud(user.id);

        if (cloud && cloud.payload && typeof cloud.payload === 'object') {
          if (hasMeaningfulLocalData(local)) {
            backupLocal(user.id, local);
            const overwrite = confirm('This browser already has finance data, and this account also has cloud data.\\n\\nOK = migrate this browser data to the cloud, replacing the account’s current cloud dataset.\\nCancel = keep the cloud dataset and restore it to this browser.\\n\\nA local backup is saved before either choice.');
            if (overwrite) { await saveCloud(user.id, local); replaceLocal(local); }
            else replaceLocal(cloud.payload);
          } else replaceLocal(cloud.payload);
          localStorage.setItem(migrationKey, '1');
        } else {
          if (hasMeaningfulLocalData(local)) {
            backupLocal(user.id, local);
            const importLocal = confirm('Existing PennyWise data was found in this browser. Import it into this signed-in account’s cloud storage?\\n\\nOK = upload this data to your account.\\nCancel = keep a local backup but start this account with fresh data.');
            if (importLocal) { await saveCloud(user.id, local); replaceLocal(local); }
            else replaceLocal({});
          } else {
            replaceLocal({});
            const name = (user.user_metadata && user.user_metadata.username) || (user.email ? user.email.split('@')[0] : 'PennyWise User');
            localStorage.setItem('financeApp_userName', name.slice(0, 40));
            await saveCloud(user.id, snapshot());
          }
          localStorage.setItem(migrationKey, '1');
        }
      }
      // Restore the existing #page element before loading the original app scripts.
      // The loading/error screen above temporarily replaces body contents.
      document.body.innerHTML = INITIAL_BODY_HTML;
      // The original app expects synchronous storage, so keep its store/UI unchanged.
      await loadScript('js/store.js');
      await loadScript('js/app.js');
      // app.js registers its renderer on DOMContentLoaded; authentication is asynchronous,
      // so explicitly dispatch it after both original scripts have loaded.
      if (document.readyState !== 'loading') document.dispatchEvent(new Event('DOMContentLoaded')); // otherwise the browser's upcoming event will initialize the app
      requestAnimationFrame(() => document.documentElement.classList.remove('pw-loading'));
      addCloudControls(user, 'Cloud ready');
      let timer = null, chain = Promise.resolve(), dirty = false;
      const nativeSet = Storage.prototype.setItem, nativeRemove = Storage.prototype.removeItem;
      let syncingInternally = false;
      async function syncNow() {
        if (signingOut || !dirty) return chain;
        dirty = false;
        const payload = snapshot();
        setCloudStatus('Saving…', false);
        chain = chain.catch(() => { }).then(() => saveCloud(user.id, payload)).then(() => setCloudStatus('Cloud synced', false)).catch((e) => { dirty = true; setCloudStatus('Sync failed — retrying', true); console.error('PennyWise cloud sync failed:', e); throw e; });
        return chain;
      }
      window.pwCloudSyncNow = syncNow;
      function queueSync() {
        if (syncingInternally || signingOut) return;
        dirty = true; setCloudStatus('Changes pending', false);
        clearTimeout(timer); timer = setTimeout(() => { syncNow().catch(() => { }); }, 650);
      }
      Storage.prototype.setItem = function (key, value) { nativeSet.call(this, key, value); if (typeof key === 'string' && key.startsWith(DATA_PREFIX)) queueSync(); };
      Storage.prototype.removeItem = function (key) { nativeRemove.call(this, key); if (typeof key === 'string' && key.startsWith(DATA_PREFIX)) queueSync(); };
      // Ensure data seeded by store.migrate() is persisted after the adapter is installed.
      await sleep(100); queueSync();
      window.addEventListener('online', () => { if (dirty) syncNow().catch(() => { }); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty) syncNow().catch(() => { }); });
      window.addEventListener('beforeunload', () => { if (dirty) { try { syncNow(); } catch (_) { } } });
    } catch (e) {
      console.error('PennyWise boot error:', e);
      showBlocking('Could not load cloud data', 'No data has intentionally been deleted. Check your Supabase SQL setup, RLS policies and internet connection. Details: ' + (e.message || 'Unknown error'), true);
    }
  }
  boot();
})();
