import { formatSignedPct, tabularValue } from "./Common.js";

export function createHeatmapRenderer(context) {
  const { heatmapGroups, buildQuote } = context;

  return function renderHeatmap(panel) {
    return `
      <section class="heatmap-grid">
        ${Object.entries(heatmapGroups)
          .map(
            ([sector, symbols]) => `
              <article class="card">
                <header class="card-head card-head-split"><h4>${sector}</h4><small>${symbols.length} names</small></header>
                <div class="tile-grid">
                  ${symbols
                    .map((symbol) => {
                      const quote = buildQuote(symbol);
                      const tone = (quote?.changePct || 0) >= 0 ? "positive" : "negative";
                      return `<button class="tile ${tone}" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}"><strong>${symbol}</strong><small>${quote ? tabularValue(formatSignedPct(quote.changePct)) : "--"}</small></button>`;
                    })
                    .join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </section>
    `;
  };
}
