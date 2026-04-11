const DIRECT_TIMEOUT = 12000;
const PROXY_GET = "https://api.allorigins.win/get?url=";
const PROXY_RAW = "https://api.allorigins.win/raw?url=";
const QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=";
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const OPTIONS_URL = "https://query1.finance.yahoo.com/v7/finance/options/";
const RSS_TO_JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const FX_URL = "https://open.er-api.com/v6/latest/USD";

function withTimeout(promise, timeout = DIRECT_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out.")), timeout)),
  ]);
}

async function fetchText(url) {
  const strategies = [
    () => fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Direct fetch failed: ${response.status}`);
      return response.text();
    }),
    () => fetch(`${PROXY_RAW}${encodeURIComponent(url)}`).then((response) => {
      if (!response.ok) throw new Error(`Raw proxy failed: ${response.status}`);
      return response.text();
    }),
    () => fetch(`${PROXY_GET}${encodeURIComponent(url)}`).then(async (response) => {
      if (!response.ok) throw new Error(`Wrapped proxy failed: ${response.status}`);
      const payload = await response.json();
      if (!payload.contents) throw new Error("Wrapped proxy had no contents.");
      return payload.contents;
    }),
  ];

  let lastError = null;
  for (const strategy of strategies) {
    try {
      return await withTimeout(strategy());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Unable to fetch remote data.");
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

export async function fetchQuotes(symbols) {
  const clean = [...new Set(symbols.filter(Boolean))];
  if (!clean.length) {
    return [];
  }

  const payload = await fetchJson(`${QUOTE_URL}${encodeURIComponent(clean.join(","))}`);
  const results = payload?.quoteResponse?.result ?? [];
  return results.map((item) => ({
    symbol: item.symbol,
    name: item.shortName ?? item.longName ?? item.symbol,
    exchange: item.fullExchangeName ?? item.exchange ?? "N/A",
    price: item.regularMarketPrice ?? item.postMarketPrice ?? item.bid ?? 0,
    changePct: item.regularMarketChangePercent ?? 0,
    change: item.regularMarketChange ?? 0,
    marketCap: item.marketCap ?? 0,
    volume: item.regularMarketVolume ?? 0,
    averageVolume: item.averageDailyVolume3Month ?? item.averageDailyVolume10Day ?? 0,
    dayHigh: item.regularMarketDayHigh ?? item.regularMarketPrice ?? 0,
    dayLow: item.regularMarketDayLow ?? item.regularMarketPrice ?? 0,
    previousClose: item.regularMarketPreviousClose ?? item.regularMarketPrice ?? 0,
    fiftyTwoWeekHigh: item.fiftyTwoWeekHigh ?? item.regularMarketDayHigh ?? 0,
    fiftyTwoWeekLow: item.fiftyTwoWeekLow ?? item.regularMarketDayLow ?? 0,
    trailingPE: item.trailingPE ?? item.forwardPE ?? null,
    epsTrailingTwelveMonths: item.epsTrailingTwelveMonths ?? null,
    dividendYield: item.trailingAnnualDividendYield ?? item.dividendYield ?? null,
    beta: item.beta ?? item.betaThreeYear ?? null,
    bid: item.bid ?? null,
    ask: item.ask ?? null,
    bidSize: item.bidSize ?? null,
    askSize: item.askSize ?? null,
    earningsTimestamp: item.earningsTimestamp ?? item.earningsTimestampStart ?? item.earningsTimestampEnd ?? null,
    currency: item.currency ?? "USD",
  }));
}

export async function fetchChart(symbol, range = "1mo", interval = "1d") {
  const payload = await fetchJson(`${CHART_URL}${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false`);
  const result = payload?.chart?.result?.[0];
  if (!result) {
    return [];
  }

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const closes = quote.close ?? [];
  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const volumes = quote.volume ?? [];

  return timestamps
    .map((timestamp, index) => ({
      timestamp,
      open: opens[index] ?? closes[index],
      high: highs[index] ?? closes[index],
      low: lows[index] ?? closes[index],
      close: closes[index],
      volume: volumes[index] ?? 0,
    }))
    .filter((item) => item.close != null);
}

export async function fetchOptions(symbol, expirationDate) {
  const suffix = expirationDate ? `?date=${encodeURIComponent(expirationDate)}` : "";
  const payload = await fetchJson(`${OPTIONS_URL}${encodeURIComponent(symbol)}${suffix}`);
  const result = payload?.optionChain?.result?.[0];
  if (!result) {
    return { expirations: [], calls: [], puts: [], spot: 0 };
  }

  const optionSet = result.options?.[0] ?? { calls: [], puts: [] };
  return {
    expirations: result.expirationDates ?? [],
    calls: (optionSet.calls ?? []).slice(0, 18),
    puts: (optionSet.puts ?? []).slice(0, 18),
    spot: result.quote?.regularMarketPrice ?? 0,
  };
}

export async function fetchNews() {
  const feeds = [
    "https://www.cnbc.com/id/100727362/device/rss/rss.html",
    "https://finance.yahoo.com/news/rssindex",
    "https://feeds.marketwatch.com/marketwatch/topstories/",
  ];

  const requests = feeds.map(async (feedUrl) => {
    try {
      const payload = await fetchJson(`${RSS_TO_JSON}${encodeURIComponent(feedUrl)}`);
      const items = Array.isArray(payload.items) ? payload.items : [];
      return items.slice(0, 6).map((item) => {
        const rawLink = String(item.link || "");
        const safeHref = rawLink.startsWith("http://") || rawLink.startsWith("https://") ? rawLink : "#";
        return {
          source: String(payload.feed?.title || "Feed"),
          headline: String(item.title || "Untitled"),
          time: item.pubDate
            ? new Date(item.pubDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
            : "--:--",
          link: safeHref,
        };
      });
    } catch {
      return [];
    }
  });

  const results = (await Promise.all(requests)).flat();
  return results.slice(0, 18);
}

export async function fetchFxRates() {
  const payload = await fetchJson(FX_URL);
  return payload?.rates ?? {};
}
