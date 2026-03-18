import axios from 'axios';
import { getBasePrice } from './stockMap';
import { getCachedStock, setCachedStock } from './localStorage';

// ─── Yahoo Finance v8 API via CORS proxies ───────────────────────────────────
// Yahoo Finance does not allow direct browser requests (CORS). We route through
// a free public CORS proxy. Two proxies are tried in order for reliability.
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

// ─── Mock fallback (deterministic, seeded by symbol + date) ─────────────────
const generateMockData = (symbol, startDate, endDate) => {
  const base = getBasePrice(symbol);
  const seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rand = (i) => { const x = Math.sin(seed + i) * 10000; return x - Math.floor(x); };
  const data = [];
  let price = base;
  let i = 0;
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const change = (rand(i) - 0.48) * base * 0.025;
    price = Math.max(price + change, base * 0.5);
    const open  = +(price - (rand(i + 1) - 0.5) * base * 0.01).toFixed(2);
    const close = +price.toFixed(2);
    data.push({
      date: d.toISOString().slice(0, 10),
      open,
      high: +(Math.max(open, close) + rand(i + 2) * base * 0.01).toFixed(2),
      low:  +(Math.min(open, close) - rand(i + 3) * base * 0.01).toFixed(2),
      close,
      volume: Math.floor(rand(i + 4) * 10000000 + 500000),
      weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
      simulated: true,
    });
    i++;
  }
  return data;
};

// ─── Parse Yahoo Finance chart response ──────────────────────────────────────
const parseYahooResponse = (data) => {
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No chart result in Yahoo Finance response');

  const timestamps = result.timestamp;
  const q = result.indicators.quote[0];
  if (!timestamps || !q) throw new Error('Missing timestamp/quote data');

  return timestamps
    .map((ts, i) => {
      if (q.close[i] == null) return null;       // skip gaps (holidays etc.)
      const d = new Date(ts * 1000);
      return {
        date:    d.toISOString().slice(0, 10),
        open:    +( q.open[i]   ?? q.close[i]).toFixed(2),
        high:    +( q.high[i]   ?? q.close[i]).toFixed(2),
        low:     +( q.low[i]    ?? q.close[i]).toFixed(2),
        close:   +( q.close[i]).toFixed(2),
        volume:  q.volume[i] ?? 0,
        weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
        simulated: false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
};

// ─── Main fetch function ──────────────────────────────────────────────────────
export const fetchStockData = async (stockItem, startDate, endDate) => {
  const cacheKey = `yf_${stockItem.symbol}_${startDate}_${endDate}`;
  const cached = getCachedStock(cacheKey);
  if (cached) return cached;

  const period1 = Math.floor(new Date(startDate).getTime() / 1000);
  const period2 = Math.floor(new Date(endDate).getTime() / 1000);
  const yahooUrl = `${YF_BASE}/${encodeURIComponent(stockItem.symbol)}?interval=1d&period1=${period1}&period2=${period2}`;

  // Try each CORS proxy in order
  let lastError = null;
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const res = await axios.get(buildProxyUrl(yahooUrl), { timeout: 12000 });
      const rows = parseYahooResponse(res.data);

      if (rows.length === 0) throw new Error('Yahoo returned 0 rows for date range');

      setCachedStock(cacheKey, rows);
      return rows;
    } catch (err) {
      lastError = err;
      console.warn(`Yahoo Finance attempt failed: ${err.message}`);
    }
  }

  // All proxies failed → deterministic mock fallback
  console.warn('All Yahoo Finance proxies failed, using simulated data:', lastError?.message);
  const mock = generateMockData(stockItem.symbol, startDate, endDate);
  setCachedStock(cacheKey, mock);
  return mock;
};
