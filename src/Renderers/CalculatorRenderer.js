import { tabularValue } from "./Common.js";

function calcInput(label, key, value, unit = "") {
  return `<label class="calc-input"><span>${label}${unit ? " (" + unit + ")" : ""}</span><input data-calc-key="${key}" value="${value}" /></label>`;
}

export function createCalculatorRenderer(context) {
  const { state, buildQuote, calculateBlackScholes, calculateBond } = context;

  return function renderCalculator(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const quote = buildQuote(symbol);
    const optionInput = { ...state.calculator.option, spot: quote?.price || state.calculator.option.spot };
    const option = calculateBlackScholes(optionInput);
    const bond = calculateBond(state.calculator.bond);

    // Intrinsic & time value for call and put
    const intrinsicCall = Math.max(0, optionInput.spot - state.calculator.option.strike);
    const timeValueCall = option.call - intrinsicCall;
    const intrinsicPut = Math.max(0, state.calculator.option.strike - optionInput.spot);
    const timeValuePut = option.put - intrinsicPut;

    // Expected move: S × σ × √T  (annualised σ projected over the option's tenor)
    const safeYears = Math.max(Number(state.calculator.option.years), 0.0001);
    const expectedMoveDollar = optionInput.spot * (state.calculator.option.volatility / 100) * Math.sqrt(safeYears);
    const expectedMovePct = (state.calculator.option.volatility / 100) * Math.sqrt(safeYears) * 100;

    // DV01 — dollar-value of 1 basis-point move in yield
    const dv01 = (bond.modifiedDuration * bond.price * 0.0001).toFixed(4);

    // Moneyness label
    const strikeRatio = optionInput.spot / state.calculator.option.strike;
    const moneyness = strikeRatio > 1.02 ? "ITM" : strikeRatio < 0.98 ? "OTM" : "ATM";
    const moneynessClass = moneyness === "ITM" ? "positive" : moneyness === "OTM" ? "negative" : "";

    return `
      <section class="split-grid">
        <article class="card">
          <header class="card-head card-head-split">
            <h4>⚡ Black-Scholes Pricing</h4>
            <small>${symbol} · ${quote ? "$" + Number(quote.price).toFixed(2) : "Manual"} · <span class="${moneynessClass}">${moneyness}</span></small>
          </header>
          <div class="calc-grid">
            ${calcInput("Spot Price", "option.spot", optionInput.spot, "$")}
            ${calcInput("Strike Price", "option.strike", state.calculator.option.strike, "$")}
            ${calcInput("Time to Expiry", "option.years", state.calculator.option.years, "years")}
            ${calcInput("Risk-Free Rate", "option.rate", state.calculator.option.rate, "%")}
            ${calcInput("Implied Vol", "option.volatility", state.calculator.option.volatility, "%")}
          </div>
          <div class="calc-results">
            <p>Call Price: <strong class="positive">${tabularValue("$" + option.call.toFixed(4))}</strong></p>
            <p>Put Price: <strong class="negative">${tabularValue("$" + option.put.toFixed(4))}</strong></p>
            <p>Intrinsic (Call): <strong>${tabularValue("$" + intrinsicCall.toFixed(2))}</strong><small class="calc-aside"> Put: $${intrinsicPut.toFixed(2)}</small></p>
            <p>Time Value (Call): <strong>${tabularValue("$" + timeValueCall.toFixed(4))}</strong><small class="calc-aside"> Put: $${timeValuePut.toFixed(4)}</small></p>
            <p>Expected Move: <strong>±$${expectedMoveDollar.toFixed(2)}</strong><small class="calc-aside"> (${expectedMovePct.toFixed(1)}%)</small></p>
          </div>
          <div class="calc-greeks-header">Greeks</div>
          <div class="calc-greeks-grid">
            <div class="calc-greek">
              <span title="Call delta — sensitivity to spot price move">Δ Call</span>
              <strong>${option.callDelta.toFixed(4)}</strong>
            </div>
            <div class="calc-greek">
              <span title="Put delta — always negative">Δ Put</span>
              <strong class="negative">${option.putDelta.toFixed(4)}</strong>
            </div>
            <div class="calc-greek">
              <span title="Gamma — rate of delta change per $1 spot move">Γ Gamma</span>
              <strong>${option.gamma.toFixed(6)}</strong>
            </div>
            <div class="calc-greek">
              <span title="Vega — price change per 1% IV move">V Vega</span>
              <strong>${option.vega.toFixed(4)}</strong>
            </div>
            <div class="calc-greek">
              <span title="Theta — daily time decay on a call">Θ Call/day</span>
              <strong class="negative">${option.callTheta.toFixed(4)}</strong>
            </div>
            <div class="calc-greek">
              <span title="Theta — daily time decay on a put">Θ Put/day</span>
              <strong class="negative">${option.putTheta.toFixed(4)}</strong>
            </div>
            <div class="calc-greek">
              <span title="Rho — price change per 1% rate move (call)">ρ Call</span>
              <strong>${option.callRho.toFixed(4)}</strong>
            </div>
            <div class="calc-greek">
              <span title="Rho — price change per 1% rate move (put)">ρ Put</span>
              <strong class="negative">${option.putRho.toFixed(4)}</strong>
            </div>
          </div>
        </article>
        <article class="card">
          <header class="card-head card-head-split"><h4>🏦 Bond Pricing</h4><small>Fixed income valuation</small></header>
          <div class="calc-grid">
            ${calcInput("Face Value", "bond.face", state.calculator.bond.face, "$")}
            ${calcInput("Coupon Rate", "bond.coupon", state.calculator.bond.coupon, "%")}
            ${calcInput("Yield to Maturity", "bond.ytm", state.calculator.bond.ytm, "%")}
            ${calcInput("Maturity", "bond.maturity", state.calculator.bond.maturity, "years")}
            ${calcInput("Frequency", "bond.frequency", state.calculator.bond.frequency, "/yr")}
          </div>
          <div class="calc-results">
            <p>Clean Price: <strong>${tabularValue("$" + bond.price.toFixed(4))}</strong></p>
            <p>Macaulay Duration: <strong>${tabularValue(bond.duration.toFixed(4) + " yrs")}</strong></p>
            <p>Modified Duration: <strong>${tabularValue(bond.modifiedDuration.toFixed(4))}</strong></p>
            <p>Convexity: <strong>${tabularValue(bond.convexity.toFixed(4))}</strong></p>
            <p>DV01: <strong>${tabularValue("$" + dv01)}</strong><small class="calc-aside"> per $1M notional: $${(Number(dv01) * 10000).toFixed(2)}</small></p>
            <p>Premium / Discount: <strong class="${bond.price >= state.calculator.bond.face ? "positive" : "negative"}">${tabularValue("$" + (bond.price - state.calculator.bond.face).toFixed(2))}</strong></p>
          </div>
        </article>
      </section>
    `;
  };
}
