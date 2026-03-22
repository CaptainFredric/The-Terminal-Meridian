import { tabularValue } from "./Common.js";

function calcInput(label, key, value) {
  return `<label class="calc-input"><span>${label}</span><input data-calc-key="${key}" value="${value}" /></label>`;
}

export function createCalculatorRenderer(context) {
  const { state, buildQuote, calculateBlackScholes, calculateBond } = context;

  return function renderCalculator(panel) {
    const symbol = state.panelSymbols[panel] || "AAPL";
    const quote = buildQuote(symbol);
    const optionInput = { ...state.calculator.option, spot: quote?.price || state.calculator.option.spot };
    const option = calculateBlackScholes(optionInput);
    const bond = calculateBond(state.calculator.bond);

    return `
      <section class="split-grid">
        <article class="card">
          <header class="card-head card-head-split"><h4>Option pricing</h4><small>${symbol}</small></header>
          <div class="calc-grid">
            ${calcInput("Spot", "option.spot", optionInput.spot)}
            ${calcInput("Strike", "option.strike", state.calculator.option.strike)}
            ${calcInput("Years", "option.years", state.calculator.option.years)}
            ${calcInput("Rate %", "option.rate", state.calculator.option.rate)}
            ${calcInput("Vol %", "option.volatility", state.calculator.option.volatility)}
          </div>
          <div class="calc-results">
            <p>Call: <strong>${tabularValue(option.call.toFixed(4))}</strong></p>
            <p>Put: <strong>${tabularValue(option.put.toFixed(4))}</strong></p>
            <p>Delta: <strong>${tabularValue(option.delta.toFixed(4))}</strong></p>
            <p>Gamma: <strong>${tabularValue(option.gamma.toFixed(6))}</strong></p>
          </div>
        </article>
        <article class="card">
          <header class="card-head"><h4>Bond pricing</h4></header>
          <div class="calc-grid">
            ${calcInput("Face", "bond.face", state.calculator.bond.face)}
            ${calcInput("Coupon %", "bond.coupon", state.calculator.bond.coupon)}
            ${calcInput("YTM %", "bond.ytm", state.calculator.bond.ytm)}
            ${calcInput("Maturity", "bond.maturity", state.calculator.bond.maturity)}
            ${calcInput("Frequency", "bond.frequency", state.calculator.bond.frequency)}
          </div>
          <div class="calc-results">
            <p>Price: <strong>${tabularValue(bond.price.toFixed(4))}</strong></p>
            <p>Duration: <strong>${tabularValue(bond.duration.toFixed(4))}</strong></p>
            <p>Mod duration: <strong>${tabularValue(bond.modifiedDuration.toFixed(4))}</strong></p>
            <p>Convexity: <strong>${tabularValue(bond.convexity.toFixed(4))}</strong></p>
          </div>
        </article>
      </section>
    `;
  };
}
