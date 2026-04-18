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

export function createOptionsRenderer(context) {
  const { state, optionsKey, calculateBlackScholes } = context;

  return function renderOptions(panel) {
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
