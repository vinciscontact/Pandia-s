import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined;

export const hasBackend = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
/** One shared client per page. Staff sessions persist in localStorage; customers never sign in. */
export function sb(): SupabaseClient {
  if (!hasBackend) throw new Error("Supabase is not configured (PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_KEY)");
  return (client ??= createClient(URL!, KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "pd-staff-auth" },
  }));
}

/** Turn database error codes raised by our functions into words a person can act on. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message || String(e);
  const map: Record<string, string> = {
    unknown_table: "We couldn't find this table. Please scan the QR again.",
    phone_required: "Please add your mobile number so we can send your order.",
    bad_phone: "That mobile number doesn't look right. Use a 10-digit Indian number.",
    too_fast: "Hold on a second, your last order is still being sent.",
    too_many_orders: "This table has a lot of orders. Please ask your server.",
    bad_qty: "Up to 30 of one dish per order, please.",
    forbidden: "You don't have access to do that.",
    unpaid: "This bill isn't paid yet. A manager can close it.",
    nothing_due: "Nothing left to pay on this bill.",
    session_closed: "This table is already closed.",
    bad_discount: "Discount can't be more than the bill.",
    "Invalid login credentials": "Wrong email or password.",
  };
  for (const [k, v] of Object.entries(map)) if (msg.includes(k)) return v;
  if (msg.startsWith("unavailable:")) return `${msg.split(":")[1]} just sold out. Please remove it and try again.`;
  if (msg.includes("unavailable")) return "One of the dishes just sold out. Please remove it and try again.";
  return "Something went wrong. Please try again.";
}
