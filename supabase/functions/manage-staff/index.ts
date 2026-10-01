// Staff accounts for Chef Magic. Only an active admin may call this.
// Actions:
//   { action: "create", email, password, name, role, branch_id? }
//   { action: "update", user_id, name?, role?, branch_id?, active? }
//   { action: "password", user_id, password }
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ROLES = ["admin", "manager", "kitchen", "cashier"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // who is calling?
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: caller } = await admin.auth.getUser(jwt);
  if (!caller?.user) return json({ error: "unauthorized" }, 401);
  const { data: me } = await admin.from("staff").select("role, active").eq("user_id", caller.user.id).maybeSingle();
  if (!me || !me.active || me.role !== "admin") return json({ error: "forbidden" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : undefined);
  const role = str("role");
  const branch = str("branch_id") || null;
  if (role && !ROLES.includes(role)) return json({ error: "bad_role" }, 400);
  if (role && role !== "admin" && !branch) return json({ error: "branch_required" }, 400);

  if (body.action === "create") {
    const email = str("email")?.toLowerCase();
    const password = str("password");
    const name = str("name");
    if (!email || !name || !role) return json({ error: "missing_fields" }, 400);
    if (!password || password.length < 8) return json({ error: "password_too_short" }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
    if (error) return json({ error: error.message }, 400);
    const { error: e2 } = await admin
      .from("staff")
      .insert({ user_id: data.user.id, name, email, role, branch_id: role === "admin" ? null : branch });
    if (e2) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json({ error: e2.message }, 400);
    }
    return json({ ok: true, user_id: data.user.id });
  }

  if (body.action === "update") {
    const id = str("user_id");
    if (!id) return json({ error: "missing_user" }, 400);
    if (id === caller.user.id && (body.active === false || (role && role !== "admin")))
      return json({ error: "cannot_demote_yourself" }, 400);
    const patch: Record<string, unknown> = {};
    if (str("name")) patch.name = str("name");
    if (role) {
      patch.role = role;
      patch.branch_id = role === "admin" ? null : branch;
    } else if (branch) patch.branch_id = branch;
    if (typeof body.active === "boolean") patch.active = body.active;
    const { error } = await admin.from("staff").update(patch).eq("user_id", id);
    if (error) return json({ error: error.message }, 400);
    // a deactivated account is also blocked from signing in (and un-blocked when reactivated)
    if (typeof body.active === "boolean")
      await admin.auth.admin.updateUserById(id, { ban_duration: body.active ? "none" : "876000h" });
    return json({ ok: true });
  }

  if (body.action === "password") {
    const id = str("user_id");
    const password = str("password");
    if (!id) return json({ error: "missing_user" }, 400);
    if (!password || password.length < 8) return json({ error: "password_too_short" }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
