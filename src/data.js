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
  { key: "F1", module: "home", label: "Home" },
  { key: "F2", module: "quote", label: "Quote" },
  { key: "F3", module: "chart", label: "Chart" },
  { key: "F4", module: "news", label: "News" },
  { key: "F5", module: "screener", label: "Screener" },
  { key: "F6", module: "heatmap", label: "Heatmap" },
  { key: "F7", module: "portfolio", label: "Portfolio" },
  { key: "F8", module: "macro", label: "Macro" },
  { key: "F9", module: "options", label: "Options" },
  { key: "F10", module: "calculator", label: "Calculator" },
];

export const moduleOrder = ["home", "quote", "chart", "news", "screener", "heatmap", "portfolio", "macro", "options", "calculator"];

export const moduleTitles = {
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
  { cmd: "HELP", desc: "Show available commands" },
  { cmd: "REFRESH", desc: "Refresh live data across the workspace" },
  { cmd: "SAVE", desc: "Queue a workspace save" },
  { cmd: "GRID", desc: "Return panels to grid layout" },
  { cmd: "FOCUS 2", desc: "Expand panel 2 with a swell transition" },
  { cmd: "NEXT", desc: "Cycle active panel to the next module" },
  { cmd: "PREV", desc: "Cycle active panel to the previous module" },
  { cmd: "RANGE 1Y", desc: "Change active chart range" },
  { cmd: "HOME", desc: "Open home panel" },
  { cmd: "SETTINGS", desc: "Open account settings modal" },
  { cmd: "SUGGEST", desc: "Show smart next-action suggestions" },
  { cmd: "NEWS", desc: "Open news panel" },
  { cmd: "NEWS NVDA", desc: "Filter the news feed for NVDA" },
  { cmd: "PORT", desc: "Open portfolio panel" },
  { cmd: "MACRO", desc: "Open macro panel" },
  { cmd: "AAPL Q", desc: "Open quote for AAPL" },
  { cmd: "AAPL CHART", desc: "Open chart for AAPL" },
  { cmd: "WATCH TSLA", desc: "Add TSLA to watchlist" },
  { cmd: "ALERT NVDA 950", desc: "Create price alert" },
  { cmd: "ADDPOS MSFT 5 410", desc: "Add portfolio position" },
  { cmd: "OPTIONS NVDA", desc: "Open options chain" },
  { cmd: "SYNC", desc: "Open sign in modal" },
  { cmd: "LOGIN", desc: "Open sign-in tab" },
  { cmd: "SIGNUP", desc: "Open account creation tab" },
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
