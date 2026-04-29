const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

// Production backend hosted on Render.
const RENDER_BACKEND = "https://the-terminal-meridian.onrender.com";

function resolveApiBase() {
  if (typeof window === "undefined") return "";

  // 1. Explicit override (DevTools: localStorage.setItem("meridian.api-base", "..."))
  const override = window.MERIDIAN_API_BASE || window.localStorage.getItem("meridian.api-base") || "";
  if (override) return String(override).replace(/\/$/, "");

  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === "127.0.0.1" || hostname === "localhost";

  // 2. Local dev — backend on 4173
  if (isLocal && port && port !== "4173") {
    return `${protocol}//${hostname}:4173`;
  }

  // 3. GitHub Pages (or any non-local origin) → use Render backend
  if (!isLocal) {
    return RENDER_BACKEND;
  }

  return "";
}

const API_BASE = resolveApiBase();

function buildApiUrl(path) {
  return `${API_BASE}${path}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? payload.error : `Request failed with ${response.status}`;
    throw new Error(String(message));
  }

  return payload;
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {}),
    },
  });

  return parseResponse(response);
}

export const authApi = {
  signup(payload) {
    return apiRequest("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return apiRequest("/api/auth/logout", { method: "POST" });
  },
  session() {
    return apiRequest("/api/auth/session");
  },
  checkAvailability({ email = "", username = "" } = {}) {
    const query = new URLSearchParams();
    if (email) query.set("email", email);
    if (username) query.set("username", username);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/api/auth/availability${suffix}`);
  },
  updateProfile(payload) {
    return apiRequest("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  changePassword(payload) {
    return apiRequest("/api/auth/password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  deleteAccount(payload) {
    return apiRequest("/api/auth/account", {
      method: "DELETE",
      body: JSON.stringify(payload),
    });
  },
};

export const workspaceApi = {
  get() {
    return apiRequest("/api/workspace");
  },
  save(workspace) {
    return apiRequest("/api/workspace", {
      method: "PUT",
      body: JSON.stringify(workspace),
    });
  },
};

export const marketApi = {
  quotes(symbols) {
    const encoded = encodeURIComponent(symbols.join(","));
    return apiRequest(`/api/market/quotes?symbols=${encoded}`);
  },
  overview(symbols = []) {
    const encoded = encodeURIComponent(symbols.join(","));
    const suffix = encoded ? `?symbols=${encoded}` : "";
    return apiRequest(`/api/market/overview${suffix}`);
  },
  chart(symbol, range = "1mo", interval = "1d") {
    return apiRequest(`/api/market/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`);
  },
  options(symbol, date) {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiRequest(`/api/market/options/${encodeURIComponent(symbol)}${suffix}`);
  },
  news() {
    return apiRequest("/api/market/news");
  },
  deepDive(symbol) {
    return apiRequest(`/api/market/deep-dive/${encodeURIComponent(symbol)}`);
  },
  fx() {
    return apiRequest("/api/market/fx");
  },
  health() {
    return apiRequest("/api/ready");
  },
  screenerUniverse() {
    return apiRequest("/api/screener/universe");
  },
  yields() {
    return apiRequest("/api/macro/yields");
  },
};

export const paperApi = {
  account() {
    return apiRequest("/api/paper/account");
  },
  order(payload) {
    return apiRequest("/api/paper/order", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  placePendingOrder(payload) {
    return apiRequest("/api/paper/pending-order", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  cancelPendingOrder(id) {
    return apiRequest(`/api/paper/pending-order/${id}`, { method: "DELETE" });
  },
  reset() {
    return apiRequest("/api/paper/reset", { method: "POST" });
  },
  achievements() {
    return apiRequest("/api/achievements");
  },
};

export const aiApi = {
  status() {
    return apiRequest("/api/ai/status");
  },
  commentary(symbol) {
    return apiRequest(`/api/ai/commentary?symbol=${encodeURIComponent(symbol)}`);
  },
  marketPulse() {
    return apiRequest("/api/ai/market-pulse");
  },
};

export const billingApi = {
  status() {
    return apiRequest("/api/billing/status");
  },
  createCheckoutSession({ plan, interval = "monthly" } = {}) {
    return apiRequest("/api/billing/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({ plan, interval }),
    });
  },
  createPortalSession() {
    return apiRequest("/api/billing/create-portal-session", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};

export const uiCache = {
  key: "the-terminal.ui-cache.v2",
  read() {
    try {
      const raw = window.localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },
  write(value) {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(value));
    } catch {
      // Private browsing, storage quota exceeded, or Safari ITP — degrade
      // gracefully. The app still works; state just won't survive a reload.
    }
  },
};
