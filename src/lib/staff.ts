// Chef Magic: shared bits for the staff screens (kitchen, desk, admin).
import { sb, hasBackend, friendlyError } from "./supabase";

export type Role = "admin" | "manager" | "kitchen" | "cashier";
export type Staff = { user_id: string; name: string; email: string | null; role: Role; branch_id: string | null; active: boolean };
export type Branch = { id: string; name: string; google_review_url: string | null; tax_percent: number; active: boolean; sort: number };

export { sb, friendlyError };

export const ROLE_LABEL: Record<Role, string> = { admin: "Owner", manager: "Manager", kitchen: "Kitchen", cashier: "Cashier" };

/** Which screens each role may open. The database enforces the same rules; this only shapes the UI. */
export const SCREENS: { path: string; label: string; icon: string; roles: Role[] }[] = [
  { path: "/chef/kitchen", label: "Kitchen", icon: "pot", roles: ["kitchen", "manager", "admin"] },
  { path: "/chef/desk", label: "Desk", icon: "wallet", roles: ["cashier", "manager", "admin"] },
  { path: "/chef/admin", label: "Dashboard", icon: "chart", roles: ["manager", "admin"] },
];
export const homeFor = (r: Role) => SCREENS.find((s) => s.roles.includes(r))!.path;

export async function getMe(): Promise<Staff | null> {
  if (!hasBackend) return null;
  const { data: auth } = await sb().auth.getSession();
  if (!auth.session) return null;
  const { data } = await sb().from("staff").select("user_id, name, email, role, branch_id, active").eq("user_id", auth.session.user.id).maybeSingle();
  return data && data.active ? (data as Staff) : null;
}

export async function loadBranches(): Promise<Branch[]> {
  const { data, error } = await sb().from("branches").select("*").order("sort");
  if (error) throw error;
  return (data || []) as Branch[];
}

const BRANCH_KEY = "pd-staff-branch";

// Leaving the page: park the caller forever instead of throwing, so the console stays clean.
const halt = () => new Promise<never>(() => {});

/**
 * Guard a staff page: sends signed-out people to the Chef Magic login and wrong roles to their own screen.
 * Fills the shared top bar and returns who is here and which branch they're looking at.
 */
export async function initStaffPage(allowed: Role[], opts: { allowAllBranches?: boolean } = {}) {
  const me = await getMe();
  if (!me) {
    location.replace("/chef?next=" + encodeURIComponent(location.pathname));
    return halt();
  }
  if (!allowed.includes(me.role)) {
    location.replace(homeFor(me.role));
    return halt();
  }
  const branches = (await loadBranches()).filter((b) => b.active || me.role === "admin");

  // top bar
  const bar = document.querySelector<HTMLElement>("[data-staffbar]")!;
  bar.querySelector("[data-me]")!.textContent = `${me.name} · ${ROLE_LABEL[me.role]}`;
  bar.querySelectorAll<HTMLAnchorElement>("[data-screen]").forEach((a) => {
    const s = SCREENS.find((x) => x.path === a.getAttribute("href"))!;
    a.hidden = !s.roles.includes(me.role);
    if (location.pathname.replace(/\/$/, "") === s.path) a.setAttribute("aria-current", "page");
  });
  bar.querySelector("[data-logout]")!.addEventListener("click", async () => {
    await sb().auth.signOut();
    location.replace("/chef");
  });

  // branch: fixed for branch staff, switchable for the owner
  const sel = bar.querySelector<HTMLSelectElement>("[data-branch-select]")!;
  let branch: string;
  if (me.role === "admin") {
    const saved = localStorage.getItem(BRANCH_KEY) || "";
    const opts2 = opts.allowAllBranches ? [{ id: "", name: "All branches" }, ...branches] : branches;
    sel.innerHTML = opts2.map((b) => `<option value="${b.id}">${b.name}</option>`).join("");
    branch = opts2.some((b) => b.id === saved) ? saved : opts2[0].id;
    sel.value = branch;
    sel.hidden = false;
  } else {
    branch = me.branch_id!;
    bar.querySelector("[data-branch-fixed]")!.textContent = branches.find((b) => b.id === branch)?.name || branch;
  }
  const listeners: ((b: string) => void)[] = [];
  sel.addEventListener("change", () => {
    branch = sel.value;
    try {
      localStorage.setItem(BRANCH_KEY, branch);
    } catch {}
    listeners.forEach((f) => f(branch));
  });

  document.documentElement.classList.add("staff-ready");
  return {
    me,
    branches,
    get branch() {
      return branch;
    },
    onBranchChange: (f: (b: string) => void) => listeners.push(f),
    branchName: (id: string) => branches.find((b) => b.id === id)?.name || id,
  };
}

// ---------------------------------------------------------------- small helpers
export const rupee = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
export const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const minsSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));

/** Midnight (IST) N days ago, as ISO. Day boundaries follow the restaurant, not the device. */
export function istDayStart(daysAgo = 0) {
  const now = new Date(Date.now() + 5.5 * 3600e3); // shift to IST wall clock
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - daysAgo);
  return new Date(now.getTime() - 5.5 * 3600e3).toISOString();
}

export function toast(msg: string, kind: "ok" | "err" = "ok") {
  let t = document.querySelector<HTMLElement>(".s-toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "s-toast";
    t.setAttribute("role", "status");
    document.body.append(t);
  }
  t.textContent = msg;
  t.dataset.kind = kind;
  t.classList.add("show");
  clearTimeout((t as any)._t);
  (t as any)._t = setTimeout(() => t!.classList.remove("show"), 2800);
}

/** Run a staff action with a busy button and friendly errors. */
export async function act<T>(btn: HTMLButtonElement | null, fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
  if (btn) btn.disabled = true;
  try {
    const r = await fn();
    if (ok) toast(ok);
    return r;
  } catch (e) {
    console.error(e);
    toast(friendlyError(e), "err");
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** A short two-tone chime for new orders / calls. Browsers need one tap first to allow sound. */
let audio: AudioContext | null = null;
export const sound = {
  get on() {
    return !!audio && audio.state === "running";
  },
  async enable() {
    audio ??= new AudioContext();
    await audio.resume();
  },
  chime(times = 1) {
    if (!audio || audio.state !== "running") return;
    for (let k = 0; k < times; k++)
      [880, 1320].forEach((f, i) => {
        const o = audio!.createOscillator();
        const g = audio!.createGain();
        const t = audio!.currentTime + k * 0.45 + i * 0.16;
        o.frequency.value = f;
        o.type = "sine";
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(audio!.destination);
        o.start(t);
        o.stop(t + 0.4);
      });
  },
};
