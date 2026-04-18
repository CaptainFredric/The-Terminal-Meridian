import { formatPrice, formatSignedPct, formatVolume, tabularValue } from "./Common.js";

function formatMarketCap(billions) {
  if (!billions) return "—";
  if (billions >= 1000) return `$${(billions / 1000).toFixed(2)}T`;
  if (billions >= 1) return `$${billions.toFixed(1)}B`;
  return `$${(billions * 1000).toFixed(0)}M`;
}

function matchSearch(item, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.symbol.toLowerCase().includes(q) ||
    (item.name || "").toLowerCase().includes(q) ||
    (item.sector || "").toLowerCase().includes(q) ||
    (item.industry || "").toLowerCase().includes(q)
  );
}

export function filterUniverse(universe, filters, buildQuote) {
  return universe.filter((item) => {
    if (filters.universe && item.universe !== filters.universe) return false;
    if (filters.sector && item.sector !== filters.sector) return false;
    if (filters.industry && item.industry !== filters.industry) return false;
    if (!matchSearch(item, filters.search)) return false;
    if (filters.minMarketCap && (item.marketCapB || 0) < Number(filters.minMarketCap)) return false;
    // Performance filter
    if (filters.performance) {
      const pct = buildQuote(item.symbol)?.changePct || 0;
      if (filters.performance === "gainers" && pct <= 0) return false;
      if (filters.performance === "losers" && pct >= 0) return false;
    }
    // P/E filter — only applies when the quote has a valid P/E
    if (filters.maxPE) {
      const pe = buildQuote(item.symbol)?.pe;
      if (pe == null || pe <= 0 || pe > Number(filters.maxPE)) return false;
    }
    return true;
  });
}

export function sortUniverse(items, sortKey, sortDir, buildQuote) {
  const direction = sortDir === "asc" ? 1 : -1;
  const copy = [...items];
  copy.sort((a, b) => {
    let av;
    let bv;
    if (sortKey === "price") {
      av = buildQuote(a.symbol)?.price ?? a.seedPrice ?? 0;
      bv = buildQuote(b.symbol)?.price ?? b.seedPrice ?? 0;
    } else if (sortKey === "changePct") {
      av = buildQuote(a.symbol)?.changePct ?? 0;
      bv = buildQuote(b.symbol)?.changePct ?? 0;
    } else if (sortKey === "volume") {
      av = buildQuote(a.symbol)?.volume ?? 0;
      bv = buildQuote(b.symbol)?.volume ?? 0;
    } else if (sortKey === "marketCap") {
      av = a.marketCapB || 0;
      bv = b.marketCapB || 0;
    } else if (sortKey === "pe") {
      av = buildQuote(a.symbol)?.pe ?? Infinity;
      bv = buildQuote(b.symbol)?.pe ?? Infinity;
    } else if (sortKey === "week52pos") {
      // Position within 52-wk range (0 = at low, 1 = at high)
      const posOf = (sym) => {
        const q = buildQuote(sym);
        if (!q?.fiftyTwoWeekHigh || !q?.fiftyTwoWeekLow || q.fiftyTwoWeekHigh <= q.fiftyTwoWeekLow) return -1;
        return (q.price - q.fiftyTwoWeekLow) / (q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow);
      };
      av = posOf(a.symbol);
      bv = posOf(b.symbol);
    } else if (sortKey === "symbol") {
      return direction * a.symbol.localeCompare(b.symbol);
    } else if (sortKey === "name") {
      return direction * (a.name || "").localeCompare(b.name || "");
    } else {
      return 0;
    }
    return direction * ((av || 0) - (bv || 0));
  });
  return copy;
}

export const SCREENER_PRESETS = [
  {
    label: "🚀 Large Cap Growth",
    filters: { universe: "S&P 500", sector: "Information Technology", minMarketCap: "200", performance: "gainers", search: "", industry: "" },
  },
  {
    label: "💰 Dividend Value",
    filters: { universe: "S&P 500", sector: "Consumer Staples", minMarketCap: "50", performance: "", search: "", industry: "" },
  },
  {
    label: "⚡ Momentum",
    filters: { universe: "", sector: "", minMarketCap: "", performance: "gainers", search: "", industry: "" },
  },
  {
    label: "🩸 Beaten Down",
    filters: { universe: "", sector: "", minMarketCap: "", performance: "losers", search: "", industry: "" },
  },
  {
    label: "🏦 Mega Cap",
    filters: { universe: "", sector: "", minMarketCap: "1000", performance: "", search: "", industry: "" },
  },
  {
    label: "⚕️ Healthcare",
    filters: { universe: "", sector: "Health Care", minMarketCap: "", performance: "", search: "", industry: "" },
  },
  {
    label: "💎 Value",
    filters: { universe: "S&P 500", sector: "", minMarketCap: "10", performance: "", search: "", industry: "", maxPE: "20" },
  },
];

export function createScreenerRenderer(context) {
  const { state, universe, buildQuote, isProUser } = context;
  const FREE_SCREENER_ROWS = 25;

  return function renderScreener(panel) {
    // Prefer the live universe fetched from the backend on boot; fall back
    // to the static hardcoded list so the screener still works offline.
    const liveUniverse = state.screenerUniverseLive;
    const workingUniverse = Array.isArray(liveUniverse) && liveUniverse.length
      ? liveUniverse
      : universe;

    const filters = state.screenerFilters[panel];
    const sortKey = filters.sortKey || "marketCap";
    const sortDir = filters.sortDir || "desc";

    const sectors = [...new Set(workingUniverse.map((item) => item.sector).filter(Boolean))].sort();
    const universes = [...new Set(workingUniverse.map((item) => item.universe).filter(Boolean))].sort();
    const industries = [...new Set(workingUniverse.map((item) => item.industry).filter(Boolean))].sort();

    const filtered = filterUniverse(workingUniverse, filters, buildQuote);
    const sorted = sortUniverse(filtered, sortKey, sortDir, buildQuote);
    const isPro = typeof isProUser === "function" ? isProUser() : false;
    const pageSize = isPro ? 120 : FREE_SCREENER_ROWS;
    const results = sorted.slice(0, pageSize);
    const lockedPreviewRows = !isPro ? sorted.slice(pageSize, pageSize + 5) : [];
    const moreCount = Math.max(0, sorted.length - pageSize);
    const hasFilter = filters.universe || filters.sector || filters.industry || filters.search || filters.minMarketCap || filters.performance || filters.maxPE;

    // Stats
    const totalMarketCap = filtered.reduce((sum, item) => sum + (item.marketCapB || 0), 0);
    const gainers = filtered.filter((item) => (buildQuote(item.symbol)?.changePct || 0) > 0).length;
    const losers = filtered.filter((item) => (buildQuote(item.symbol)?.changePct || 0) < 0).length;
    const avgChange = filtered.length
      ? filtered.reduce((s, item) => s + (buildQuote(item.symbol)?.changePct || 0), 0) / filtered.length
      : 0;

    const sortHeader = (key, label, align) => {
      const isActive = sortKey === key;
      const arrow = isActive ? (sortDir === "asc" ? " ▲" : " ▼") : "";
      return `<th${align ? ` style="text-align:${align}"` : ""}><button class="table-sort ${isActive ? "is-active" : ""}" type="button" data-screener-sort="${panel}:${key}">${label}${arrow}</button></th>`;
    };

    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));">
          <article class="card stat-card">
            <span>Universe</span>
            <strong>${workingUniverse.length.toLocaleString()}</strong>
            <small>${liveUniverse ? "Live feed" : "Local cache"} · ${universes.length} groups</small>
          </article>
          <article class="card stat-card">
            <span>Matches</span>
            <strong>${filtered.length.toLocaleString()}</strong>
            <small>${hasFilter ? "Filtered" : "All tickers"}</small>
          </article>
          <article class="card stat-card">
            <span>Total Cap</span>
            <strong>${formatMarketCap(totalMarketCap)}</strong>
            <small>Of filtered set</small>
          </article>
          <article class="card stat-card">
            <span>Breadth</span>
            <strong class="positive">${gainers}</strong><strong class="muted-fraction"> / </strong><strong class="negative">${losers}</strong>
            <small>Advancing / Declining</small>
          </article>
          <article class="card stat-card">
            <span>Avg Change</span>
            <strong class="${avgChange >= 0 ? "positive" : "negative"}">${formatSignedPct(avgChange)}</strong>
            <small>Filtered average</small>
          </article>
        </div>

        <div class="screener-presets-row">
          <span class="screener-presets-label">Presets</span>
          ${SCREENER_PRESETS.map((preset, i) => {
            const isActive = Object.entries(preset.filters).every(([k, v]) => (filters[k] || "") === (v || ""));
            return `<button class="screener-preset-chip${isActive ? " is-active" : ""}" type="button" data-screener-preset="${panel}:${i}">${preset.label}</button>`;
          }).join("")}
        </div>

        <div class="screener-filters">
          <select data-screener-universe="${panel}">
            <option value="">All universes</option>
            ${universes.map((value) => `<option value="${value}" ${value === filters.universe ? "selected" : ""}>${value}</option>`).join("")}
          </select>
          <select data-screener-sector="${panel}">
            <option value="">All sectors</option>
            ${sectors.map((value) => `<option value="${value}" ${value === filters.sector ? "selected" : ""}>${value}</option>`).join("")}
          </select>
          <select data-screener-industry="${panel}">
            <option value="">All industries</option>
            ${industries.map((value) => `<option value="${value}" ${value === filters.industry ? "selected" : ""}>${value}</option>`).join("")}
          </select>
          <select data-screener-min-mcap="${panel}">
            <option value="">Any size</option>
            <option value="1000" ${filters.minMarketCap === "1000" ? "selected" : ""}>Mega cap ($1T+)</option>
            <option value="200" ${filters.minMarketCap === "200" ? "selected" : ""}>Large cap ($200B+)</option>
            <option value="50" ${filters.minMarketCap === "50" ? "selected" : ""}>Mid cap ($50B+)</option>
            <option value="10" ${filters.minMarketCap === "10" ? "selected" : ""}>Small cap ($10B+)</option>
          </select>
          <select data-screener-performance="${panel}">
            <option value=""${!filters.performance ? " selected" : ""}>All performance</option>
            <option value="gainers"${filters.performance === "gainers" ? " selected" : ""}>Gainers only</option>
            <option value="losers"${filters.performance === "losers" ? " selected" : ""}>Losers only</option>
          </select>
          <select data-screener-max-pe="${panel}">
            <option value=""${!filters.maxPE ? " selected" : ""}>Any P/E</option>
            <option value="15"${filters.maxPE === "15" ? " selected" : ""}>P/E ≤ 15 (Deep value)</option>
            <option value="20"${filters.maxPE === "20" ? " selected" : ""}>P/E ≤ 20 (Value)</option>
            <option value="30"${filters.maxPE === "30" ? " selected" : ""}>P/E ≤ 30 (Moderate)</option>
            <option value="50"${filters.maxPE === "50" ? " selected" : ""}>P/E ≤ 50 (Growth)</option>
          </select>
          <input data-screener-search="${panel}" value="${filters.search || ""}" placeholder="Search symbol, name, sector…" />
          <div class="screener-filter-actions">
            ${hasFilter ? `<button class="btn btn-ghost btn-sm" type="button" data-screener-clear="${panel}">Clear</button>` : ""}
            <button class="btn btn-ghost btn-sm screener-export-btn" type="button" data-screener-export="${panel}" title="Export to CSV">⬇ CSV</button>
          </div>
        </div>

        <div class="table-scroll-wrapper">
          <table class="data-table data-table-dense financial-data-table screener-table">
            <thead>
              <tr>
                ${sortHeader("symbol", "Ticker")}
                ${sortHeader("name", "Name")}
                <th>Sector</th>
                ${sortHeader("price", "Price", "right")}
                ${sortHeader("changePct", "Chg %", "right")}
                ${sortHeader("volume", "Volume", "right")}
                ${sortHeader("marketCap", "Mkt Cap", "right")}
                ${sortHeader("pe", "P/E", "right")}
                ${sortHeader("week52pos", "52-wk", "center")}
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${results
                .map((item) => {
                  const quote = buildQuote(item.symbol);
                  const price = quote?.price || item.seedPrice || 0;
                  const changePct = quote?.changePct;
                  const changeClass = changePct == null ? "" : changePct >= 0 ? "positive" : "negative";
                  const volume = quote?.volume;
                  const high52 = quote?.fiftyTwoWeekHigh;
                  const low52 = quote?.fiftyTwoWeekLow;
                  const pe = quote?.pe;

                  // Inline 52-week position indicator
                  let week52Cell = `<td style="text-align:center" class="muted-cell">—</td>`;
                  if (high52 && low52 && high52 > low52 && price) {
                    const rawPct = ((price - low52) / (high52 - low52)) * 100;
                    const clampedPct = Math.max(0, Math.min(100, rawPct));
                    const posLabel = clampedPct >= 80 ? "🔝" : clampedPct <= 20 ? "🔻" : "";
                    week52Cell = `
                      <td style="text-align:center" class="screener-52wk-cell" title="52wk: $${low52.toFixed(0)} — $${high52.toFixed(0)} · ${clampedPct.toFixed(0)}% of range">
                        <div class="screener-52wk-wrap">
                          <span class="screener-52wk-lo">L</span>
                          <div class="screener-52wk-track">
                            <div class="screener-52wk-fill" style="width:${clampedPct}%"></div>
                            <div class="screener-52wk-dot" style="left:calc(${clampedPct}% - 3px)"></div>
                          </div>
                          <span class="screener-52wk-hi">H</span>
                          ${posLabel ? `<span class="screener-52wk-badge">${posLabel}</span>` : ""}
                        </div>
                      </td>`;
                  }

                  // P/E formatting — color-code value tiers
                  const peClass = pe == null ? "muted-cell" : pe <= 15 ? "positive" : pe <= 25 ? "" : pe <= 50 ? "" : "negative";
                  const peCell = pe != null && pe > 0
                    ? `<td style="text-align:right" class="${peClass}">${pe.toFixed(1)}x</td>`
                    : `<td style="text-align:right" class="muted-cell">—</td>`;

                  return `
                    <tr>
                      <td><button class="table-link" type="button" data-load-module="quote" data-target-symbol="${item.symbol}" data-target-panel="${panel}"><strong>${item.symbol}</strong></button></td>
                      <td class="screener-name">${item.name || ""}</td>
                      <td class="muted-cell">${item.sector || ""}</td>
                      <td style="text-align:right">${tabularValue(formatPrice(price, item.symbol), { flashKey: `quote:${item.symbol}:price`, currentPrice: price })}</td>
                      <td style="text-align:right" class="${changeClass}">${changePct == null ? "—" : tabularValue(formatSignedPct(changePct))}</td>
                      <td style="text-align:right" class="muted-cell">${volume ? formatVolume(volume) : "—"}</td>
                      <td style="text-align:right" class="muted-cell">${formatMarketCap(item.marketCapB)}</td>
                      ${peCell}
                      ${week52Cell}
                      <td class="row-actions">
                        <button class="btn btn-ghost btn-inline" type="button" data-load-module="chart" data-target-symbol="${item.symbol}" data-target-panel="${panel}" title="Open chart">📈</button>
                        <button class="btn btn-ghost btn-inline" type="button" data-trade-symbol="${item.symbol}" data-target-panel="${panel}" title="Trade">💸</button>
                      </td>
                    </tr>
                  `;
                })
                .join("")}
              ${lockedPreviewRows.length ? lockedPreviewRows.map((item) => {
                const quote = buildQuote(item.symbol);
                const price = quote?.price ?? null;
                return `
                  <tr class="screener-locked-row">
                    <td><strong class="screener-locked-text">${item.symbol}</strong></td>
                    <td class="screener-name screener-locked-text">${item.name || ""}</td>
                    <td class="muted-cell screener-locked-text">${item.sector || ""}</td>
                    <td style="text-align:right" class="screener-locked-text">${price != null ? formatPrice(price, item.symbol) : "—"}</td>
                    <td colspan="5" style="text-align:left;padding-left:16px">
                      <span class="screener-lock-icon">🔒</span>
                      <span class="screener-locked-text">Pro unlocks all ${sorted.length} matching tickers</span>
                    </td>
                  </tr>
                `;
              }).join("") : ""}
            </tbody>
          </table>
        </div>
        ${!isPro && moreCount > 0 ? `
          <div class="screener-paywall-banner">
            <div class="screener-paywall-text">
              <strong>${moreCount.toLocaleString()} more matches hidden</strong>
              <small>Free tier shows ${pageSize} rows · Pro unlocks the entire universe + CSV export</small>
            </div>
            <button class="btn btn-primary btn-sm" type="button" data-open-pricing>Upgrade →</button>
          </div>
        ` : sorted.length > pageSize ? `<p class="empty-inline">Showing ${pageSize} of ${sorted.length} results · narrow filters to see more</p>` : ""}
      </section>
    `;
  };
}
