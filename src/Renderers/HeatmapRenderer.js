import { formatSignedPct, tabularValue } from "./Common.js";

export function createHeatmapRenderer(context) {
  const { heatmapGroups, buildQuote } = context;

  return function renderHeatmap(panel) {
    const sectorEntries = Object.entries(heatmapGroups);
    const allQuotes = sectorEntries.flatMap(([, symbols]) => symbols.map((s) => buildQuote(s)).filter(Boolean));
    const advancing = allQuotes.filter((q) => (q.changePct || 0) >= 0).length;
    const declining = allQuotes.length - advancing;
    const avgChange = allQuotes.length ? allQuotes.reduce((sum, q) => sum + (q.changePct || 0), 0) / allQuotes.length : 0;
    const breadthLabel = advancing > declining ? "🟢 Broad advance" : declining > advancing ? "🔴 Broad decline" : "⚪ Mixed";

    return `
      <section class="stack stack-lg">
        <div class="card-grid card-grid-home">
          <article class="card stat-card"><span>🏢 Sectors</span><strong>${sectorEntries.length}</strong><small>${allQuotes.length} names tracked</small></article>
          <article class="card stat-card"><span>📈 Advancing</span><strong class="positive">${advancing}</strong><small>${allQuotes.length ? ((advancing / allQuotes.length) * 100).toFixed(0) + "%" : "--"}</small></article>
          <article class="card stat-card"><span>📉 Declining</span><strong class="negative">${declining}</strong><small>${allQuotes.length ? ((declining / allQuotes.length) * 100).toFixed(0) + "%" : "--"}</small></article>
          <article class="card stat-card"><span>🧭 Breadth</span><strong>${breadthLabel}</strong><small>Avg ${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%</small></article>
        </div>
        <section class="heatmap-grid">
          ${sectorEntries
            .map(
              ([sector, symbols]) => {
                const sectorQuotes = symbols.map((s) => buildQuote(s)).filter(Boolean);
                const sectorAvg = sectorQuotes.length ? sectorQuotes.reduce((s, q) => s + (q.changePct || 0), 0) / sectorQuotes.length : 0;
                return `
                  <article class="card">
                    <header class="card-head card-head-split"><h4>${sector}</h4><small>${symbols.length} names · avg <span class="${sectorAvg >= 0 ? "positive" : "negative"}">${sectorAvg >= 0 ? "+" : ""}${sectorAvg.toFixed(2)}%</span></small></header>
                    <div class="tile-grid">
                      ${symbols
                        .map((symbol) => {
                          const quote = buildQuote(symbol);
                          const pct = quote?.changePct || 0;
                          const tone = pct >= 0 ? "positive" : "negative";
                          const intensity = Math.min(Math.abs(pct), 5);
                          return `<button class="tile ${tone}" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}" style="opacity:${0.6 + intensity * 0.08}"><strong>${symbol}</strong><small>${quote ? tabularValue(formatSignedPct(quote.changePct)) : "--"}</small></button>`;
                        })
                        .join("")}
                    </div>
                  </article>
                `;
              },
            )
            .join("")}
        </section>
      </section>
    `;
  };
}
