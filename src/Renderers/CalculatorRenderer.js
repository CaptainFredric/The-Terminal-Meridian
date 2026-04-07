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
    const intrinsicCall = Math.max(0, optionInput.spot - state.calculator.option.strike);
    const timeValueCall = option.call - intrinsicCall;

    return `
      <section class="split-grid">
        <article class="card">
          <header class="card-head card-head-split"><h4>⚡ Black-Scholes Pricing</h4><small>${symbol} · ${quote ? "$" + Number(quote.price).toFixed(2) : "Manual"}</small></header>
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
            <p>Delta (Δ): <strong>${tabularValue(option.delta.toFixed(4))}</strong></p>
            <p>Gamma (Γ): <strong>${tabularValue(option.gamma.toFixed(6))}</strong></p>
            <p>Intrinsic (Call): <strong>${tabularValue("$" + intrinsicCall.toFixed(2))}</strong></p>
            <p>Time Value: <strong>${tabularValue("$" + timeValueCall.toFixed(4))}</strong></p>
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
            <p>Premium/Discount: <strong class="${bond.price >= state.calculator.bond.face ? "positive" : "negative"}">${tabularValue("$" + (bond.price - state.calculator.bond.face).toFixed(2))}</strong></p>
          </div>
        </article>
      </section>
    `;
  };
}
