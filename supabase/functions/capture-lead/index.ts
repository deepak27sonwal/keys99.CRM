// @ts-nocheck
// capture-lead: receives leads from Meta, Google Ads, LinkedIn, WhatsApp, YouTube and websites (webhooks) and stores them in `enquiries`.
// URL: <project>/functions/v1/capture-lead?i=<integration id>      Secret: header x-webhook-secret, ?s=, Bearer token, or Google's google_key.
// A signed-in CRM user (Bearer = Supabase session token) may only run dry-run tests (?test=1) and manage private tokens.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as L from "./lib.js";

const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, x-webhook-secret, apikey", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
const MAX_BODY = 200_000, RATE_PER_MIN = 120;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url), id = url.searchParams.get("i") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return json({ ok: false, error: "Unknown integration" }, 404);
  const { data: integ } = await sb.from("integrations").select("*").eq("id", id).maybeSingle();
  if (!integ) return json({ ok: false, error: "Unknown integration" }, 404);   // same answer for a bad id and a bad secret path
  const platform = integ.platform, secretMatches = async (s) => !!s && L.ctEqual(await L.sha256Hex(s), integ.secret_hash);

  // ---- Meta / WhatsApp webhook handshake: GET ?hub.mode=subscribe&hub.verify_token=<secret>&hub.challenge=...
  if (req.method === "GET") {
    const tok = url.searchParams.get("hub.verify_token"), ch = url.searchParams.get("hub.challenge");
    if (url.searchParams.get("hub.mode") === "subscribe" && ch && (await secretMatches(tok))) return new Response(ch, { status: 200, headers: { ...CORS, "content-type": "text/plain" } });
    return json({ ok: false, error: "Verification failed" }, 403);
  }
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  // ---- read body (JSON or form-encoded)
  const text = await req.text();
  if (text.length > MAX_BODY) return json({ ok: false, error: "Payload too large" }, 413);
  let body = {};
  try {                                                                           // detect JSON by its content: some tools send JSON with the wrong content-type
    const t = text.trim(), ct = req.headers.get("content-type") || "";
    if (!t) body = {};
    else if (t[0] === "{" || t[0] === "[") body = JSON.parse(t);
    else if (/urlencoded|text\/plain/i.test(ct) || t.includes("=")) body = Object.fromEntries(new URLSearchParams(t));
    else throw new Error("unsupported");
  } catch { return json({ ok: false, error: "Body must be JSON or form-encoded" }, 400); }

  // ---- authenticate
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const provided = req.headers.get("x-webhook-secret") || url.searchParams.get("s") || (body && !Array.isArray(body) ? body.google_key : "") || bearer;
  const viaSecret = await secretMatches(provided);
  let viaUser = false;
  if (!viaSecret && bearer) { const { data } = await sb.auth.getUser(bearer); viaUser = !!(data && data.user); }
  if (!viaSecret && !viaUser) return json({ ok: false, error: "Invalid or missing secret" }, 401);

  // ---- private token management (signed-in CRM users only; values are never returned)
  const action = url.searchParams.get("action");
  if (action) {
    if (!viaUser) return json({ ok: false, error: "Sign in to the CRM to do this" }, 403);
    if (action === "secret_status") { const { data } = await sb.from("integration_secrets").select("name").eq("integration_id", id); return json({ ok: true, saved: (data || []).map((r) => r.name) }); }
    if (action === "set_secret") {
      if (body.name !== "page_access_token" || typeof body.value !== "string" || body.value.length < 20 || body.value.length > 1000) return json({ ok: false, error: "Invalid token" }, 400);
      const { error } = await sb.from("integration_secrets").upsert({ integration_id: id, name: body.name, value: body.value.trim(), updated_at: new Date().toISOString() });
      return error ? json({ ok: false, error: "Could not save" }, 500) : json({ ok: true });
    }
    if (action === "clear_secret") { await sb.from("integration_secrets").delete().eq("integration_id", id).eq("name", "page_access_token"); return json({ ok: true }); }
    return json({ ok: false, error: "Unknown action" }, 400);
  }

  const wantsTest = url.searchParams.get("test") === "1" || (body && body._test === true);
  if (!viaSecret && !wantsTest) return json({ ok: false, error: "A signed-in session can only run tests (?test=1)" }, 403);

  if (!wantsTest) {                                                                 // rate limit real traffic
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await sb.from("integration_events").select("id", { count: "exact", head: true }).eq("integration_id", id).gte("received_at", since);
    if ((count || 0) > RATE_PER_MIN) return json({ ok: false, error: "Rate limit exceeded" }, 429);
  }

  const safeBody = L.redact(body);                                               // credentials in the payload are never logged or stored
  const log = async (status, message, extra = {}, lead_id = null, payload = safeBody) => {
    try { await sb.from("integration_events").insert({ integration_id: id, status, message, ...L.formInfo(platform, extra), lead_id, payload: L.trimPayload(payload) }); } catch { /* logging must never break capture */ }
  };

  const results = [];
  const items = L.parsePayload(platform, body);
  const failStatus = wantsTest ? "test" : "error";                                // a failed TEST is not a sync error
  if (!items.length) { await log(failStatus, (wantsTest ? "Test: " : "") + "No lead found in the payload"); return json({ ok: false, results: [{ status: "error", message: "No lead found in the payload" }] }, 422); }

  for (const item of items) {
    try {
      if (item.skip) { await log("skipped", item.skip); results.push({ status: "skipped", message: item.skip }); continue; }

      let flat = item.flat, extra = item.extra || {};
      if (item.ref) {                                                               // Meta notification: fetch the lead from the Graph API
        if (wantsTest) { const m = `Meta lead notification recognised (lead ${item.ref.leadgen_id}). Details are fetched from Meta for real leads only.`; await log("test", m, { platform: "fb" }); results.push({ status: "test", message: m }); continue; }
        const { data: tok } = await sb.from("integration_secrets").select("value").eq("integration_id", id).eq("name", "page_access_token").maybeSingle();
        if (!tok) { const m = "Page access token is not set (Integrations → Sync Settings)."; await log("error", m, {}, null, item.ref); results.push({ status: "error", message: m }); continue; }
        const got = await L.fetchMetaLead(item.ref, tok.value); flat = got.flat; extra = got.extra;
      }
      if (extra.is_test) { await log("test", "Google test lead received", extra); results.push({ status: "test", message: "Google test lead received" }); continue; }

      const mapped = L.mapLead(flat, (integ.config || {}).mapping);
      if (!wantsTest && platform === "meta" && (integ.config || {}).accept_test_leads === true && L.isMetaTestLead(flat)) L.applyTestLead(mapped);   // opt-in, off by default
      const v = L.validateLead(mapped);
      if (v.error) { await log(failStatus, (wantsTest ? "Test: " : "") + v.error, extra, null, flat); results.push({ status: "error", message: v.error }); continue; }
      const row = L.buildEnquiryRow({ platform, mapped, phone: v.phone, name: v.name, extra, defaults: integ.config || {}, raw: L.trimPayload(item.ref ? { ref: item.ref, lead: flat } : safeBody) });
      const preview = { name: row.name, phone: row.phone, email: row.email, interest: row.interest, project: row.project, budget: row.budget, location: row.location, source: row.source, form: L.formInfo(platform, extra).form_name };

      if (wantsTest) { await log("test", "Test OK: lead would be created", extra, null, flat); results.push({ status: "test", message: "Test OK: this lead would be created", preview }); continue; }
      if (!integ.auto_capture) { await log("skipped", "Auto Lead Capture is off", extra, null, flat); results.push({ status: "skipped", message: "Auto Lead Capture is off" }); continue; }

      // duplicates: same platform lead id, or the same phone from the same source within the window
      let dup = null;
      if (row.meta_lead_id) { const { data } = await sb.from("enquiries").select("id").eq("meta_lead_id", row.meta_lead_id).limit(1); dup = data && data[0]; }
      if (!dup) { const since = new Date(Date.now() - L.dedupeWindowMinutes(platform) * 60_000).toISOString(); const { data } = await sb.from("enquiries").select("id").eq("phone", row.phone).eq("source", row.source).gte("created_at", since).limit(1); dup = data && data[0]; }
      if (dup) { await log("duplicate", "Duplicate ignored (already captured)", extra, dup.id, flat); results.push({ status: "duplicate", lead_id: dup.id, message: "Duplicate ignored" }); continue; }

      const { data: ins, error } = await sb.from("enquiries").insert(row).select("id").single();
      if (error) { await log("error", "Could not save the lead: " + error.message, extra, null, flat); results.push({ status: "error", message: "Could not save the lead" }); continue; }
      await log("ok", "Lead captured", extra, ins.id, flat);
      await sb.from("integrations").update({ last_event_at: new Date().toISOString(), ...(integ.status === "pending" ? { status: "connected" } : {}) }).eq("id", id);
      results.push({ status: "ok", lead_id: ins.id });
    } catch (e) {
      const m = L.scrub((e && e.message) || e); await log(failStatus, m); results.push({ status: "error", message: m });
    }
  }
  const good = results.some((r) => ["ok", "duplicate", "skipped", "test"].includes(r.status));
  return json({ ok: good, results }, good || platform === "meta" || platform === "whatsapp" ? 200 : 422);   // Meta / WhatsApp retry on non-2xx, so bad data is logged, not retried
});
