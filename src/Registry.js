import { createAIRenderer } from "./Renderers/AIRenderer.js";
import { createBriefingRenderer } from "./Renderers/BriefingRenderer.js";
import { createCalculatorRenderer } from "./Renderers/CalculatorRenderer.js";
import { createChartRenderer } from "./Renderers/ChartRenderer.js";
import { createHeatmapRenderer } from "./Renderers/HeatmapRenderer.js";
import { createHomeRenderer } from "./Renderers/HomeRenderer.js";
import { createMacroRenderer } from "./Renderers/MacroRenderer.js";
import { createNewsRenderer } from "./Renderers/NewsRenderer.js";
import { createOptionsRenderer } from "./Renderers/OptionsRenderer.js";
import { createPortfolioRenderer } from "./Renderers/PortfolioRenderer.js";
import { createQuoteRenderer } from "./Renderers/QuoteRenderer.js";
import { createRulesRenderer } from "./Renderers/RulesRenderer.js";
import { createScreenerRenderer } from "./Renderers/ScreenerRenderer.js";
import { createTradeRenderer } from "./Renderers/TradeRenderer.js";

function normalizeKey(key) {
  return String(key || "").trim().toLowerCase();
}

export function createModuleRegistry(seedEntries = []) {
  const registry = new Map();

  seedEntries.forEach(([key, renderer]) => {
    registry.set(normalizeKey(key), renderer);
  });

  return {
    register(key, renderer) {
      registry.set(normalizeKey(key), renderer);
      return this;
    },
    get(key) {
      return registry.get(normalizeKey(key)) || null;
    },
    has(key) {
      return registry.has(normalizeKey(key));
    },
    entries() {
      return [...registry.entries()];
    },
  };
}

export function createDefaultModuleRegistry(context) {
  return createModuleRegistry([
    ["briefing", createBriefingRenderer(context)],
    ["home", createHomeRenderer(context)],
    ["quote", createQuoteRenderer(context)],
    ["chart", createChartRenderer(context)],
    ["news", createNewsRenderer(context)],
    ["screener", createScreenerRenderer(context)],
    ["heatmap", createHeatmapRenderer(context)],
    ["portfolio", createPortfolioRenderer(context)],
    ["trade", createTradeRenderer(context)],
    ["macro", createMacroRenderer(context)],
    ["options", createOptionsRenderer(context)],
    ["calculator", createCalculatorRenderer(context)],
    ["rules", createRulesRenderer(context)],
    ["ai", createAIRenderer(context)],
  ]);
}
