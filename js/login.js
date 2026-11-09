const cfg = window.KEYS99_CONFIG || {};
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  document.getElementById("demo").textContent = "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js.";
} else {
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  sb.auth.getSession().then(({ data }) => { if (data.session) location.href = "index.html"; });
  document.getElementById("form").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: email.value, password: password.value });
    if (error) document.getElementById("err").textContent = error.message;
    else location.href = "index.html";
  };
}
