(function () {
  const cfg = window.KEYS99_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const art = $("art"); if (art) art.innerHTML = buildingSvg().__raw;
  if (window.lucide) lucide.createIcons();
  const say = (text, kind) => { $("msg").textContent = text; $("msg").className = "auth-msg" + (kind ? " " + kind : ""); };
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) { $("sub").textContent = "Supabase is not configured."; return; }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // The emailed link signs the user in temporarily (recovery session) so they can set a password.
  const ready = (ok) => {
    $("form").hidden = !ok;
    $("sub").textContent = ok ? "Enter a new password for your account." : "This reset link is invalid or has expired. Request a new one from the sign-in page.";
  };
  let settled = false;
  sb.auth.onAuthStateChange((ev, session) => { if (session && (ev === "PASSWORD_RECOVERY" || ev === "SIGNED_IN")) { settled = true; ready(true); } });
  setTimeout(async () => { if (!settled) { const { data } = await sb.auth.getSession(); ready(!!data.session); } }, 1200);

  $("toggle").onclick = () => {
    const show = $("pw1").type === "password";
    $("pw1").type = show ? "text" : "password";
    $("toggle").innerHTML = `<i data-lucide="${show ? "eye-off" : "eye"}"></i>`; lucide.createIcons();
  };
  $("form").onsubmit = async (e) => {
    e.preventDefault();
    const a = $("pw1").value, b = $("pw2").value;
    if (a.length < 8) return say("Use at least 8 characters.", "err");
    if (a !== b) return say("The two passwords don't match.", "err");
    $("btn").disabled = true; $("btn").textContent = "Updating…";
    const { error } = await sb.auth.updateUser({ password: a });
    if (error) { $("btn").disabled = false; $("btn").textContent = "Update password"; return say(error.message, "err"); }
    say("Password updated. Redirecting…", "ok");
    setTimeout(() => location.replace("index.html"), 900);
  };
})();
