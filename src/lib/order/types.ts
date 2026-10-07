// Shared contract between the website and the ordering backend (Supabase RPCs, see supabase/migrations).

/** who is ordering: asked once at the first "Send to kitchen", remembered on the phone */
export type Guest = { phone: string; name?: string; updates: boolean };

export type CartLine = { dishId: string; name: string; price: number; qty: number; note?: string };

export type OrderRequest = {
  branchId: string;
  table: string;
  lines: CartLine[];
  note?: string;
  /** the visit this phone already belongs to, so repeat orders land on the same bill */
  sessionToken?: string;
  /** required unless the table's bill already has a guest number */
  guest?: Guest;
};

export type OrderStage = "received" | "preparing" | "ready" | "served" | "cancelled";
export type VisitStage = "open" | "bill_requested" | "paid" | "closed";

export type OrderReceipt = {
  orderId: string;
  code: string;
  placedAt: string; // ISO time
  total: number;
  etaMinutes: number;
  sessionToken: string;
};

export type VisitOrder = {
  id: string;
  code: string;
  status: OrderStage;
  total: number;
  createdAt: string;
  items: { name: string; qty: number; price: number }[];
};

/** Everything a customer's phone may know about its own table visit. */
export type Visit = {
  status: VisitStage;
  branchId: string;
  branchName: string;
  table: string;
  /** 4-digit PIN that lets another phone join this bill */
  pin?: string;
  /** the bill already has a guest's mobile number (friends who join don't need to give one) */
  hasGuest?: boolean;
  subtotal: number;
  taxPercent: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  openedAt: string;
  feedbackGiven: boolean;
  googleReviewUrl: string | null;
  orders: VisitOrder[];
};

export type Feedback = {
  rating: number;
  food?: number;
  service?: number;
  comment?: string;
  name?: string;
  phone?: string;
};

export type JoinResult =
  | { ok: true; token: string }
  | { ok: false; error: "no_open_bill" | "wrong_pin" | "locked"; triesLeft?: number; retryInSeconds?: number };

export type MenuOverride = { price: number; available: boolean };

export interface OrderApi {
  readonly mode: "mock" | "live";
  placeOrder(req: OrderRequest): Promise<OrderReceipt>;
  getVisit(token: string): Promise<Visit | null>;
  requestBill(token: string): Promise<Visit | null>;
  callWaiter(branchId: string, table: string): Promise<void>;
  /** does this table already have someone's open bill? */
  tableBusy(branchId: string, table: string): Promise<boolean>;
  /** join the table's open bill with its PIN (new phone, cleared browser, a friend) */
  joinTable(branchId: string, table: string, pin: string): Promise<JoinResult>;
  submitFeedback(token: string, fb: Feedback): Promise<{ googleReviewUrl: string | null; branchName: string }>;
  googleClicked(token: string): Promise<void>;
  /** live prices + sold-out flags from the kitchen; empty in demo mode */
  menuOverrides(): Promise<Record<string, MenuOverride>>;
}
