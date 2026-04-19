/**
 * AI Insights renderer.
 *
 * Renders an analyst-style commentary card for the panel's current symbol.
 * Defers to a *cached* commentary payload stored on `state.aiCommentary`
 * (a Map keyed by symbol). The actual fetch is kicked off by the panel
 * shell when the user clicks "Generate" or auto-fires on first mount —
 * see the `triggerAICommentary()` helper exported below.
 *
 * Why split fetch from render? Renderers in this codebase are sync
 * pure-string functions called frequently (every state tick). If we
 * fetched inside the renderer we'd thrash the LLM. Instead the renderer
 * shows whatever's already cached and a CTA, and the caller's click
 * handler triggers the fetch + `renderPanel(panel)` re-render.
 */

import { tabularValue } from "./Common.js";

const TONE_COLORS = {
  bullish: "var(--success, #2fcf84)",
  constructive: "var(--success, #2fcf84)",
  neutral: "var(--muted, #8a96b3)",
  cautious: "var(--warning, #ffb84d)",
  bearish: "var(--danger, #ff5f7f)",
};

const TONE_ICONS = {
  bullish: "▲▲",
  constructive: "▲",
  neutral: "→",
  cautious: "▼",
  bearish: "▼▼",
};

const SOURCE_LABELS = {
  openai: "Powered by GPT",
  anthropic: "Powered by Claude",
  template: "Rule-based insights",
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRelativeTime(iso) {
  if (!iso) return "—";
  try {
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - then);
    if (diff < 30_000) return "just now";
    if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
    return `${Math.round(diff / 3_600_000)}h ago`;
  } catch {
    return "—";
  }
}

export function createAIRenderer(context) {
  const { state, buildQuote } = context;

  return function renderAI(panel) {
    const symbol = state.panelSymbols?.[panel] || state.watchlist?.[0] || "AAPL";
    const cache = state.aiCommentary || new Map();
    const cached = cache.get(symbol) || null;
    const quote = buildQuote ? buildQuote(symbol) : null;
    const loading = state.aiLoading?.has(symbol);

    const price = quote?.price != null ? `$${tabularValue(quote.price, 2)}` : "—";
    const changePct = Number(quote?.changePct ?? 0);
    const changeTone = changePct >= 0 ? "positive" : "negative";
    const changeArrow = changePct >= 0 ? "▲" : "▼";

    // Header strip — symbol, current price, generation status
    const headerHtml = `
      <header class="ai-header">
        <div class="ai-symbol-block">
          <h2 class="ai-symbol">${escapeHtml(symbol)}</h2>
          <p class="ai-symbol-meta">
            <span data-price-key="ai:${escapeHtml(symbol)}:price">${price}</span>
            <span class="${changeTone}">${changeArrow} ${changePct.toFixed(2)}%</span>
          </p>
        </div>
        <div class="ai-actions">
          <button class="btn btn-primary" type="button" data-ai-generate="${escapeHtml(symbol)}" data-panel="${panel}" ${loading ? "disabled" : ""}>
            ${loading ? "Generating…" : cached ? "Regenerate" : "Generate insight"}
          </button>
          <button class="btn btn-ghost" type="button" data-ai-symbol-edit="${panel}" title="Change symbol">
            Change symbol
          </button>
        </div>
      </header>
    `;

    if (loading && !cached) {
      return `
        <section class="ai-panel">
          ${headerHtml}
          <div class="ai-loading">
            <div class="ai-spinner" aria-hidden="true"></div>
            <p>Synthesising commentary on ${escapeHtml(symbol)}…</p>
            <small>Tapping live quote data, 52-week range, and volume signals.</small>
          </div>
        </section>
      `;
    }

    if (!cached) {
      return `
        <section class="ai-panel">
          ${headerHtml}
          <div class="ai-empty">
            <h3>What's the story on ${escapeHtml(symbol)}?</h3>
            <p>
              Click <strong>Generate insight</strong> for an analyst-style breakdown of
              today's price action, volume conviction, 52-week positioning, and what to
              watch next. Switch the panel symbol with the button above to analyze a
              different ticker.
            </p>
            <p class="ai-disclaimer">
              ⚠ For information only — not investment advice. Meridian never recommends
              buying or selling securities.
            </p>
          </div>
        </section>
      `;
    }

    // Cached commentary present — render the real card.
    const tone = String(cached.tone || "neutral").toLowerCase();
    const toneColor = TONE_COLORS[tone] || TONE_COLORS.neutral;
    const toneIcon = TONE_ICONS[tone] || TONE_ICONS.neutral;
    const sourceLabel = SOURCE_LABELS[cached.source] || "Insights";
    const bullets = Array.isArray(cached.bullets) ? cached.bullets : [];
    const bulletsHtml = bullets
      .map((b) => `<li>${escapeHtml(b)}</li>`)
      .join("");

    return `
      <section class="ai-panel">
        ${headerHtml}

        <div class="ai-card">
          <div class="ai-card-tone" style="color: ${toneColor};">
            <span class="ai-tone-icon">${toneIcon}</span>
            <span class="ai-tone-label">${escapeHtml(tone.toUpperCase())}</span>
          </div>
          <h3 class="ai-headline">${escapeHtml(cached.headline || "")}</h3>
          ${bulletsHtml ? `<ul class="ai-bullets">${bulletsHtml}</ul>` : ""}
          ${cached.summary ? `<p class="ai-summary"><strong>Bottom line:</strong> ${escapeHtml(cached.summary)}</p>` : ""}
        </div>

        <footer class="ai-footer">
          <span class="ai-source-badge" data-source="${escapeHtml(cached.source || "template")}">
            ${escapeHtml(sourceLabel)}${cached.model ? ` · ${escapeHtml(cached.model)}` : ""}
          </span>
          <span class="ai-timestamp">Generated ${formatRelativeTime(cached.generatedAt)}</span>
        </footer>

        <p class="ai-disclaimer">
          ⚠ For information only — not investment advice.
        </p>
      </section>
    `;
  };
}
