import { formatSignedPct, tabularValue, formatMarketCap } from "./Common.js";

/**
 * Heatmap Renderer
 * Full GICS-sector heatmap covering 150+ names across 12 groups.
 * Features: sector filter, performance sort, breadth analytics.
 */
export function createHeatmapRenderer(context) {
  const { heatmapGroups, buildQuote, state } = context;

  return function renderHeatmap(panel) {
    const filterState = state.heatmapFilter || {};
    const sectorFilter = filterState.sector || "ALL";
    const sortMode = filterState.sort || "changePct";

    const sectorEntries = Object.entries(heatmapGroups)
      .filter(([sector]) => sectorFilter === "ALL" || sector === sectorFilter);

    // Gather all quotes across visible sectors
    const allQuotes = sectorEntries.flatMap(([, symbols]) =>
      symbols.map((s) => ({ symbol: s, quote: buildQuote(s) })).filter((e) => e.quote)
    );
    const advancing = allQuotes.filter((e) => (e.quote.changePct || 0) > 0).length;
    const declining = allQuotes.filter((e) => (e.quote.changePct || 0) < 0).length;
    const unchanged = allQuotes.length - advancing - declining;
    const avgChange = allQuotes.length
      ? allQuotes.reduce((sum, e) => sum + (e.quote.changePct || 0), 0) / allQuotes.length
      : 0;

    // Find best & worst performing symbols
    const sorted = [...allQuotes].sort((a, b) => (b.quote.changePct || 0) - (a.quote.changePct || 0));
    const bestSymbol = sorted[0];
    const worstSymbol = sorted[sorted.length - 1];

    // Breadth ratio
    const breadthRatio = allQuotes.length ? advancing / allQuotes.length : 0;
    const breadthLabel = breadthRatio > 0.6
      ? "🟢 Broad Advance"
      : breadthRatio < 0.4
        ? "🔴 Broad Decline"
        : "⚪ Mixed";

    // Sector dropdown options
    const allSectors = Object.keys(heatmapGroups);
    const sectorOptions = allSectors
      .map((s) => `<option value="${s}"${sectorFilter === s ? " selected" : ""}>${s}</option>`)
      .join("");

    // Sort sectors by average performance if requested
    let sortedEntries = [...sectorEntries];
    if (sortMode === "changePct") {
      sortedEntries.sort((a, b) => {
        const avgA = a[1].reduce((s, sym) => s + (buildQuote(sym)?.changePct || 0), 0) / (a[1].length || 1);
        const avgB = b[1].reduce((s, sym) => s + (buildQuote(sym)?.changePct || 0), 0) / (b[1].length || 1);
        return avgB - avgA;
      });
    } else if (sortMode === "alpha") {
      sortedEntries.sort((a, b) => a[0].localeCompare(b[0]));
    }

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <select class="input input-sm" data-heatmap-sector="${panel}" title="Filter by sector">
            <option value="ALL"${sectorFilter === "ALL" ? " selected" : ""}>All Sectors</option>
            ${sectorOptions}
          </select>
          <select class="input input-sm" data-heatmap-sort="${panel}" title="Sort sectors">
            <option value="changePct"${sortMode === "changePct" ? " selected" : ""}>Sort: Performance</option>
            <option value="alpha"${sortMode === "alpha" ? " selected" : ""}>Sort: Alphabetical</option>
            <option value="default"${sortMode === "default" ? " selected" : ""}>Sort: Default</option>
          </select>
          <button class="btn btn-ghost btn-sm" type="button" data-heatmap-reset="${panel}">Reset filters</button>
        </div>

        <div class="card-grid card-grid-home" style="grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));">
          <article class="card stat-card">
            <span>Names Tracked</span>
            <strong>${allQuotes.length}</strong>
            <small>${sectorEntries.length} sector${sectorEntries.length !== 1 ? "s" : ""}</small>
          </article>
          <article class="card stat-card">
            <span>Advancing</span>
            <strong class="positive">${advancing}</strong>
            <small>${allQuotes.length ? ((advancing / allQuotes.length) * 100).toFixed(0) + "%" : "--"} of total</small>
          </article>
          <article class="card stat-card">
            <span>Declining</span>
            <strong class="negative">${declining}</strong>
            <small>${unchanged} unchanged</small>
          </article>
          <article class="card stat-card">
            <span>Breadth</span>
            <strong>${breadthLabel}</strong>
            <small>Avg ${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%</small>
          </article>
          ${bestSymbol ? `
          <article class="card stat-card">
            <span>Best Performer</span>
            <strong class="positive">${bestSymbol.symbol}</strong>
            <small class="positive">${formatSignedPct(bestSymbol.quote.changePct)}</small>
          </article>` : ""}
          ${worstSymbol ? `
          <article class="card stat-card">
            <span>Worst Performer</span>
            <strong class="negative">${worstSymbol.symbol}</strong>
            <small class="negative">${formatSignedPct(worstSymbol.quote.changePct)}</small>
          </article>` : ""}
        </div>

        <section class="heatmap-grid">
          ${sortedEntries
            .map(([sector, symbols]) => {
              const sectorQuotes = symbols
                .map((s) => ({ symbol: s, quote: buildQuote(s) }))
                .filter((e) => e.quote);

              // Sort tiles within each sector by change %
              const sortedTiles = [...sectorQuotes].sort(
                (a, b) => (b.quote.changePct || 0) - (a.quote.changePct || 0)
              );

              const sectorAdv = sectorQuotes.filter((e) => (e.quote.changePct || 0) > 0).length;
              const sectorAvg = sectorQuotes.length
                ? sectorQuotes.reduce((s, e) => s + (e.quote.changePct || 0), 0) / sectorQuotes.length
                : 0;

              return `
                <article class="card">
                  <header class="card-head card-head-split">
                    <h4>${sector}</h4>
                    <small>
                      ${symbols.length} names ·
                      <span class="positive">${sectorAdv}↑</span>
                      <span class="negative">${sectorQuotes.length - sectorAdv}↓</span>
                      · avg <span class="${sectorAvg >= 0 ? "positive" : "negative"}">${sectorAvg >= 0 ? "+" : ""}${sectorAvg.toFixed(2)}%</span>
                    </small>
                  </header>
                  <div class="tile-grid">
                    ${sortedTiles
                      .map(({ symbol, quote }) => {
                        const pct = quote.changePct || 0;
                        const tone = pct > 0 ? "positive" : pct < 0 ? "negative" : "";
                        // Intensity: clamp |pct| to 0-3% range, map to alpha 0.10–0.55
                        const intensity = Math.min(Math.abs(pct), 3) / 3;
                        const alpha = (0.10 + intensity * 0.45).toFixed(2);
                        const bgColor = pct > 0
                          ? `rgba(47,207,132,${alpha})`
                          : pct < 0
                          ? `rgba(255,95,127,${alpha})`
                          : "rgba(255,255,255,0.04)";
                        const borderColor = pct > 0
                          ? `rgba(47,207,132,${(Number(alpha) * 1.3).toFixed(2)})`
                          : pct < 0
                          ? `rgba(255,95,127,${(Number(alpha) * 1.3).toFixed(2)})`
                          : "rgba(255,255,255,0.08)";
                        const mktCap = quote.marketCap ? formatMarketCap(quote.marketCap) : "";
                        return `<button class="tile heat-tile ${tone}" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}" style="background:${bgColor};border-color:${borderColor}" title="${quote.name || symbol}${mktCap ? " · " + mktCap : ""} · $${Number(quote.price || 0).toFixed(2)} · ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%"><strong>${symbol}</strong><small class="${tone}">${tabularValue(formatSignedPct(pct))}</small></button>`;
                      })
                      .join("")}
                  </div>
                </article>
              `;
            })
            .join("")}
        </section>
      </section>
    `;
  };
}
