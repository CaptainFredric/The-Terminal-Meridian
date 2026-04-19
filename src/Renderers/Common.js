export function loadingSkeleton(lines = 3) {
  return `<div class="stack">${Array.from({ length: lines })
    .map((_, index) => `<span class="skeleton-box ${index === 0 ? "lg" : ""}"></span>`)
    .join("")}</div>`;
}

export function formatPrice(value, symbol = "USD") {
  const digits = symbol === "BTC-USD" || symbol === "USD" ? 0 : 2;
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSignedPct(value) {
  return `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}

export function formatMarketCap(value) {
  if (!value) return "N/A";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${Number(value).toFixed(0)}`;
}

export function formatVolume(value) {
  if (!value) return "N/A";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return `${value}`;
}

export function formatInsightValue(value) {
  if (value == null) return "--";
  if (typeof value === "object") {
    if ("fmt" in value && value.fmt) return String(value.fmt);
    if ("longFmt" in value && value.longFmt) return String(value.longFmt);
    if ("raw" in value && value.raw != null) return String(value.raw);
  }
  return String(value);
}

export function formatExpiry(value) {
  if (!value) return "Nearest";
  return new Date(Number(value) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

/**
 * Render a standardised error card with an optional retry button.
 *
 * @param {string} message  Human-readable error description.
 * @param {object} [opts]
 * @param {string} [opts.retryAction]   data-action value on the retry button.
 * @param {string} [opts.retryLabel]    Button label (default: "Try again").
 * @param {string} [opts.retryPayload]  JSON payload encoded onto data-payload.
 */
export function errorState(message, { retryAction, retryLabel = "Try again", retryPayload } = {}) {
  const btn = retryAction
    ? `<button class="btn btn-sm mt-2" data-action="${retryAction}"${retryPayload ? ` data-payload='${retryPayload}'` : ""}>${retryLabel}</button>`
    : "";
  return `<div class="empty-state error-state">
  <span class="error-icon" aria-hidden="true">⚠</span>
  <span>${message}</span>
  ${btn}
</div>`;
}

export function tabularValue(content, { currentPrice, previousPrice, flashKey, className = "" } = {}) {
  const attributes = [];
  if (currentPrice != null) attributes.push(`data-price-current="${Number(currentPrice)}"`);
  if (previousPrice != null) attributes.push(`data-price-previous="${Number(previousPrice)}"`);
  if (flashKey) attributes.push(`data-price-key="${flashKey}"`);
  return `<span class="tabular-nums ${className}" ${attributes.join(" ")}>${content}</span>`;
}

export function applyPriceTone(element, currentPrice, previousPrice) {
  if (!element || currentPrice == null || previousPrice == null) return;
  if (Number(currentPrice) === Number(previousPrice)) return;
  const nextClass = Number(currentPrice) > Number(previousPrice) ? "flash-up" : "flash-down";
  const signature = `${Number(previousPrice)}:${Number(currentPrice)}`;
  if (element.dataset.priceFlashSignature === signature) return;
  element.classList.remove("flash-up", "flash-down");
  void element.offsetWidth;
  element.classList.add(nextClass);
  element.dataset.priceFlashSignature = signature;
}
