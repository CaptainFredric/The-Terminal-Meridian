# Frontend services and data

Copy-paste packet generated from the current workspace state.

## Included Files

- `src/api.js`
- `src/data.js`
- `src/services.js`
- `src/marketService.js`

---

## `src/api.js`

````javascript
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

function resolveApiBase() {
  if (typeof window === "undefined") return "";

  const override = window.MERIDIAN_API_BASE || window.localStorage.getItem("meridian.api-base") || "";
  if (override) return String(override).replace(/\/$/, "");

  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === "127.0.0.1" || hostname === "localhost";
  if (isLocal && port && port !== "4173") {
    return `${protocol}//${hostname}:4173`;
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
    return apiRequest("/api/health");
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
    window.localStorage.setItem(this.key, JSON.stringify(value));
  },
};
````

## `src/data.js`

````javascript
export const appName = "Meridian";

export const authRoles = [
  "Portfolio Manager",
  "Research Analyst",
  "Quant Developer",
  "Macro Trader",
  "Independent Investor",
  "Other",
];

export const functionKeys = [
  { key: "F1", module: "briefing", label: "Briefing" },
  { key: "F2", module: "home", label: "Home" },
  { key: "F3", module: "quote", label: "Quote" },
  { key: "F4", module: "chart", label: "Chart" },
  { key: "F5", module: "news", label: "News" },
  { key: "F6", module: "screener", label: "Screener" },
  { key: "F7", module: "heatmap", label: "Heatmap" },
  { key: "F8", module: "portfolio", label: "Portfolio" },
  { key: "F9", module: "macro", label: "Macro" },
  { key: "F10", module: "options", label: "Options" },
  { key: "F11", module: "calculator", label: "Calculator" },
];

export const moduleOrder = ["briefing", "home", "quote", "chart", "news", "screener", "heatmap", "portfolio", "macro", "options", "calculator"];

export const moduleTitles = {
  briefing: "Briefing",
  home: "Home",
  quote: "Quote",
  chart: "Chart",
  news: "News",
  screener: "Screener",
  heatmap: "Heatmap",
  portfolio: "Portfolio",
  macro: "Macro",
  options: "Options",
  calculator: "Calculator",
};

export const commandCatalog = [
  { cmd: "HELP", desc: "See available commands" },
  { cmd: "REFRESH", desc: "Refresh market data" },
  { cmd: "SAVE", desc: "Save your current workspace" },
  { cmd: "GRID", desc: "Return to the full panel grid" },
  { cmd: "FOCUS 2", desc: "Focus panel 2" },
  { cmd: "NEXT", desc: "Move to the next module" },
  { cmd: "PREV", desc: "Move to the previous module" },
  { cmd: "RANGE 1Y", desc: "Set chart range" },
  { cmd: "BRIEF", desc: "Open the Meridian briefing" },
  { cmd: "HOME", desc: "Open the home view" },
  { cmd: "SUGGEST", desc: "Show suggested next steps" },
  { cmd: "NEWS", desc: "Open the news view" },
  { cmd: "NEWS NVDA", desc: "Filter news for NVDA" },
  { cmd: "ANALYZE NVDA", desc: "Load deep insight for NVDA" },
  { cmd: "SYNC NVDA", desc: "Save NVDA into your workspace" },
  { cmd: "PORT", desc: "Open the portfolio view" },
  { cmd: "MACRO", desc: "Open the macro view" },
  { cmd: "AAPL Q", desc: "Open quote for AAPL" },
  { cmd: "AAPL CHART", desc: "Open chart for AAPL" },
  { cmd: "WATCH TSLA", desc: "Add TSLA to watchlist" },
  { cmd: "ALERT NVDA 950", desc: "Create an alert level" },
  { cmd: "ADDPOS MSFT 5 410", desc: "Add a portfolio position" },
  { cmd: "OPTIONS NVDA", desc: "Open options for NVDA" },
];

export const calculatorDefaults = {
  option: { spot: 100, strike: 105, years: 0.5, rate: 5, volatility: 25 },
  bond: { face: 1000, coupon: 5, ytm: 4.5, maturity: 10, frequency: 2 },
};

export const defaultWatchlist = ["AAPL", "MSFT", "NVDA", "QQQ", "TSLA", "BTC-USD"];

export const defaultPositions = [
  { symbol: "NVDA", shares: 8, cost: 815.12 },
  { symbol: "QQQ", shares: 12, cost: 418.45 },
];

export const defaultAlerts = [
  { symbol: "NVDA", operator: ">=", threshold: 950, status: "watching" },
  { symbol: "TSLA", operator: "<=", threshold: 180, status: "watching" },
];

export const macroDefaults = {
  currencies: ["EUR", "GBP", "JPY", "CAD", "CHF", "AUD"],
  curve: [
    { tenor: "1M", yield: 5.31 },
    { tenor: "3M", yield: 5.26 },
    { tenor: "6M", yield: 5.17 },
    { tenor: "1Y", yield: 4.95 },
    { tenor: "2Y", yield: 4.58 },
    { tenor: "5Y", yield: 4.23 },
    { tenor: "10Y", yield: 4.18 },
    { tenor: "30Y", yield: 4.29 },
  ],
};

export const heatmapGroups = {
  Technology: ["AAPL", "MSFT", "NVDA", "AMD", "AVGO", "QCOM"],
  Growth: ["TSLA", "PLTR", "CRWD", "ABNB", "UBER", "COIN"],
  Macro: ["SPY", "QQQ", "IWM", "BTC-USD", "ETH-USD", "TLT"],
};

const defaultUniverse = [
  ["AAPL", "Apple", "Information Technology", "S&P 500", 214.72, 2860000000000],
  ["MSFT", "Microsoft", "Information Technology", "S&P 500", 427.35, 3180000000000],
  ["NVDA", "NVIDIA", "Information Technology", "S&P 500", 903.12, 2220000000000],
  ["TSLA", "Tesla", "Consumer Discretionary", "S&P 500", 196.72, 640000000000],
  ["AMZN", "Amazon", "Consumer Discretionary", "S&P 500", 188.61, 1980000000000],
  ["GOOGL", "Alphabet", "Communication Services", "S&P 500", 172.8, 2120000000000],
  ["META", "Meta", "Communication Services", "S&P 500", 501.12, 1290000000000],
  ["AMD", "AMD", "Information Technology", "S&P 500", 178.44, 289000000000],
  ["QCOM", "Qualcomm", "Information Technology", "S&P 500", 170.15, 189000000000],
  ["AVGO", "Broadcom", "Information Technology", "S&P 500", 1328.17, 617000000000],
  ["PLTR", "Palantir", "Information Technology", "Growth", 31.48, 68000000000],
  ["COIN", "Coinbase", "Financials", "Growth", 258.38, 62000000000],
  ["ABNB", "Airbnb", "Consumer Discretionary", "Growth", 166.12, 106000000000],
  ["UBER", "Uber", "Industrials", "Growth", 77.44, 161000000000],
  ["CRWD", "CrowdStrike", "Information Technology", "Growth", 323.14, 79000000000],
  ["SPY", "SPDR S&P 500", "ETF", "ETF", 513.91, 0],
  ["QQQ", "Invesco QQQ", "ETF", "ETF", 441.37, 0],
  ["IWM", "iShares Russell 2000", "ETF", "ETF", 205.12, 0],
  ["TLT", "iShares 20Y Treasury", "ETF", "ETF", 92.61, 0],
  ["BTC-USD", "Bitcoin", "Cryptocurrency", "Crypto", 68420, 0],
  ["ETH-USD", "Ethereum", "Cryptocurrency", "Crypto", 3718, 0],
];

export function buildUniverse() {
  return defaultUniverse.map(([symbol, name, sector, universe, seedPrice, marketCap]) => ({
    symbol,
    name,
    sector,
    universe,
    exchange: universe === "S&P 500" ? "NYSE/NASDAQ" : universe,
    seedPrice,
    marketCap,
  }));
}
````

## `src/services.js`

````javascript
const DIRECT_TIMEOUT = 12000;
const PROXY_GET = "https://api.allorigins.win/get?url=";
const PROXY_RAW = "https://api.allorigins.win/raw?url=";
const QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=";
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const OPTIONS_URL = "https://query1.finance.yahoo.com/v7/finance/options/";
const RSS_TO_JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const FX_URL = "https://open.er-api.com/v6/latest/USD";

function withTimeout(promise, timeout = DIRECT_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out.")), timeout)),
  ]);
}

async function fetchText(url) {
  const strategies = [
    () => fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Direct fetch failed: ${response.status}`);
      return response.text();
    }),
    () => fetch(`${PROXY_RAW}${encodeURIComponent(url)}`).then((response) => {
      if (!response.ok) throw new Error(`Raw proxy failed: ${response.status}`);
      return response.text();
    }),
    () => fetch(`${PROXY_GET}${encodeURIComponent(url)}`).then(async (response) => {
      if (!response.ok) throw new Error(`Wrapped proxy failed: ${response.status}`);
      const payload = await response.json();
      if (!payload.contents) throw new Error("Wrapped proxy had no contents.");
      return payload.contents;
    }),
  ];

  let lastError = null;
  for (const strategy of strategies) {
    try {
      return await withTimeout(strategy());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to fetch remote data.");
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

export async function fetchQuotes(symbols) {
  const clean = [...new Set(symbols.filter(Boolean))];
  if (!clean.length) {
    return [];
  }

  const payload = await fetchJson(`${QUOTE_URL}${encodeURIComponent(clean.join(","))}`);
  const results = payload?.quoteResponse?.result ?? [];
  return results.map((item) => ({
    symbol: item.symbol,
    name: item.shortName ?? item.longName ?? item.symbol,
    exchange: item.fullExchangeName ?? item.exchange ?? "N/A",
    price: item.regularMarketPrice ?? item.postMarketPrice ?? item.bid ?? 0,
    changePct: item.regularMarketChangePercent ?? 0,
    change: item.regularMarketChange ?? 0,
    marketCap: item.marketCap ?? 0,
    volume: item.regularMarketVolume ?? 0,
    dayHigh: item.regularMarketDayHigh ?? item.regularMarketPrice ?? 0,
    dayLow: item.regularMarketDayLow ?? item.regularMarketPrice ?? 0,
    previousClose: item.regularMarketPreviousClose ?? item.regularMarketPrice ?? 0,
    currency: item.currency ?? "USD",
  }));
}

export async function fetchChart(symbol, range = "1mo", interval = "1d") {
  const payload = await fetchJson(`${CHART_URL}${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false`);
  const result = payload?.chart?.result?.[0];
  if (!result) {
    return [];
  }

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const closes = quote.close ?? [];

  return timestamps
    .map((timestamp, index) => ({
      timestamp,
      close: closes[index],
    }))
    .filter((item) => item.close != null);
}

export async function fetchOptions(symbol, expirationDate) {
  const suffix = expirationDate ? `?date=${encodeURIComponent(expirationDate)}` : "";
  const payload = await fetchJson(`${OPTIONS_URL}${encodeURIComponent(symbol)}${suffix}`);
  const result = payload?.optionChain?.result?.[0];
  if (!result) {
    return { expirations: [], calls: [], puts: [], spot: 0 };
  }

  const optionSet = result.options?.[0] ?? { calls: [], puts: [] };
  return {
    expirations: result.expirationDates ?? [],
    calls: (optionSet.calls ?? []).slice(0, 18),
    puts: (optionSet.puts ?? []).slice(0, 18),
    spot: result.quote?.regularMarketPrice ?? 0,
  };
}

export async function fetchNews() {
  const feeds = [
    "https://feeds.reuters.com/reuters/businessNews",
    "https://finance.yahoo.com/news/rssindex",
    "https://feeds.marketwatch.com/marketwatch/topstories/",
  ];

  const requests = feeds.map(async (feedUrl) => {
    try {
      const payload = await fetchJson(`${RSS_TO_JSON}${encodeURIComponent(feedUrl)}`);
      const items = payload.items ?? [];
      return items.slice(0, 6).map((item) => ({
        source: payload.feed?.title ?? "Feed",
        headline: item.title ?? "Untitled",
        time: item.pubDate ? new Date(item.pubDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
        link: item.link ?? "#",
      }));
    } catch {
      return [];
    }
  });

  const results = (await Promise.all(requests)).flat();
  return results.slice(0, 18);
}

export async function fetchFxRates() {
  const payload = await fetchJson(FX_URL);
  return payload?.rates ?? {};
}
````

## `src/marketService.js`

````javascript
import { apiRequest } from "./api.js";

export async function getStockDeepDive(ticker) {
  const symbol = String(ticker || "").trim().toUpperCase();
  if (!symbol) return null;

  try {
    return await apiRequest(`/api/market/deep-dive/${encodeURIComponent(symbol)}`);
  } catch (error) {
    console.error("Deep Dive Failed:", error);
    return null;
  }
}
````
