import { formatExpiry, formatPrice, loadingSkeleton, tabularValue } from "./Common.js";

function rawNumber(field, fallback = null) {
  if (field == null) return fallback;
  if (typeof field === "number") return Number.isFinite(field) ? field : fallback;
  if (typeof field === "string") {
    const stripped = field.replace(/[^0-9.\-]/g, "");
    const n = Number(stripped);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof field === "object") {
    if (typeof field.raw === "number") return field.raw;
    if (typeof field.value === "number") return field.value;
    if (typeof field.fmt === "string") return rawNumber(field.fmt, fallback);
  }
  return fallback;
}

function formatSignedNumber(value, digits = 3) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "--";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}`;
}

function formatGreek(value, digits = 3) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return n.toFixed(digits);
}

function yearsUntil(expirationSec) {
  if (!expirationSec) return 0.05; // sensible default (~2.5 weeks)
  const expMs = Number(expirationSec) * 1000;
  if (!Number.isFinite(expMs) || expMs <= 0) return 0.05;
  const diffDays = (expMs - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.max(diffDays / 365, 1 / 365);
}

function averageIv(contracts) {
  const ivs = contracts
    .map((c) => rawNumber(c.impliedVolatility))
    .filter((v) => v != null && v > 0);
  if (!ivs.length) return 0.3;
  return ivs.reduce((a, b) => a + b, 0) / ivs.length;
}

function nearestStrike(contracts, spot) {
  if (!Array.isArray(contracts) || !contracts.length || !spot) return null;
  let best = null;
  let bestDist = Infinity;
  contracts.forEach((c) => {
    const strike = rawNumber(c.strike);
    if (strike == null) return;
    const dist = Math.abs(strike - spot);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  });
  return best;
}

function renderOptionsTable(contracts, type, greekCtx) {
  if (!contracts.length) return `<div class="empty-inline">No ${type} contracts loaded yet.</div>`;
  const { spot, years, riskFreeRate, fallbackIv, calculateBlackScholes } = greekCtx;
  const isCall = type === "call";

  // Pre-compute max OI for the bar scale
  const maxOi = Math.max(1, ...contracts.slice(0, 20).map((c) => rawNumber(c.openInterest) || 0));

  return `
    <table class="data-table compact financial-data-table options-table">
      <thead>
        <tr>
          <th>Strike</th>
          <th>Bid</th>
          <th>Ask</th>
          <th>Sprd%</th>
          <th>IV</th>
          <th>Δ</th>
          <th>Θ/day</th>
          <th>Vol</th>
          <th>OI</th>
        </tr>
      </thead>
      <tbody>
        ${contracts
          .slice(0, 20)
          .map((contract) => {
            const strikeRaw = rawNumber(contract.strike);
            const bidRaw = rawNumber(contract.bid);
            const askRaw = rawNumber(contract.ask);
            const ivRaw = rawNumber(contract.impliedVolatility);
            const oiRaw = rawNumber(contract.openInterest) || 0;
            const ivPct = ivRaw != null && ivRaw > 0 ? ivRaw * 100 : fallbackIv * 100;

            // ATM highlighting: within 2% of spot
            const isAtm = strikeRaw && spot && Math.abs(strikeRaw - spot) / spot < 0.02;

            // Bid/ask spread %
            let spreadCell = "--";
            if (bidRaw != null && askRaw != null && bidRaw > 0 && askRaw > 0) {
              const mid = (bidRaw + askRaw) / 2;
              const spread = mid > 0 ? ((askRaw - bidRaw) / mid) * 100 : 0;
              spreadCell = `${spread.toFixed(1)}%`;
            }

            let deltaCell = "--";
            let thetaCell = "--";
            if (strikeRaw && spot && years > 0 && calculateBlackScholes) {
              const bs = calculateBlackScholes({ spot, strike: strikeRaw, years, rate: riskFreeRate, volatility: ivPct });
              const delta = isCall ? bs.callDelta : bs.putDelta;
              const theta = isCall ? bs.callTheta : bs.putTheta;
              deltaCell = formatSignedNumber(delta, 3);
              thetaCell = formatSignedNumber(theta, 3);
            }

            const ivCell = ivRaw != null && ivRaw > 0 ? `${(ivRaw * 100).toFixed(1)}%` : "--";
            const oiBarPct = Math.min((oiRaw / maxOi) * 100, 100).toFixed(1);
            const oiFormatted = oiRaw >= 1000 ? `${(oiRaw / 1000).toFixed(1)}K` : String(oiRaw || "--");

            return `
              <tr class="${isAtm ? "options-atm-row" : ""}">
                <td><strong class="${isAtm ? "accent" : ""}">${tabularValue(contract.strike?.fmt || contract.strike || "--")}</strong></td>
                <td>${tabularValue(bidRaw != null ? `$${bidRaw.toFixed(2)}` : "--")}</td>
                <td>${tabularValue(askRaw != null ? `$${askRaw.toFixed(2)}` : "--")}</td>
                <td class="muted-cell">${tabularValue(spreadCell)}</td>
                <td class="muted-cell">${tabularValue(ivCell)}</td>
                <td class="greek-cell">${tabularValue(deltaCell)}</td>
                <td class="greek-cell">${tabularValue(thetaCell)}</td>
                <td>${tabularValue(contract.volume?.fmt || contract.volume || "--")}</td>
                <td>
                  <div class="oi-bar-cell">
                    <div class="oi-bar-track"><div class="oi-bar-fill" style="width:${oiBarPct}%"></div></div>
                    <span>${oiFormatted}</span>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderGreeksSnapshot(chain, greekCtx) {
  const { spot, years, riskFreeRate, fallbackIv, calculateBlackScholes } = greekCtx;
  if (!spot || !calculateBlackScholes) {
    return `
      <article class="card greeks-card">
        <header class="card-head card-head-split">
          <h4>🎯 Greeks Snapshot · ATM</h4>
          <small>Waiting for chain data</small>
        </header>
        <div class="empty-inline">Greeks appear once a chain with implied volatility loads.</div>
      </article>
    `;
  }

  const atmCall = nearestStrike(chain.calls || [], spot);
  const atmPut = nearestStrike(chain.puts || [], spot);
  const atmStrike = rawNumber(atmCall?.strike) ?? rawNumber(atmPut?.strike) ?? spot;
  const callIv = rawNumber(atmCall?.impliedVolatility) ?? fallbackIv;
  const putIv = rawNumber(atmPut?.impliedVolatility) ?? fallbackIv;
  const blendedIv = ((callIv || fallbackIv) + (putIv || fallbackIv)) / 2;

  const bs = calculateBlackScholes({
    spot,
    strike: atmStrike,
    years,
    rate: riskFreeRate,
    volatility: blendedIv * 100,
  });

  const daysToExpiry = Math.max(Math.round(years * 365), 1);

  const cell = (label, value, subtitle = "") => `
    <div class="greek-stat">
      <span class="greek-stat-label">${label}</span>
      <strong>${tabularValue(value)}</strong>
      ${subtitle ? `<small>${subtitle}</small>` : ""}
    </div>
  `;

  return `
    <article class="card greeks-card">
      <header class="card-head card-head-split">
        <h4>🎯 Greeks Snapshot · ATM ${atmStrike.toFixed(2)}</h4>
        <small>${daysToExpiry}d to expiry · IV ${(blendedIv * 100).toFixed(1)}% · r ${riskFreeRate.toFixed(2)}%</small>
      </header>
      <div class="greeks-grid">
        <div class="greek-col">
          <h5 class="positive">Call</h5>
          ${cell("Model Price", `$${bs.call.toFixed(2)}`, `Spot $${spot.toFixed(2)}`)}
          ${cell("Δ Delta", formatGreek(bs.callDelta, 3), "Price sensitivity")}
          ${cell("Γ Gamma", formatGreek(bs.gamma, 4), "Δ convexity")}
          ${cell("Θ Theta", formatSignedNumber(bs.callTheta, 3), "$/day decay")}
          ${cell("ν Vega", formatGreek(bs.vega, 3), "$ / 1% IV")}
          ${cell("ρ Rho", formatSignedNumber(bs.callRho, 3), "$ / 1% rate")}
        </div>
        <div class="greek-col">
          <h5 class="negative">Put</h5>
          ${cell("Model Price", `$${bs.put.toFixed(2)}`, `Strike $${atmStrike.toFixed(2)}`)}
          ${cell("Δ Delta", formatGreek(bs.putDelta, 3), "Price sensitivity")}
          ${cell("Γ Gamma", formatGreek(bs.gamma, 4), "shared w/ call")}
          ${cell("Θ Theta", formatSignedNumber(bs.putTheta, 3), "$/day decay")}
          ${cell("ν Vega", formatGreek(bs.vega, 3), "$ / 1% IV")}
          ${cell("ρ Rho", formatSignedNumber(bs.putRho, 3), "$ / 1% rate")}
        </div>
      </div>
    </article>
  `;
}

// Strategy definitions: each generates a payoff at expiry given spot price S
// Returns net P&L per contract (× 100 shares) at price S
const STRATEGIES = {
  "long-call": {
    label: "Long Call",
    legs: 1,
    desc: "Buy 1 call. Profit if price rises above strike + premium.",
    payoff: ({ S, K1, P1 }) => Math.max(S - K1, 0) * 100 - P1 * 100,
    breakevens: ({ K1, P1 }) => [K1 + P1],
    maxProfit: () => Infinity,
    maxLoss: ({ P1 }) => -P1 * 100,
  },
  "long-put": {
    label: "Long Put",
    legs: 1,
    desc: "Buy 1 put. Profit if price falls below strike − premium.",
    payoff: ({ S, K1, P1 }) => Math.max(K1 - S, 0) * 100 - P1 * 100,
    breakevens: ({ K1, P1 }) => [K1 - P1],
    maxProfit: ({ K1, P1 }) => (K1 - P1) * 100,
    maxLoss: ({ P1 }) => -P1 * 100,
  },
  "covered-call": {
    label: "Covered Call",
    legs: 1,
    desc: "Hold 100 shares + sell 1 call. Income if price stays below strike.",
    payoff: ({ S, K1, P1, spot }) => (S - spot) * 100 + Math.min(K1 - S, 0) * 100 + P1 * 100,
    breakevens: ({ P1, spot }) => [spot - P1],
    maxProfit: ({ K1, P1, spot }) => (K1 - spot + P1) * 100,
    maxLoss: ({ P1, spot }) => -(spot - P1) * 100,
  },
  "bull-call-spread": {
    label: "Bull Call Spread",
    legs: 2,
    desc: "Buy lower call, sell higher call. Capped profit, defined risk.",
    payoff: ({ S, K1, P1, K2, P2 }) =>
      (Math.max(S - K1, 0) - Math.max(S - K2, 0)) * 100 - (P1 - P2) * 100,
    breakevens: ({ K1, P1, P2 }) => [K1 + (P1 - P2)],
    maxProfit: ({ K1, P1, K2, P2 }) => (K2 - K1 - (P1 - P2)) * 100,
    maxLoss: ({ P1, P2 }) => -(P1 - P2) * 100,
  },
  "long-straddle": {
    label: "Long Straddle",
    legs: 2,
    desc: "Buy ATM call + ATM put. Profit on big moves either direction.",
    payoff: ({ S, K1, P1, P2 }) =>
      Math.max(S - K1, 0) * 100 + Math.max(K1 - S, 0) * 100 - (P1 + P2) * 100,
    breakevens: ({ K1, P1, P2 }) => [K1 - (P1 + P2), K1 + (P1 + P2)],
    maxProfit: () => Infinity,
    maxLoss: ({ P1, P2 }) => -(P1 + P2) * 100,
  },
};

function renderStrategyPnL(panel, chain, state) {
  const calls = chain?.calls || [];
  const puts = chain?.puts || [];
  const spot = rawNumber(chain?.spot) || 0;
  if (!spot || (!calls.length && !puts.length)) {
    return ""; // Don't render if there's no chain data
  }

  // Read user selection from per-panel state, or default to long-call
  const sel = state.optionsStrategy?.[panel] || {};
  const stratKey = sel.strategy || "long-call";
  const strategy = STRATEGIES[stratKey] || STRATEGIES["long-call"];

  // Pick legs from chain - default to ATM
  const atmCall = nearestStrike(calls, spot);
  const atmPut = nearestStrike(puts, spot);

  // Strike 1: use selected or ATM
  const allStrikes = [...calls, ...puts].map((c) => rawNumber(c.strike)).filter(Number.isFinite);
  const uniqueStrikes = [...new Set(allStrikes)].sort((a, b) => a - b);

  const k1 = sel.k1 != null ? Number(sel.k1) : (atmCall ? rawNumber(atmCall.strike) : spot);
  const k2 = sel.k2 != null ? Number(sel.k2) : (uniqueStrikes.find((s) => s > k1) || k1 + 5);

  // Premium for k1 (call price by default; put price for long-put)
  const premiumLookup = (strikes, contracts) => {
    const c = contracts.find((x) => rawNumber(x.strike) === strikes);
    if (!c) return 0;
    const last = rawNumber(c.lastPrice) || rawNumber(c.last);
    if (last) return last;
    const bid = rawNumber(c.bid) || 0;
    const ask = rawNumber(c.ask) || 0;
    return (bid + ask) / 2 || 0;
  };

  let p1, p2;
  switch (stratKey) {
    case "long-put":
      p1 = premiumLookup(k1, puts);
      p2 = 0;
      break;
    case "long-straddle":
      p1 = premiumLookup(k1, calls);
      p2 = premiumLookup(k1, puts);
      break;
    case "bull-call-spread":
      p1 = premiumLookup(k1, calls);
      p2 = premiumLookup(k2, calls);
      break;
    case "covered-call":
      p1 = premiumLookup(k1, calls);
      p2 = 0;
      break;
    default: // long-call
      p1 = premiumLookup(k1, calls);
      p2 = 0;
  }

  // Generate payoff curve from -50% to +50% of spot
  const minS = spot * 0.5;
  const maxS = spot * 1.5;
  const points = 80;
  const payoffPoints = [];
  for (let i = 0; i < points; i++) {
    const S = minS + (maxS - minS) * (i / (points - 1));
    const pnl = strategy.payoff({ S, K1: k1, P1: p1, K2: k2, P2: p2, spot });
    payoffPoints.push({ S, pnl });
  }

  const pnls = payoffPoints.map((p) => p.pnl);
  const maxPnl = Math.max(...pnls);
  const minPnl = Math.min(...pnls);
  const range = Math.max(Math.abs(maxPnl), Math.abs(minPnl)) * 1.15;
  const yMin = -range;
  const yMax = range;

  // Build SVG path
  const W = 720;
  const H = 240;
  const PAD_L = 60;
  const PAD_R = 20;
  const PAD_T = 20;
  const PAD_B = 36;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const xScale = (S) => PAD_L + ((S - minS) / (maxS - minS)) * innerW;
  const yScale = (pnl) => PAD_T + (1 - (pnl - yMin) / (yMax - yMin)) * innerH;

  // Split path into profit and loss segments for color
  const path = payoffPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.S).toFixed(1)} ${yScale(p.pnl).toFixed(1)}`).join(" ");

  // Profit area (above zero) and loss area (below zero) shading
  const zeroY = yScale(0);
  const profitArea = payoffPoints.map((p, i) => {
    const x = xScale(p.S);
    const y = yScale(Math.max(p.pnl, 0));
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + ` L ${xScale(maxS).toFixed(1)} ${zeroY.toFixed(1)} L ${xScale(minS).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const lossArea = payoffPoints.map((p, i) => {
    const x = xScale(p.S);
    const y = yScale(Math.min(p.pnl, 0));
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + ` L ${xScale(maxS).toFixed(1)} ${zeroY.toFixed(1)} L ${xScale(minS).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const breakevens = strategy.breakevens({ K1: k1, P1: p1, K2: k2, P2: p2, spot }) || [];
  const maxProfit = strategy.maxProfit({ K1: k1, P1: p1, K2: k2, P2: p2, spot });
  const maxLoss = strategy.maxLoss({ K1: k1, P1: p1, K2: k2, P2: p2, spot });

  const fmtMoney = (v) => {
    if (!Number.isFinite(v)) return v > 0 ? "Unlimited" : "--";
    const sign = v >= 0 ? "+$" : "-$";
    return sign + Math.abs(v).toFixed(0);
  };

  // Strike picker - show closest 12 strikes
  const closeStrikes = uniqueStrikes
    .filter((s) => s >= spot * 0.7 && s <= spot * 1.3)
    .slice(0, 16);

  return `
    <article class="card pnl-strategy-card">
      <header class="card-head card-head-split">
        <h4>📊 Strategy P&amp;L · ${strategy.label}</h4>
        <small>${strategy.desc}</small>
      </header>
      <div class="pnl-strategy-toolbar">
        <div class="pnl-control">
          <label>Strategy</label>
          <select data-pnl-strategy="${panel}">
            ${Object.entries(STRATEGIES).map(([key, s]) => `<option value="${key}" ${stratKey === key ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
        </div>
        <div class="pnl-control">
          <label>Strike ${strategy.legs > 1 ? "1 (long)" : ""}</label>
          <select data-pnl-k1="${panel}">
            ${closeStrikes.map((s) => `<option value="${s}" ${Math.abs(s - k1) < 0.01 ? "selected" : ""}>$${s.toFixed(2)}</option>`).join("")}
          </select>
        </div>
        ${strategy.legs > 1 && stratKey === "bull-call-spread" ? `
          <div class="pnl-control">
            <label>Strike 2 (short)</label>
            <select data-pnl-k2="${panel}">
              ${closeStrikes.map((s) => `<option value="${s}" ${Math.abs(s - k2) < 0.01 ? "selected" : ""}>$${s.toFixed(2)}</option>`).join("")}
            </select>
          </div>` : ""}
      </div>
      <div class="pnl-strategy-stats">
        <div class="pnl-stat">
          <span>Max Profit</span>
          <strong class="positive">${fmtMoney(maxProfit)}</strong>
        </div>
        <div class="pnl-stat">
          <span>Max Loss</span>
          <strong class="negative">${fmtMoney(maxLoss)}</strong>
        </div>
        <div class="pnl-stat">
          <span>Breakeven${breakevens.length > 1 ? "s" : ""}</span>
          <strong>${breakevens.map((b) => `$${b.toFixed(2)}`).join(" / ")}</strong>
        </div>
        <div class="pnl-stat">
          <span>Net Cost / Credit</span>
          <strong class="${(stratKey === "bull-call-spread" ? p1 - p2 : p1 + p2) >= 0 ? "negative" : "positive"}">
            ${stratKey === "bull-call-spread"
              ? `$${(p1 - p2).toFixed(2)}` + " debit"
              : stratKey === "covered-call"
                ? `$${p1.toFixed(2)}` + " credit"
                : `$${(p1 + p2).toFixed(2)}` + " debit"}
          </strong>
        </div>
      </div>
      <div class="pnl-chart-wrap">
        <svg class="pnl-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Payoff diagram">
          <defs>
            <linearGradient id="pnl-profit-grad-${panel}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(47,207,132,0.32)" />
              <stop offset="100%" stop-color="rgba(47,207,132,0.02)" />
            </linearGradient>
            <linearGradient id="pnl-loss-grad-${panel}" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stop-color="rgba(255,76,108,0.32)" />
              <stop offset="100%" stop-color="rgba(255,76,108,0.02)" />
            </linearGradient>
          </defs>
          <!-- grid lines -->
          ${[0.25, 0.5, 0.75].map((t) => {
            const y = PAD_T + t * innerH;
            return `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="rgba(123,145,181,0.08)" stroke-dasharray="2,3" />`;
          }).join("")}
          <!-- shaded areas -->
          <path d="${profitArea}" fill="url(#pnl-profit-grad-${panel})" />
          <path d="${lossArea}" fill="url(#pnl-loss-grad-${panel})" />
          <!-- zero line -->
          <line x1="${PAD_L}" y1="${zeroY}" x2="${W - PAD_R}" y2="${zeroY}" stroke="rgba(123,145,181,0.55)" stroke-width="1" />
          <!-- spot line -->
          <line x1="${xScale(spot)}" y1="${PAD_T}" x2="${xScale(spot)}" y2="${H - PAD_B}" stroke="rgba(255,200,60,0.65)" stroke-dasharray="3,3" stroke-width="1" />
          <text x="${xScale(spot) + 4}" y="${PAD_T + 12}" fill="rgb(255,200,60)" font-size="10" font-family="monospace">SPOT $${spot.toFixed(0)}</text>
          <!-- breakeven markers -->
          ${breakevens.filter((b) => b > minS && b < maxS).map((b) => `
            <line x1="${xScale(b)}" y1="${PAD_T}" x2="${xScale(b)}" y2="${H - PAD_B}" stroke="rgba(155,175,255,0.6)" stroke-dasharray="2,3" stroke-width="1" />
            <text x="${xScale(b) + 3}" y="${H - PAD_B - 4}" fill="rgb(155,175,255)" font-size="9" font-family="monospace">BE $${b.toFixed(0)}</text>
          `).join("")}
          <!-- payoff curve -->
          <path d="${path}" fill="none" stroke="var(--accent, #2fcf84)" stroke-width="2" stroke-linejoin="round" />
          <!-- y-axis labels -->
          <text x="${PAD_L - 8}" y="${yScale(0) + 3}" text-anchor="end" font-size="10" font-family="monospace" fill="rgba(123,145,181,0.9)">$0</text>
          <text x="${PAD_L - 8}" y="${PAD_T + 8}" text-anchor="end" font-size="10" font-family="monospace" fill="rgba(47,207,132,0.85)">${fmtMoney(yMax)}</text>
          <text x="${PAD_L - 8}" y="${H - PAD_B - 2}" text-anchor="end" font-size="10" font-family="monospace" fill="rgba(255,76,108,0.85)">${fmtMoney(yMin)}</text>
          <!-- x-axis labels -->
          ${[minS, spot, maxS].map((s, i) => `
            <text x="${xScale(s)}" y="${H - PAD_B + 14}" text-anchor="${i === 0 ? "start" : i === 2 ? "end" : "middle"}" font-size="10" font-family="monospace" fill="rgba(123,145,181,0.9)">$${s.toFixed(0)}</text>
          `).join("")}
        </svg>
      </div>
      <small class="pnl-disclaimer">Educational P&amp;L preview at expiry · Premium pulled from chain mid-price · Assumes 1 contract (×100 shares).</small>
    </article>
  `;
}

export function createOptionsRenderer(context) {
  const { state, optionsKey, calculateBlackScholes, isProUser } = context;

  return function renderOptions(panel) {
    // Tier gate — require sign-in for options chain
    if (!isProUser?.()) {
      const symbol = state.panelSymbols[panel] || "AAPL";
      return `
        <div class="stack">
          <div class="tier-gate-card">
            <div class="tier-gate-icon">📊</div>
            <h3>Options Chain: Sign in to unlock</h3>
            <p>Access live options chains with full Greeks (Δ delta, Θ theta, Γ gamma, V vega), implied volatility rank, open interest bars, and bid/ask spreads for any ticker.</p>
            <div class="tier-gate-preview tier-gate-table-preview">
              <table class="tier-gate-preview-table">
                <thead><tr><th>Strike</th><th>Bid</th><th>Ask</th><th>IV</th><th>Δ</th><th>OI</th></tr></thead>
                <tbody>
                  <tr class="tier-gate-blur"><td>$180</td><td>$4.20</td><td>$4.35</td><td>28.4%</td><td>0.612</td><td>4.2K</td></tr>
                  <tr class="options-atm-row tier-gate-blur"><td><strong>$185</strong></td><td>$2.10</td><td>$2.20</td><td>26.1%</td><td>0.500</td><td>8.8K</td></tr>
                  <tr class="tier-gate-blur"><td>$190</td><td>$0.85</td><td>$0.92</td><td>24.3%</td><td>0.321</td><td>12.1K</td></tr>
                </tbody>
              </table>
            </div>
            <div class="tier-gate-actions">
              <button class="btn btn-primary" type="button" data-settings-action="sign-in">Sign in free</button>
              <button class="btn btn-ghost" type="button" data-settings-action="create-account">Create account</button>
            </div>
            <small class="tier-gate-note">Free account · no credit card required</small>
          </div>
        </div>
      `;
    }

    const symbol = state.panelSymbols[panel] || state.optionsSelection.symbol;
    const expiration = state.optionsSelection.expiration || "nearest";
    const chain = state.optionsCache.get(optionsKey(symbol, expiration)) || state.optionsCache.get(optionsKey(symbol, "nearest"));
    const expirations = chain?.expirations || [];
    const callCount = chain?.calls?.length || 0;
    const putCount = chain?.puts?.length || 0;
    const spot = rawNumber(chain?.spot) || 0;

    // Determine expiration seconds (Yahoo returns unix secs).
    let expSec = 0;
    const rawExp = state.optionsSelection.expiration;
    if (rawExp && /^\d+$/.test(String(rawExp))) {
      expSec = Number(rawExp);
    } else if (expirations.length) {
      expSec = Number(expirations[0]) || 0;
    }

    const years = yearsUntil(expSec);
    const allContracts = [...(chain?.calls || []), ...(chain?.puts || [])];
    const fallbackIv = averageIv(allContracts);
    const riskFreeRate = 4.5; // percent — approximate 3-month T-bill
    const greekCtx = { spot, years, riskFreeRate, fallbackIv, calculateBlackScholes };

    // IV rank: where current avg IV sits in the min/max range of the chain
    const allIvs = allContracts.map((c) => rawNumber(c.impliedVolatility)).filter((v) => v != null && v > 0);
    const ivMin = allIvs.length ? Math.min(...allIvs) : 0;
    const ivMax = allIvs.length ? Math.max(...allIvs) : 0;
    const ivRank = ivMax > ivMin ? ((fallbackIv - ivMin) / (ivMax - ivMin)) * 100 : 50;
    const ivRankLabel = ivRank >= 80 ? "Rich" : ivRank <= 20 ? "Cheap" : "Normal";

    // Call / put OI ratio
    const callOi = (chain?.calls || []).reduce((s, c) => s + (rawNumber(c.openInterest) || 0), 0);
    const putOi = (chain?.puts || []).reduce((s, c) => s + (rawNumber(c.openInterest) || 0), 0);
    const pcRatio = callOi > 0 ? (putOi / callOi).toFixed(2) : "--";
    const pcSentiment = pcRatio !== "--" ? (Number(pcRatio) > 1.2 ? "Bearish" : Number(pcRatio) < 0.7 ? "Bullish" : "Neutral") : "";

    return `
      <section class="stack stack-lg">
        <div class="toolbar toolbar-wrap">
          <button class="btn btn-ghost" type="button" data-load-module="quote" data-target-symbol="${symbol}" data-target-panel="${panel}">📋 Quote</button>
          <button class="btn btn-ghost" type="button" data-load-module="chart" data-target-symbol="${symbol}" data-target-panel="${panel}">📈 Chart</button>
          <button class="btn btn-ghost" type="button" data-load-module="calculator" data-target-symbol="${symbol}" data-target-panel="${panel}">🧮 Calculator</button>
          <button class="btn btn-ghost" type="button" data-load-module="trade" data-target-symbol="${symbol}" data-target-panel="${panel}">💼 Trade Shares</button>
          <select data-options-expiry="${panel}">
            <option value="">Nearest expiry</option>
            ${expirations.slice(0, 10).map((value) => `<option value="${value}" ${String(value) === String(state.optionsSelection.expiration || "") ? "selected" : ""}>${formatExpiry(value)}</option>`).join("")}
          </select>
          <button class="btn btn-primary" type="button" data-refresh-options="${panel}:${symbol}">Refresh chain</button>
        </div>

        <div class="card-grid card-grid-home">
          <article class="card stat-card">
            <span>Underlying</span>
            <strong>${symbol}</strong>
            <small>${chain?.spot ? tabularValue(formatPrice(chain.spot, symbol), { flashKey: "quote:" + symbol + ":price", currentPrice: chain.spot }) : "Awaiting chain data"}</small>
          </article>
          <article class="card stat-card">
            <span>Calls</span>
            <strong class="positive">${tabularValue(callCount)}</strong>
            <small>${callCount ? "Contracts loaded" : "Waiting for data"}</small>
          </article>
          <article class="card stat-card">
            <span>Puts</span>
            <strong class="negative">${tabularValue(putCount)}</strong>
            <small>${putCount ? "Contracts loaded" : "Waiting for data"}</small>
          </article>
          <article class="card stat-card">
            <span>ATM IV</span>
            <strong>${tabularValue(`${(fallbackIv * 100).toFixed(1)}%`)}</strong>
            <small>${Math.max(Math.round(years * 365), 1)}d to expiry</small>
          </article>
          <article class="card stat-card">
            <span style="display:flex;align-items:center;gap:5px">IV Rank <button class="pro-lock-badge" type="button" data-open-pricing title="Upgrade to Pro">🔒 Pro</button></span>
            <strong class="${ivRank >= 80 ? "negative" : ivRank <= 20 ? "positive" : ""}">${allIvs.length ? `${ivRank.toFixed(0)}%ile` : "--"}</strong>
            <small>${allIvs.length ? ivRankLabel : "No chain data"}</small>
          </article>
          <article class="card stat-card">
            <span style="display:flex;align-items:center;gap:5px">P/C Ratio <button class="pro-lock-badge" type="button" data-open-pricing title="Upgrade to Pro">🔒 Pro</button></span>
            <strong class="${pcRatio !== "--" && Number(pcRatio) > 1.2 ? "negative" : Number(pcRatio) < 0.7 ? "positive" : ""}">${pcRatio}</strong>
            <small>${pcSentiment}</small>
          </article>
        </div>

        ${renderGreeksSnapshot(chain || { calls: [], puts: [], spot: 0 }, greekCtx)}

        ${renderStrategyPnL(panel, chain || { calls: [], puts: [], spot: 0 }, state)}

        <div class="split-grid">
          <article class="card">
            <header class="card-head card-head-split"><h4>📈 Calls</h4><small>${callCount} contracts</small></header>
            ${renderOptionsTable(chain?.calls || [], "call", greekCtx)}
          </article>
          <article class="card">
            <header class="card-head card-head-split"><h4>📉 Puts</h4><small>${putCount} contracts</small></header>
            ${renderOptionsTable(chain?.puts || [], "put", greekCtx)}
          </article>
        </div>
      </section>
    `;
  };
}
