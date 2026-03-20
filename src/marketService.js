import { apiRequest } from "./api.js";

export async function getStockDeepDive(ticker) {
  const symbol = String(ticker || "").trim().toUpperCase();
  if (!symbol) return null;

  try {
    return await apiRequest(`/api/market/deep-dive/${encodeURIComponent(symbol)}`);
  } catch (error) {
    console.error("Deep Dive Failed:", error);
    return null;
  }
}
