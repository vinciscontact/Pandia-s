import type { Feedback, JoinResult, OrderApi, OrderReceipt, OrderRequest, OrderStage, Visit } from "./types";
import { hasBackend, sb } from "../supabase";

// ---------------------------------------------------------------- live (Supabase)
const liveApi: OrderApi = {
  mode: "live",
  async placeOrder(req: OrderRequest) {
    const { data, error } = await sb().rpc("place_order", {
      p_branch: req.branchId,
      p_table: req.table,
      p_lines: req.lines.map((l) => ({ id: l.dishId, qty: l.qty })), // prices are decided by the server
      p_note: req.note ?? null,
      p_token: req.sessionToken ?? null,
      p_phone: req.guest?.phone ?? null,
      p_name: req.guest?.name ?? null,
      p_updates: req.guest?.updates ?? false,
    });
    if (error) throw error;
    return data as OrderReceipt;
  },
  async getVisit(token) {
    const { data, error } = await sb().rpc("get_table_status", { p_token: token });
    if (error) throw error;
    return (data as Visit) ?? null;
  },
  async requestBill(token) {
    const { data, error } = await sb().rpc("request_bill", { p_token: token });
    if (error) throw error;
    return (data as Visit) ?? null;
  },
  async callWaiter(branchId, table) {
    const { error } = await sb().rpc("call_waiter", { p_branch: branchId, p_table: table });
    if (error) throw error;
  },
  async tableBusy(branchId, table) {
    const { data, error } = await sb().rpc("table_state", { p_branch: branchId, p_table: table });
    if (error) throw error;
    return Boolean((data as { busy: boolean })?.busy);
  },
  async joinTable(branchId, table, pin) {
    const { data, error } = await sb().rpc("join_table", { p_branch: branchId, p_table: table, p_pin: pin });
    if (error) throw error;
    return data as JoinResult;
  },
  async submitFeedback(token, fb) {
    const { data, error } = await sb().rpc("submit_feedback", {
      p_token: token,
      p_rating: fb.rating,
      p_food: fb.food ?? null,
      p_service: fb.service ?? null,
      p_comment: fb.comment ?? null,
      p_name: fb.name ?? null,
      p_phone: fb.phone ?? null,
    });
    if (error) throw error;
    return data as { googleReviewUrl: string | null; branchName: string };
  },
  async googleClicked(token) {
    await sb().rpc("mark_google_clicked", { p_token: token });
  },
  async menuOverrides() {
    const { data, error } = await sb().from("menu_items").select("id, price, available");
    if (error) throw error;
    return Object.fromEntries((data || []).map((r) => [r.id, { price: Number(r.price), available: r.available }]));
  },
};

// ---------------------------------------------------------------- mock (demo, no backend configured)
const STAGES: [OrderStage, number][] = [
  ["received", 0],
  ["preparing", 8],
  ["ready", 30],
  ["served", 50],
];
const MOCK_KEY = "pd-mock-visit-";
type MockVisit = Visit & { _times: Record<string, number> };
const mockLoad = (t: string): MockVisit | null => {
  try {
    return JSON.parse(sessionStorage.getItem(MOCK_KEY + t) || "null");
  } catch {
    return null;
  }
};
const mockSave = (t: string, v: MockVisit) => {
  try {
    sessionStorage.setItem(MOCK_KEY + t, JSON.stringify(v));
  } catch {}
};
const mockRefresh = (v: MockVisit) => {
  for (const o of v.orders) {
    const secs = (Date.now() - v._times[o.id]) / 1000;
    o.status = [...STAGES].reverse().find(([, t]) => secs >= t)![0];
  }
  v.subtotal = v.orders.reduce((s, o) => s + o.total, 0);
  v.tax = Math.round(v.subtotal * v.taxPercent) / 100;
  v.total = Math.round(v.subtotal + v.tax);
  return v;
};

const mockApi: OrderApi = {
  mode: "mock",
  async placeOrder(req) {
    await new Promise((r) => setTimeout(r, 600));
    const token = req.sessionToken || crypto.randomUUID();
    const v: MockVisit = mockLoad(token) || {
      status: "open", branchId: req.branchId, branchName: req.branchId, table: req.table,
      subtotal: 0, taxPercent: 5, tax: 0, discount: 0, total: 0, paid: 0,
      openedAt: new Date().toISOString(), feedbackGiven: false, googleReviewUrl: null, orders: [], _times: {},
    };
    const total = req.lines.reduce((s, l) => s + l.price * l.qty, 0);
    const id = crypto.randomUUID();
    const code = "D-" + String(v.orders.length + 101);
    v.orders.push({
      id, code, status: "received", total, createdAt: new Date().toISOString(),
      items: req.lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
    });
    v._times[id] = Date.now();
    v.status = "open";
    mockSave(token, mockRefresh(v));
    return { orderId: id, code, total, placedAt: new Date().toISOString(), etaMinutes: 15, sessionToken: token } satisfies OrderReceipt;
  },
  async getVisit(token) {
    const v = mockLoad(token);
    return v ? mockRefresh(v) : null;
  },
  async requestBill(token) {
    const v = mockLoad(token);
    if (!v) return null;
    v.status = "bill_requested";
    mockSave(token, v);
    return mockRefresh(v);
  },
  async callWaiter() {
    await new Promise((r) => setTimeout(r, 400));
  },
  async tableBusy() {
    return false; // demo visits live only on this phone
  },
  async joinTable() {
    return { ok: false, error: "no_open_bill" };
  },
  async submitFeedback(token) {
    const v = mockLoad(token);
    if (v) (v.feedbackGiven = true), mockSave(token, v);
    return { googleReviewUrl: null, branchName: v?.branchName || "" };
  },
  async googleClicked() {},
  async menuOverrides() {
    return {};
  },
};

export const orderApi: OrderApi = hasBackend ? liveApi : mockApi;
