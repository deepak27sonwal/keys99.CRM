// Pure checks for the employee-admin function (unit tested in Node, used by Deno).
export const MIN_PASSWORD = 10;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// A temporary password must be long enough and not trivially weak.
export function passwordProblem(pw) {
  const p = String(pw ?? "");
  if (p.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`;
  if (p.length > 72) return "Password is too long (72 characters at most)";
  if (/^\s|\s$/.test(p)) return "Password must not start or end with a space";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Password needs letters and numbers";
  return "";
}

// Returns { error } or { value } for an action request body.
export function parseAction(body) {
  const b = body && typeof body === "object" ? body : {};
  const action = String(b.action || "");
  const member_id = Number(b.member_id);
  const needMember = () => (Number.isInteger(member_id) && member_id > 0 ? "" : "Pick a team member");
  switch (action) {
    case "create": {
      const email = String(b.email || "").trim().toLowerCase();
      if (needMember()) return { error: needMember() };
      if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address" };
      const pe = passwordProblem(b.password); if (pe) return { error: pe };
      return { value: { action, member_id, email, password: String(b.password) } };
    }
    case "reset-password": {
      if (needMember()) return { error: needMember() };
      const pe = passwordProblem(b.password); if (pe) return { error: pe };
      return { value: { action, member_id, password: String(b.password) } };
    }
    case "change-email": {
      const email = String(b.email || "").trim().toLowerCase();
      if (needMember()) return { error: needMember() };
      if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address" };
      if (email.length > 254) return { error: "That email address is too long" };
      return { value: { action, member_id, email } };
    }
    case "disable": case "enable": case "remove":
      if (needMember()) return { error: needMember() };
      return { value: { action, member_id } };
    default: return { error: "Unknown action" };
  }
}

// Which users get a new-lead push: every active admin plus the employee that owns the lead.
export function pushRecipients(appUsers, members, ownerName) {
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const owner = norm(ownerName), byId = new Map((members || []).map((m) => [m.id, m]));
  return (appUsers || []).filter((u) => u.active && (u.role === "admin" || (owner && u.member_id && byId.get(u.member_id) && norm(byId.get(u.member_id).name) === owner))).map((u) => u.user_id);
}
