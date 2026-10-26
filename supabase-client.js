(function () {
  'use strict';
  const cfg = window.PENNYWISE_SUPABASE_CONFIG || {};
  const valid = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.url || '') &&
    typeof cfg.anonKey === 'string' && cfg.anonKey.length > 20 &&
    !cfg.anonKey.includes('YOUR_');
  window.pwSupabaseReady = Boolean(valid && window.supabase && window.supabase.createClient);
  window.pwSupabase = window.pwSupabaseReady
    ? window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
})();
