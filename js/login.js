(function () {
  const cfg = window.KEYS99_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const art = $("art"); if (art) art.innerHTML = buildingSvg().__raw;
  if (window.lucide) lucide.createIcons();

  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    $("msg").className = "auth-msg err";
    $("msg").textContent = "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js.";
    $("submitBtn").disabled = true; return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // Only allow redirecting back to our own pages.
  function nextUrl() {
    const n = new URLSearchParams(location.search).get("next") || "";
    return /^[a-z0-9_-]+\.html(\?[\w%=&.\-]*)?$/i.test(n) && !n.startsWith("login") ? n : "index.html";
  }
  sb.auth.getSession().then(({ data }) => { if (data.session) location.replace(nextUrl()); });

  const friendly = (m) => {
    m = String(m || "");
    if (/invalid login credentials/i.test(m)) return "Incorrect email or password.";
    if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox.";
    if (/rate limit|too many/i.test(m)) return "Too many attempts. Please wait a minute and try again.";
    if (/failed to fetch|network/i.test(m)) return "Can't reach the server. Check your internet connection.";
    return m || "Something went wrong. Please try again.";
  };
  const say = (el, text, kind) => { el.textContent = text; el.className = "auth-msg" + (kind ? " " + kind : ""); };
  const busy = (btn, on, label) => { btn.disabled = on; btn.textContent = on ? label + "…" : label; };

  $("togglePw").onclick = () => {
    const i = $("password"), show = i.type === "password";
    i.type = show ? "text" : "password";
    $("togglePw").setAttribute("aria-label", show ? "Hide password" : "Show password");
    $("togglePw").innerHTML = `<i data-lucide="${show ? "eye-off" : "eye"}"></i>`; lucide.createIcons();
  };

  $("signinForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("email").value.trim(), password = $("password").value;
    if (!email || !password) return say($("msg"), "Enter your email and password.", "err");
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return say($("msg"), "Enter a valid email address, e.g. name@example.com.", "err");
    say($("msg"), ""); busy($("submitBtn"), true, "Signing in");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { busy($("submitBtn"), false, "Sign in"); say($("msg"), friendly(error.message), "err"); $("password").select(); return; }
    say($("msg"), "Signed in. Redirecting…", "ok");
    location.replace(nextUrl());
  };

  const view = (reset) => { $("signinView").hidden = reset; $("resetView").hidden = !reset; (reset ? $("resetEmail") : $("email")).focus(); };
  $("forgotBtn").onclick = () => { $("resetEmail").value = $("email").value; say($("resetMsg"), ""); $("otpForm").hidden = true; view(true); };
  $("backBtn").onclick = () => view(false);

  $("resetForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("resetEmail").value.trim();
    if (!email) return say($("resetMsg"), "Enter your email address.", "err");
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return say($("resetMsg"), "Enter a valid email address, e.g. name@example.com.", "err");
    busy($("resetBtn"), true, "Sending");
    const redirectTo = new URL("reset.html", location.href).href;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    busy($("resetBtn"), false, "Send code");
    // Same message whether or not the account exists, so emails can't be probed.
    if (error && !/not found|invalid/i.test(error.message)) return say($("resetMsg"), friendly(error.message), "err");
    say($("resetMsg"), "If an account exists for that email, a code and a reset link are on their way.", "ok");
    $("otpForm").hidden = false; $("otpCode").focus();
  };

  // Step 2: the emailed code proves it is the account owner; it signs them in briefly so the new password can be saved.
  $("otpForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("resetEmail").value.trim(), token = $("otpCode").value.replace(/\s+/g, ""), a = $("otpPw1").value, b = $("otpPw2").value, m = $("otpMsg");
    if (!/^\d{6,8}$/.test(token)) return say(m, "Enter the 6-digit code from the email.", "err");
    if (a.length < 10 || !/[A-Za-z]/.test(a) || !/\d/.test(a)) return say(m, "Use at least 10 characters, with letters and numbers.", "err");
    if (a !== b) return say(m, "The two passwords do not match.", "err");
    busy($("otpBtn"), true, "Checking");
    const v = await sb.auth.verifyOtp({ email, token, type: "recovery" });
    if (v.error) { busy($("otpBtn"), false, "Verify and set password"); return say(m, /expired|invalid|token/i.test(v.error.message) ? "That code is wrong or has expired. Check it, or send a new one." : friendly(v.error.message), "err"); }
    const u = await sb.auth.updateUser({ password: a, data: { must_change_password: false } });
    if (u.error) { busy($("otpBtn"), false, "Verify and set password"); return say(m, /different|same/i.test(u.error.message) ? "Choose a password different from your current one." : friendly(u.error.message), "err"); }
    say(m, "Password changed. Signing you in…", "ok"); location.replace(nextUrl());
  };
})();
