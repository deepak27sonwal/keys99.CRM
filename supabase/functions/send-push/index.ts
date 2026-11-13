// @ts-nocheck
// send-push: sends a browser (Web Push) notification to every device that turned notifications on.
//  - called by the database trigger enquiries_send_push for every new lead (header x-enquiry-secret, the same shared secret as the lead email), or
//  - called by a signed-in CRM user with { "test": true } to send a test notification to their OWN devices only.
// The Web Push (VAPID) key pair is created by this function on first use and kept in the private table push_keys (service role only), so the private key never leaves the server.
// GET returns the PUBLIC key, which browsers need to subscribe. Optional secret: VAPID_SUBJECT (a mailto: address).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import * as L from "./lib.js";

const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, x-enquiry-secret, apikey", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });
let cachedSecret = null;
const sharedSecret = async () => { if (!cachedSecret) { const { data } = await sb.rpc("get_enquiry_email_secret"); cachedSecret = data || null; } return cachedSecret; };

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function vapidKeys() {
  const read = async () => { const { data } = await sb.from("push_keys").select("public_key,private_key").eq("id", 1).maybeSingle(); return data; };
  let k = await read(); if (k) return k;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey), raw = await crypto.subtle.exportKey("raw", pair.publicKey);
  await sb.from("push_keys").insert({ id: 1, public_key: b64u(raw), private_key: jwk.d });     // if two calls race, the second insert fails and we read the winner below
  return await read();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method === "GET") { const k = await vapidKeys(); return k ? json({ ok: true, publicKey: k.public_key }) : json({ ok: false, error: "Push keys unavailable" }, 500); }
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const keys = await vapidKeys(), subject = Deno.env.get("VAPID_SUBJECT") || "mailto:sales.housingmantra@gmail.com";
  if (!keys) return json({ ok: false, error: "Push keys unavailable" }, 500);
  const pub = keys.public_key, priv = keys.private_key;
  let body = {}; try { body = await req.json(); } catch { /* empty body */ }

  // who is calling?
  const secret = req.headers.get("x-enquiry-secret"), expected = secret ? await sharedSecret() : null;
  const fromTrigger = !!secret && !!expected && secret === expected;
  let user = null;
  if (!fromTrigger) {
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (bearer) { const { data } = await sb.auth.getUser(bearer); user = data && data.user; }
    if (!user) return json({ ok: false, error: "Unauthorized" }, 401);
    if (body.test !== true) return json({ ok: false, error: "Signed-in users can only send a test" }, 403);
  }

  let payload, subsQuery = sb.from("push_subscriptions").select("id,endpoint,p256dh,auth").limit(500);
  if (fromTrigger) {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "Missing enquiry id" }, 400);
    const { data: row } = await sb.from("enquiries").select("id,name,project,source,manager_name").eq("id", id).maybeSingle();
    if (!row) return json({ ok: false, error: "Enquiry not found" }, 404);
    payload = L.buildPayload(row);
  } else { payload = L.testPayload(); subsQuery = subsQuery.eq("user_id", user.id); }

  const { data: subs } = await subsQuery;
  if (!subs || !subs.length) return json({ ok: true, sent: 0, removed: 0, note: "No devices have notifications turned on" });
  webpush.setVapidDetails(subject, pub, priv);
  const text = JSON.stringify(payload); let sent = 0, failed = 0; const gone = [];
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, text, { TTL: 3600, urgency: "high", timeout: 8000 }); sent++; }
    catch (e) { if (L.isGone(e)) gone.push(s.id); else { failed++; console.error("push failed", e && e.statusCode, String((e && e.body) || (e && e.message) || "").slice(0, 120)); } }
  }));
  if (gone.length) await sb.from("push_subscriptions").delete().in("id", gone);
  return json({ ok: true, sent, failed, removed: gone.length });
});
