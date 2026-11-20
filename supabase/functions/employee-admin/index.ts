// @ts-nocheck
// employee-admin: lets an ADMIN create and manage logins for team members (employees).
// The caller must send their own signed-in token and be an active admin in app_users. The service-role key stays on the server.
// Actions: create | reset-password | change-email | disable | enable | remove. Passwords are never logged or returned.
import { createClient } from "npm:@supabase/supabase-js@2";
import * as L from "./lib.js";

const url = Deno.env.get("SUPABASE_URL"), sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: au } = bearer ? await sb.auth.getUser(bearer) : { data: null };
  if (!au || !au.user) return json({ ok: false, error: "Sign in first" }, 401);
  const { data: me } = await sb.from("app_users").select("role,active").eq("user_id", au.user.id).maybeSingle();
  if (!me || me.role !== "admin" || !me.active) return json({ ok: false, error: "Only admins can manage logins" }, 403);

  let body = {}; try { body = await req.json(); } catch { /* empty */ }
  const p = L.parseAction(body); if (p.error) return json({ ok: false, error: p.error }, 400);
  const v = p.value;
  const { data: member } = await sb.from("team_members").select("id,name,email").eq("id", v.member_id).maybeSingle();
  if (!member) return json({ ok: false, error: "Team member not found" }, 404);
  const { data: existing } = await sb.from("app_users").select("user_id,role,active").eq("member_id", v.member_id).maybeSingle();

  try {
    if (v.action === "create") {
      if (existing) return json({ ok: false, error: "This team member already has a login" }, 409);
      const { data: c, error } = await sb.auth.admin.createUser({ email: v.email, password: v.password, email_confirm: true, user_metadata: { must_change_password: true, name: member.name } });
      if (error) return json({ ok: false, error: /already|registered/i.test(error.message) ? "That email already has a login" : "Could not create the login" }, 400);
      const { error: e2 } = await sb.from("app_users").insert({ user_id: c.user.id, role: "employee", member_id: v.member_id, active: true });
      if (e2) { await sb.auth.admin.deleteUser(c.user.id); return json({ ok: false, error: "Could not save the login" }, 500); }
      return json({ ok: true, email: v.email });
    }
    if (!existing) return json({ ok: false, error: "This team member has no login" }, 404);
    if (existing.role !== "employee") return json({ ok: false, error: "Only employee logins can be changed here" }, 403);
    if (v.action === "reset-password") {
      const { error } = await sb.auth.admin.updateUserById(existing.user_id, { password: v.password, user_metadata: { must_change_password: true } });
      return error ? json({ ok: false, error: "Could not reset the password" }, 500) : json({ ok: true });
    }
    if (v.action === "change-email") {
      // the address must not belong to another team member or another login
      const { data: clash } = await sb.from("team_members").select("id,name").ilike("email", v.email.replace(/[\\%_]/g, "\\$&")).neq("id", v.member_id).limit(1);
      if (clash && clash.length) return json({ ok: false, error: "Another team member (" + clash[0].name + ") already uses that email" }, 409);
      const { data: cur } = await sb.auth.admin.getUserById(existing.user_id);
      const oldEmail = cur && cur.user ? cur.user.email : null;
      const { error } = await sb.auth.admin.updateUserById(existing.user_id, { email: v.email, email_confirm: true });
      if (error) return json({ ok: false, error: /already|registered|exists/i.test(error.message) ? "That email already has a login" : "Could not change the login email" }, /already|registered|exists/i.test(error.message) ? 409 : 500);
      // keep the team record in step (a database trigger then updates the lead alert address on that person's leads)
      const { error: e2 } = await sb.from("team_members").update({ email: v.email }).eq("id", v.member_id);
      if (e2) { if (oldEmail) await sb.auth.admin.updateUserById(existing.user_id, { email: oldEmail, email_confirm: true }); return json({ ok: false, error: "Could not save the new email" }, 500); }
      return json({ ok: true, email: v.email, previous: oldEmail });
    }
    if (v.action === "disable" || v.action === "enable") {
      const off = v.action === "disable";
      const { error } = await sb.auth.admin.updateUserById(existing.user_id, { ban_duration: off ? "876000h" : "none" });
      if (error) return json({ ok: false, error: "Could not change the login" }, 500);
      await sb.from("app_users").update({ active: !off }).eq("user_id", existing.user_id);
      return json({ ok: true });
    }
    if (v.action === "remove") {
      const { error } = await sb.auth.admin.deleteUser(existing.user_id);      // app_users row goes with it (cascade)
      return error ? json({ ok: false, error: "Could not remove the login" }, 500) : json({ ok: true });
    }
  } catch (e) { console.error("employee-admin", String((e && e.message) || e).slice(0, 120)); return json({ ok: false, error: "Something went wrong" }, 500); }
  return json({ ok: false, error: "Unknown action" }, 400);
});
