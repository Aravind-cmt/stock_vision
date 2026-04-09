import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Legend,
} from 'recharts';
import { 
  TreePine, Download, Settings, Shuffle, Target, 
  Calendar, TrendingUp, TrendingDown, Zap, Trash2, 
  RefreshCw, BarChart2, CheckCircle2, AlertTriangle, AlertCircle
} from 'lucide-react';
import '../styles/MLPrediction.css';

// ─── SYMBOLS ─────────────────────────────────────────────────────────────────
const SYMBOLS = [
  { label: 'Nifty 50 Index',        symbol: '^NSEI'        },
];

const DATE_RANGES = [
  { label: '2000 → Today (~25 years)', startYear: 2000 },
  { label: '2005 → Today (~20 years)', startYear: 2005 },
  { label: '2010 → Today (~15 years)', startYear: 2010 },
  { label: '2015 → Today (~10 years)', startYear: 2015 },
  { label: '2020 → Today (~5 years)',  startYear: 2020 },
];

const CORS_PROXIES = [
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

const CACHE_KEY = sym => `mlp_v5_${sym}`;
const TODAY = new Date().toISOString().slice(0, 10);

// ─── YAHOO FINANCE FETCH ─────────────────────────────────────────────────────
async function fetchYFinance(symbol, startYear = 2000, sinceDate = null) {
  const period1 = sinceDate
    ? Math.floor(new Date(sinceDate + 'T00:00:00Z').getTime() / 1000)
    : Math.floor(new Date(`${startYear}-01-01T00:00:00Z`).getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}`;

  for (const proxy of CORS_PROXIES) {
    try {
      const res    = await axios.get(proxy(url), { timeout: 20000 });
      const result = res.data?.chart?.result?.[0];
      if (!result) continue;
      const ts = result.timestamp;
      const q  = result.indicators.quote[0];
      const rows = ts.map((t, i) => {
        if (q.close[i] == null) return null;
        const d = new Date(t * 1000);
        return {
          Date:   d.toISOString().slice(0, 10),
          Close:  +(q.close[i]).toFixed(2),
          Open:   +(q.open[i]  ?? q.close[i]).toFixed(2),
          High:   +(q.high[i]  ?? q.close[i]).toFixed(2),
          Low:    +(q.low[i]   ?? q.close[i]).toFixed(2),
          Volume: q.volume[i] ?? 0,
        };
      }).filter(Boolean).sort((a, b) => a.Date.localeCompare(b.Date));
      if (rows.length > 0) return rows;
    } catch (_) { /* try next proxy */ }
  }
  return null;
}

// ─── FEATURE ENGINEERING ─────────────────────────────────────────────────────
const rolling = (arr, w, fn, minP = 1) =>
  arr.map((_, i) => {
    const s = arr.slice(Math.max(0, i - w + 1), i + 1);
    return s.length >= minP ? fn(s) : NaN;
  });
const rollMean = (a, w, mp = 1) => rolling(a, w, s => s.reduce((x, y) => x + y, 0) / s.length, mp);
const rollStd  = (a, w, mp = 1) => rolling(a, w, s => {
  const m = s.reduce((x, y) => x + y, 0) / s.length;
  return Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / s.length);
}, mp);
const rollMin = (a, w, mp = 1) => rolling(a, w, s => Math.min(...s), mp);
const rollMax = (a, w, mp = 1) => rolling(a, w, s => Math.max(...s), mp);

function calcRSI(close, period = 14) {
  const alpha = 1 / period; // com = period-1 in pandas EWM → alpha = 1/period
  const rsi = Array(close.length).fill(NaN);
  let avgG = 0, avgL = 0;
  for (let i = 1; i < close.length; i++) {
    const d = close[i] - close[i - 1];
    const g = Math.max(0,  d);
    const l = Math.max(0, -d);
    if (i === 1) { avgG = g; avgL = l; }
    else { avgG = alpha * g + (1 - alpha) * avgG; avgL = alpha * l + (1 - alpha) * avgL; }
    if (i >= period) rsi[i] = avgL === 0 ? 100 : 100 - (100 / (1 + avgG / avgL));
  }
  return rsi;
}
function calcATR(high, low, close) {
  const tr = close.map((c, i) => {
    if (i === 0) return high[i] - low[i];
    const pc = close[i - 1];
    return Math.max(high[i] - low[i], Math.abs(high[i] - pc), Math.abs(low[i] - pc));
  });
  // Python uses ewm(span=14), NOT simple rolling mean
  const alpha = 2 / (14 + 1);
  const out = [...tr];
  for (let i = 1; i < out.length; i++) out[i] = alpha * out[i] + (1 - alpha) * out[i - 1];
  return out;
}
function calcSMI(high, low, close) {
  const ewm = (arr, span) => {
    const a = 2 / (span + 1), out = [...arr];
    for (let i = 1; i < out.length; i++) out[i] = a * out[i] + (1 - a) * out[i - 1];
    return out;
  };
  const lo = rollMin(low, 14, 14), hi = rollMax(high, 14, 14);
  const mid = hi.map((h, i) => (h + lo[i]) / 2);
  const dS = ewm(ewm(close.map((c, i) => c - mid[i]), 3), 3);
  const hS = ewm(ewm(hi.map((h, i) => (h - lo[i]) / 2), 3), 3);
  return dS.map((d, i) => hS[i] === 0 || isNaN(hS[i]) ? NaN : 100 * d / hS[i]);
}
function calcVolatility(close) {
  const lr = close.map((c, i) => i === 0 ? NaN : Math.log(c / close[i - 1]));
  return rollStd(lr, 20, 20).map(v => isNaN(v) ? NaN : v * Math.sqrt(252)); // was 14, now 20
}
function calcZscoreVol(volume) {
  const m = rollMean(volume, 20, 1), s = rollStd(volume, 20, 1);
  return volume.map((v, i) => s[i] === 0 || isNaN(s[i]) ? NaN : (v - m[i]) / s[i]);
}
function calcPriceSpike(chg) {
  const m = rollMean(chg, 20, 1), s = rollStd(chg, 20, 1);
  return chg.map((c, i) => (c > m[i] + 2 * s[i] || c < m[i] - 2 * s[i]) ? 1 : 0);
}
function calcRVI(close) {
  const delta = close.map((c, i) => i === 0 ? 0 : c - close[i - 1]);
  const su = rollStd(delta.map(d => Math.max(0,  d)), 14, 14);
  const sd = rollStd(delta.map(d => Math.max(0, -d)), 14, 14);
  return su.map((u, i) => {
    const den = u + sd[i];
    return (!isNaN(u) && !isNaN(sd[i]) && den !== 0) ? 100 * u / den : NaN;
  });
}
function calcEMV(high, low, volume) {
  const mid = high.map((h, i) => (h + low[i]) / 2);
  const dist = mid.map((m, i) => i === 0 ? 0 : m - mid[i - 1]);
  const vs = rollMean(volume, 14, 1);
  const hl = high.map((h, i) => h - low[i]);
  const box = volume.map((v, i) => hl[i] === 0 || isNaN(vs[i]) || vs[i] === 0 ? NaN : (v / vs[i]) / hl[i]);
  return rollMean(dist.map((d, i) => box[i] === 0 || isNaN(box[i]) ? NaN : d / box[i]), 14, 14);
}
function calcGrade(chg) {
  return chg.map(c => c < -3 ? 0 : c < -1.5 ? 1 : c < -0.5 ? 2 : c <= 0.5 ? 3 : c <= 1.5 ? 4 : c <= 3 ? 5 : 6);
}

function normArr(arr) {
  const valid = arr.filter(v => !isNaN(v));
  if (!valid.length) return { norm: arr.map(() => 0), mn: 0, mx: 1 };
  const mn = Math.min(...valid), mx = Math.max(...valid), rng = mx - mn || 1;
  return { norm: arr.map(v => isNaN(v) ? 0 : (v - mn) / rng), mn, mx };
}

// ─── BUILD FULL FEATURE DATASET FROM RAW OHLCV ───────────────────────────────
function buildDataset(raw) {
  const close  = raw.map(r => r.Close);
  const high   = raw.map(r => r.High);
  const low    = raw.map(r => r.Low);
  const vol    = raw.map(r => r.Volume);
  const chgPct = close.map((c, i) => i === 0 ? 0 : ((c - close[i - 1]) / close[i - 1]) * 100);

  const rsi  = calcRSI(close);
  // ATR is still computed (used for spike detection context) but NOT in feature vector
  const atr  = calcATR(high, low, close);
  const smi  = calcSMI(high, low, close);
  const vola = calcVolatility(close);
  const zsv  = calcZscoreVol(vol);
  const spk  = calcPriceSpike(chgPct);
  const rvi  = calcRVI(close);
  const emv  = calcEMV(high, low, vol);
  const rn   = rvi.map((r, i) => emv[i] === 0 || isNaN(emv[i]) ? NaN : r / emv[i]);
  const grd  = calcGrade(chgPct);

  const lagRsi = [NaN, ...rsi.slice(0, -1)];
  const lagSmi = [NaN, ...smi.slice(0, -1)];

  // Bug 3 fix: 8 features, no ATR
  const { norm: nChg }  = normArr(chgPct);
  const { norm: nGrd }  = normArr(grd);
  const { norm: nZ }    = normArr(zsv);
  const { norm: nVol }  = normArr(vola);
  const { norm: nRN }   = normArr(rn);
  const { norm: nLSMI } = normArr(lagSmi);
  const { norm: nLRSI } = normArr(lagRsi);

  // Bug 4 fix: rolling 60-bar min/max of prevClose → 20-bar mean → normalize target
  const prevClose = [NaN, ...close.slice(0, -1)];
  const roll60min = rollMin(prevClose, 60, 60);
  const roll60max = rollMax(prevClose, 60, 60);
  const baseMin   = rollMean(roll60min, 20, 1);
  const baseMax   = rollMean(roll60max, 20, 1);
  const rangeDiff = baseMax.map((mx, i) => Math.max(mx - baseMin[i], 1e-6));

  const nextClose = [...close.slice(1), NaN];

  const rows = [];
  for (let i = 0; i < raw.length - 1; i++) {
    const rng = rangeDiff[i];
    const mn  = baseMin[i];
    if (isNaN(rng) || isNaN(mn)) continue;
    const y = (nextClose[i] - mn) / rng;
    // Bug 3: 8-element feature vector
    const x = [nChg[i], nGrd[i], nZ[i], nVol[i], nRN[i], spk[i], nLSMI[i], nLRSI[i]];
    if (x.some(isNaN) || isNaN(y)) continue;
    rows.push({ date: raw[i].Date, close: close[i], nextClose: nextClose[i],
                x, y, rsi: rsi[i], spike: spk[i],
                baseMin: mn, rangeDiff: rng }); // store per-row scale for inverse
  }

  // Live row (last bar, no future)
  const n = raw.length - 1;
  const liveX = [nChg[n], nGrd[n], nZ[n], nVol[n], nRN[n], spk[n], nLSMI[n], nLRSI[n]]
    .map(v => isNaN(v) ? 0 : v);

  return { rows, liveX, liveSpike: spk[n], liveClose: close[n], liveDate: raw[n].Date,
           liveBaseMin: baseMin[n], liveRangeDiff: rangeDiff[n] };
}

// ─── XGBOOST SIMULATION ───────────────────────────────────────────────────────
function trainXGB(Xtrain, ytrain) {
  const n = Xtrain.length, nFeat = Xtrain[0].length;
  const trees = [], residuals = [...ytrain];
  for (let t = 0; t < 100; t++) {
    const nSamp  = Math.floor(n * 0.8);
    const idxs   = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, nSamp);
    const feats  = Array.from({ length: nFeat }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, Math.ceil(nFeat * 0.8));
    let bFeat = -1, bThresh = 0, bGain = -Infinity, bL = 0, bR = 0;
    for (const f of feats) {
      const vals = idxs.map(i => Xtrain[i][f]).sort((a, b) => a - b);
      const thresh = vals[Math.floor(vals.length / 2)];
      const lIdx  = idxs.filter(i => Xtrain[i][f] <= thresh);
      const rIdx  = idxs.filter(i => Xtrain[i][f] >  thresh);
      if (lIdx.length < 2 || rIdx.length < 2) continue;
      const lM = lIdx.reduce((s, i) => s + residuals[i], 0) / lIdx.length;
      const rM = rIdx.reduce((s, i) => s + residuals[i], 0) / rIdx.length;
      const gain = -(lIdx.reduce((s, i) => s + (residuals[i] - lM) ** 2, 0) +
                     rIdx.reduce((s, i) => s + (residuals[i] - rM) ** 2, 0));
      if (gain > bGain) { bGain = gain; bFeat = f; bThresh = thresh; bL = lM; bR = rM; }
    }
    if (bFeat === -1) break;
    trees.push({ feat: bFeat, thresh: bThresh, left: bL, right: bR });
    for (let i = 0; i < n; i++)
      residuals[i] -= 0.05 * (Xtrain[i][bFeat] <= bThresh ? bL : bR);
  }
  return trees;
}

function predictXGB(trees, X, base) {
  return X.map(row => {
    let p = base;
    for (const t of trees) p += 0.05 * (row[t.feat] <= t.thresh ? t.left : t.right);
    return p;
  });
}

function featureImportance(Xtrain) {
  const names = ['Change%', 'grade_no', 'ZScore_Vol', 'Volatility', 'RN', 'PriceSpike', 'lag_SMI', 'lag_RSI'];
  return names.map((name, fi) => {
    const col = Xtrain.map(r => r[fi]);
    const m   = col.reduce((a, b) => a + b, 0) / col.length;
    return { name, importance: col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length };
  }).sort((a, b) => b.importance - a.importance)
    .map((f, _, arr) => ({ ...f, importance: +(f.importance / (arr[0].importance || 1) * 100).toFixed(1) }));
}

// ─── PREDICT FUNCTION (uses cached model) ────────────────────────────────────
function makePrediction(trees, base, liveX, liveSpike, liveClose, liveDate, liveBaseMin, liveRangeDiff) {
  const rawNorm   = predictXGB(trees, [liveX], base)[0];
  const adjNorm   = liveSpike === 1 ? 0.5 + 0.3 * (rawNorm - 0.5) : rawNorm;
  const nextPrice = +(adjNorm * liveRangeDiff + liveBaseMin).toFixed(2); // Bug 4 fix
  const diff      = +(nextPrice - liveClose).toFixed(2);
  const diffPct   = +((diff / liveClose) * 100).toFixed(2);

  const d = new Date(liveDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);

  return { nextPrice, diff, diffPct, nextDate: d.toISOString().slice(0, 10),
           todayClose: liveClose, todayDate: liveDate };
}

// ─── TEST METRICS ─────────────────────────────────────────────────────────────
function computeMetrics(rows, trees, base, splitAt) {
  const testSet   = rows.slice(splitAt);
  const Xtest     = testSet.map(r => r.x);
  const testNorms = predictXGB(trees, Xtest, base)
    .map((p, i) => testSet[i].spike === 1 ? 0.5 + 0.3 * (p - 0.5) : p);
  const predClose = testNorms.map((p, i) => {
    const { baseMin: mn, rangeDiff: rng } = testSet[i];
    return +(p * rng + mn).toFixed(2); // Bug 4 fix — per-row rolling scale
  });
  const actClose  = testSet.map(r => r.nextClose);
  const actMean   = actClose.reduce((a, b) => a + b, 0) / actClose.length;
  const ssTot     = actClose.reduce((a, c) => a + (c - actMean) ** 2, 0);
  const ssRes     = actClose.reduce((a, c, i) => a + (c - predClose[i]) ** 2, 0);
  const r2        = +(1 - ssRes / ssTot).toFixed(4);
  const mae       = +(actClose.reduce((a, c, i) => a + Math.abs(c - predClose[i]), 0) / actClose.length).toFixed(2);
  const rmse      = +(Math.sqrt(ssRes / actClose.length)).toFixed(2);
  const mape      = +(actClose.reduce((a, c, i) => a + Math.abs((c - predClose[i]) / c), 0) / actClose.length * 100).toFixed(2);
  const dirAcc    = +(testSet.reduce((a, r, i) => {
    if (i === 0) return a;
    return a + ((actClose[i] > testSet[i-1].close) === (predClose[i] > testSet[i-1].close) ? 1 : 0);
  }, 0) / (testSet.length - 1) * 100).toFixed(1);

  const chartN = Math.min(testSet.length, 120);
  const chartData = testSet.slice(-chartN).map((r, i) => ({
    date: r.date.slice(5),
    actual: actClose[testSet.length - chartN + i],
    predicted: predClose[testSet.length - chartN + i],
  }));

  const tableRows = testSet.slice(-20).map((r, i) => {
    const off = testSet.length - 20;
    const ac = actClose[off + i], pr = predClose[off + i];
    const df = +(pr - ac).toFixed(2);
    return { date: r.date, actual: ac.toFixed(2), predicted: pr.toFixed(2), diff: df,
             err: +(Math.abs(df) / ac * 100).toFixed(2), dir: df >= 0 ? 'up' : 'down',
             rsi: isNaN(r.rsi) ? '-' : r.rsi.toFixed(1), spike: r.spike };
  });

  return { r2, mae, rmse, mape, dirAcc, chartData, tableRows, testSize: testSet.length };
}

// ─── PIPELINE STEPS ──────────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { icon: Download, label: 'Fetch Data',        key: 'fetch'    },
  { icon: Settings, label: 'Engineer Features', key: 'features' },
  { icon: Shuffle,  label: 'Train/Test Split',  key: 'split'    },
  { icon: TreePine, label: 'XGBoost Train',     key: 'train'    },
  { icon: Target,   label: 'Predict Next Day',  key: 'predict'  },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,15,25,0.95)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? `₹${p.value.toFixed(2)}` : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const MLPredictionPage = () => {
  const [symbol,     setSymbol]     = useState('^NSEI');
  const [startYear,  setStartYear]  = useState(2000);
  const [status,     setStatus]     = useState({ type: 'info', msg: 'Checking cache…' });
  const [activeStep, setActiveStep] = useState(-1);
  const [results,    setResults]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [cacheInfo,  setCacheInfo]  = useState(null); // { lastDate, totalRows, trainedAt }

  // ── Load from cache on mount / symbol change ────────────────────────────
  useEffect(() => {
    const cached = loadCache(symbol);
    if (cached) {
      setCacheInfo({ lastDate: cached.liveDate, totalRows: cached.totalRows, trainedAt: cached.trainedAt });
      applyCache(cached);
    } else {
      setStatus({ type: 'info', msg: 'No cache found. Click "Full Train (2000→Today)" to build the model.' });
      setResults(null);
    }
  }, [symbol]);

  function loadCache(sym) {
    try {
      const raw = localStorage.getItem(CACHE_KEY(sym));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function saveCache(sym, data) {
    try { localStorage.setItem(CACHE_KEY(sym), JSON.stringify(data)); }
    catch (_) { console.warn('Cache save failed (localStorage full?)'); }
  }

  function clearCache(sym) {
    localStorage.removeItem(CACHE_KEY(sym));
    setCacheInfo(null);
    setResults(null);
    setStatus({ type: 'info', msg: 'Cache cleared. Click "Full Train" to rebuild.' });
  }

  // Apply cached model → generate all display results
  function applyCache(cached) {
    const { rows, trees, base, liveBaseMin, liveRangeDiff, liveX, liveSpike, liveClose, liveDate,
            totalRows, trainedAt, histChart, fi, trainSize } = cached;

    const pred    = makePrediction(trees, base, liveX, liveSpike, liveClose, liveDate, liveBaseMin, liveRangeDiff);
    const splitAt = Math.floor(rows.length * 0.8);
    const metrics = computeMetrics(rows, trees, base, splitAt);

    setResults({ ...pred, ...metrics, histChart, fi, trainSize, totalRows, trainedAt, dateRange: `${rows[0].date} → ${liveDate}` });
    const age = liveDate < TODAY ? `[Stale] Data is from ${liveDate} — click "Add Today's Data" to update.` : `[Valid] Last data: ${liveDate} · Trained: ${trainedAt}`;
    setStatus({ type: liveDate < TODAY ? 'info' : 'success', msg: age });
    setCacheInfo({ lastDate: liveDate, totalRows, trainedAt });
  }

  // ── FULL TRAIN from historical data ────────────────────────────────────
  const fullTrain = useCallback(async () => {
    setLoading(true); setResults(null);

    setActiveStep(0);
    setStatus({ type: 'loading', msg: `Fetching from Jan ${startYear} → Today. This may take 15–25 seconds…` });
    const raw = await fetchYFinance(symbol, Number(startYear));
    if (!raw || raw.length < 120) {
      setStatus({ type: 'error', msg: `Fetch failed or insufficient data (got ${raw?.length ?? 0} rows).` });
      setLoading(false); setActiveStep(-1); return;
    }

    setActiveStep(1);
    setStatus({ type: 'loading', msg: `Computing 9 features across ${raw.length} trading days…` });
    await new Promise(r => setTimeout(r, 50));
    const { rows, liveX, liveSpike, liveClose, liveDate, liveBaseMin, liveRangeDiff } = buildDataset(raw);

    if (rows.length < 80) {
      setStatus({ type: 'error', msg: 'Not enough clean rows. Try a longer date range.' });
      setLoading(false); setActiveStep(-1); return;
    }

    setActiveStep(2);
    setStatus({ type: 'loading', msg: `Splitting ${rows.length} samples: 80% train / 20% test…` });
    await new Promise(r => setTimeout(r, 50));
    const splitAt = Math.floor(rows.length * 0.8);
    const Xtrain  = rows.slice(0, splitAt).map(r => r.x);
    const ytrain  = rows.slice(0, splitAt).map(r => r.y);

    setActiveStep(3);
    setStatus({ type: 'loading', msg: `Training XGBoost on ${Xtrain.length} samples…` });
    await new Promise(r => setTimeout(r, 100));
    const base  = ytrain.reduce((a, b) => a + b, 0) / ytrain.length;
    const trees = trainXGB(Xtrain, ytrain);

    setActiveStep(4);
    setStatus({ type: 'loading', msg: 'Predicting test set & next-day close…' });
    await new Promise(r => setTimeout(r, 50));

    // Build history chart (monthly, stride)
    const stride    = Math.max(1, Math.floor(raw.length / 300));
    const histChart = raw.filter((_, i) => i % stride === 0).map(r => ({ date: r.Date.slice(0, 7), close: r.Close }));

    // Feature importance
    const fi = featureImportance(Xtrain);

    const trainedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const totalRows = raw.length;

    // Save cache (rows only store x, y, date, close, nextClose, rsi, spike — keep small)
    const cachePayload = {
      rows, trees, base, liveBaseMin, liveRangeDiff, liveX, liveSpike, liveClose, liveDate,
      totalRows, trainedAt, histChart, fi, trainSize: Xtrain.length,
    };
    saveCache(symbol, cachePayload);
    setCacheInfo({ lastDate: liveDate, totalRows, trainedAt });

    applyCache(cachePayload);
    setLoading(false);
    setActiveStep(-1);
  }, [symbol, startYear]);

  // ── DAILY UPDATE — fetch only the latest candle & re-predict ────────────
  const dailyUpdate = useCallback(async () => {
    const cached = loadCache(symbol);
    if (!cached) { setStatus({ type: 'error', msg: 'No cache. Run Full Train first.' }); return; }

    setLoading(true);
    setStatus({ type: 'loading', msg: `Fetching latest data since ${cached.liveDate}…` });

    // Fetch from the day after last cached date
    const sinceD = new Date(cached.liveDate + 'T00:00:00Z');
    sinceD.setUTCDate(sinceD.getUTCDate() + 1);
    const sinceStr = sinceD.toISOString().slice(0, 10);

    const newRaw = await fetchYFinance(symbol, null, sinceStr);

    if (!newRaw || newRaw.length === 0) {
      setStatus({ type: 'info', msg: `No new data since ${cached.liveDate} (market may be closed today).` });
      setLoading(false); return;
    }

    setStatus({ type: 'loading', msg: `Got ${newRaw.length} new candle(s). Updating features & prediction…` });
    await new Promise(r => setTimeout(r, 50));

    // We only need to update the "live" prediction row — historical rows are cached
    // Recompute live features using last ~30 rows from cache + new candles
    // Build a mini context window from the tail of cached rows
    const TAIL = 60; // need enough history for rolling windows
    const tailRows = cached.rows.slice(-TAIL);

    // Reconstruct mini OHLCV from cached close values + new raw
    // For the new candle, we set liveX by re-doing feature eng on the full tail length
    // Simple approach: re-fetch a short window to get accurate rolling features
    const shortStart = new Date(cached.liveDate + 'T00:00:00Z');
    shortStart.setUTCDate(shortStart.getUTCDate() - 80);
    const shortStartStr = shortStart.toISOString().slice(0, 10);
    const contextRaw = await fetchYFinance(symbol, null, shortStartStr);

    if (!contextRaw || contextRaw.length < 30) {
      setStatus({ type: 'error', msg: 'Could not fetch context window for feature update.' });
      setLoading(false); return;
    }

    const { liveX, liveSpike, liveClose, liveDate, liveBaseMin, liveRangeDiff } = buildDataset(contextRaw);

    // Append new rows to cached rows (using cached close/normalisation scale)
    const { rows: newRows } = buildDataset(contextRaw);
    // Only add rows newer than last cached date
    const freshRows = newRows.filter(r => r.date > cached.liveDate);

    const updatedRows = [...cached.rows, ...freshRows];
    const totalRows   = cached.totalRows + freshRows.length;

    // Update history chart with new closes
    const updatedHistChart = [...cached.histChart];
    newRaw.forEach(r => {
      const mo = r.Date.slice(0, 7);
      if (!updatedHistChart.find(h => h.date === mo))
        updatedHistChart.push({ date: mo, close: r.Close });
      else {
        const idx = updatedHistChart.findIndex(h => h.date === mo);
        updatedHistChart[idx].close = r.Close;
      }
    });

    const trainedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

    const updatedCache = {
      ...cached,
      rows: updatedRows, liveX, liveSpike, liveClose, liveDate,
      liveBaseMin, liveRangeDiff,
      totalRows, trainedAt, histChart: updatedHistChart,
    };
    saveCache(symbol, updatedCache);
    setCacheInfo({ lastDate: liveDate, totalRows, trainedAt });
    applyCache(updatedCache);
    setLoading(false);
  }, [symbol]);

  // ── Auto-run daily update on load if cache is stale ──────────────────────
  useEffect(() => {
    const cached = loadCache(symbol);
    if (cached && cached.liveDate < TODAY) {
      // Cache exists but date is old — auto-update in background
      setTimeout(() => dailyUpdate(), 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="mlp-outer bento-container">

      {/* Header */}
      <div className="mlp-header bento-tile bento-large">
        <div className="mlp-title-group">
          <h1>🌲 ML Prediction Engine</h1>
          <p>Features pre-computed &amp; cached · only latest candle fetched daily · XGBoost prediction</p>
        </div>
        <div className="mlp-badge">CACHED · DAILY UPDATE</div>
      </div>

      {/* Controls */}
      <div className="mlp-controls bento-tile bento-large">
        <div className="mlp-field">
          <label>Stock / Index</label>
          <select value={symbol} onChange={e => setSymbol(e.target.value)} disabled={loading}>
            {SYMBOLS.map(s => <option key={s.symbol} value={s.symbol}>{s.label} ({s.symbol})</option>)}
          </select>
        </div>
        <div className="mlp-field">
          <label>Training Range (Full Train only)</label>
          <select value={startYear} onChange={e => setStartYear(e.target.value)} disabled={loading}>
            {DATE_RANGES.map(d => <option key={d.startYear} value={d.startYear}>{d.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <button className="btn-predict glow-accent" onClick={fullTrain} disabled={loading} title="Fetch all history, engineer features, train model, cache everything">
            {loading ? '⏳ Running…' : '🔁 Full Train (2000→Today)'}
          </button>
          <button className="btn-update glow-accent" onClick={dailyUpdate} disabled={loading || !cacheInfo} title="Only fetch today's candle and update the prediction">
            📅 Add Today's Data
          </button>
          <button className="btn-danger" onClick={() => clearCache(symbol)} disabled={loading} title="Clear cached model for this symbol">
            🗑 Clear Cache
          </button>
        </div>
      </div>

      {/* Cache info */}
      {cacheInfo && (
        <div className="cache-info-bar">
          <span>💾 Cache: <strong>{cacheInfo.totalRows.toLocaleString()}</strong> trading days</span>
          <span>·</span>
          <span>Last data: <strong>{cacheInfo.lastDate}</strong></span>
          <span>·</span>
          <span>Trained: <strong>{cacheInfo.trainedAt}</strong></span>
          <span className={cacheInfo.lastDate < TODAY ? 'cache-stale' : 'cache-fresh'}>
            {cacheInfo.lastDate < TODAY ? '⚠️ Stale (auto-updating…)' : '✅ Up to date'}
          </span>
        </div>
      )}

      {/* Status */}
      <div className={`mlp-status ${status.type}`}>
        {loading && <div className="mlp-spinner" />}
        <span>{status.msg}</span>
      </div>

      {/* Pipeline Steps */}
      <div className="mlp-pipeline bento-tile bento-large" style={{ marginTop: '16px' }}>
        {PIPELINE_STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <span key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <div className={`pipeline-step ${activeStep === i ? 'active' : ''}`}>
                <span className="pipeline-step-icon"><Icon size={20} /></span>
                <span>{s.label}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && <span className="pipeline-arrow">→</span>}
            </span>
          );
        })}
      </div>

      {/* ── RESULTS ── */}
      {results && (
        <>
          {/* Next-Day Hero */}
          <div className="next-day-hero bento-tile bento-large">
            <div className="ndh-inner">
              <div className="ndh-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={20} /> Next Trading Day Forecast</div>
              <div className="ndh-date">{results.nextDate}</div>
              <div className={`ndh-price ${results.diff >= 0 ? 'up' : 'down'}`}>
                ₹{results.nextPrice.toFixed(2)}
              </div>
              <div className={`ndh-change ${results.diff >= 0 ? 'up' : 'down'}`}>
                {results.diff >= 0 ? '▲' : '▼'}&nbsp;₹{Math.abs(results.diff).toFixed(2)}
                &nbsp;({results.diffPct > 0 ? '+' : ''}{results.diffPct}%)
              </div>
              <div className="ndh-today">
                Today ({results.todayDate}): ₹{results.todayClose.toFixed(2)}
              </div>
            </div>
            <div className="ndh-stats">
              <div className="nds-item"><span className="nds-k">Data Range</span><span className="nds-v">{results.dateRange}</span></div>
              <div className="nds-item"><span className="nds-k">Total Trading Days</span><span className="nds-v">{results.totalRows?.toLocaleString()}</span></div>
              <div className="nds-item"><span className="nds-k">Train Samples</span><span className="nds-v">{results.trainSize?.toLocaleString()}</span></div>
              <div className="nds-item"><span className="nds-k">Test Samples</span><span className="nds-v">{results.testSize?.toLocaleString()}</span></div>
              <div className="nds-item"><span className="nds-k">Trained At</span><span className="nds-v">{results.trainedAt}</span></div>
              <div className="nds-item"><span className="nds-k">Signal</span><span className="nds-v" style={{ color: results.diff >= 0 ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: '6px' }}>{results.diff >= 0 ? <><TrendingUp size={16}/> BUY SIGNAL</> : <><TrendingDown size={16}/> SELL SIGNAL</>}</span></div>
            </div>
          </div>

          {/* Metrics */}
          <div className="mlp-metrics">
            {[
              { label: 'R² Score',       value: results.r2,          sub: '↑ closer to 1 is better', color: 'purple' },
              { label: 'MAE (₹)',         value: `₹${results.mae}`,   sub: 'Mean Absolute Error',     color: 'green'  },
              { label: 'RMSE (₹)',        value: `₹${results.rmse}`,  sub: 'Root Mean Sq. Error',     color: 'red'    },
              { label: 'MAPE',           value: `${results.mape}%`,   sub: 'Mean Abs. % Error',       color: 'orange' },
              { label: 'Direction Acc.', value: `${results.dirAcc}%`, sub: '% correct up/down calls', color: 'blue'   },
            ].map(m => (
              <div key={m.label} className={`mlp-metric-card ${m.color}`}>
                <div className="mlp-metric-label">{m.label}</div>
                <div className="mlp-metric-value">{m.value}</div>
                <div className="mlp-metric-sub">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid-12" style={{ marginBottom: '24px' }}>
            {results.histChart && (
              <div className="bento-tile" style={{ gridColumn: 'span 6' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 size={20} /> Full Price History</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={results.histChart} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickLine={false} interval={Math.floor((results.histChart?.length || 1) / 10)} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="close" stroke="var(--accent)" strokeWidth={1.5} dot={false} name="Close" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bento-tile" style={{ gridColumn: 'span 6' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={20} /> Actual vs Predicted (Test Set)</h2>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={results.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v.toFixed(0)}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="actual"    stroke="var(--green)" strokeWidth={2} dot={false} name="Actual Close" />
                  <Line type="monotone" dataKey="predicted" stroke="var(--text-secondary)" strokeWidth={2} dot={false} name="Predicted" strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Predictions table */}
          <div className="grid-12" style={{ marginBottom: '24px' }}>
            {results.fi && (
              <div className="bento-tile" style={{ gridColumn: 'span 4' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><Zap size={20} /> Feature Importance</h2>
                {results.fi.map(f => (
                  <div key={f.name} className="fi-row" style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <div className="fi-label" style={{ width: '80px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{f.name}</div>
                    <div className="fi-bar-track" style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div className="fi-bar-fill" style={{ width: `${f.importance}%`, height: '100%', background: 'var(--accent)' }} />
                    </div>
                    <div className="fi-val" style={{ width: '40px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>{f.importance}%</div>
                  </div>
                ))}
              </div>
            )}

            <div className="bento-tile" style={{ gridColumn: results.fi ? 'span 8' : 'span 12' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}><Calendar size={20} /> Last 20 Test Predictions</h2>
              <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                <table className="dark-table">
                  <thead>
                    <tr>
                      <th>Date (t)</th><th className="col-num">Actual ₹</th><th className="col-num">Predicted ₹</th>
                      <th className="col-num">Diff ₹</th><th className="col-num">Error %</th><th className="col-num">RSI</th><th style={{textAlign: 'center'}}>Spike</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.tableRows?.map((r, i) => (
                      <tr key={i}>
                        <td style={{ color: 'var(--text-secondary)' }}>{r.date}</td>
                        <td className="col-num">{r.actual}</td>
                        <td className="col-num" style={{ color: r.dir === 'up' ? 'var(--green)' : 'var(--red)' }}>{r.predicted}</td>
                        <td className="col-num" style={{ color: r.diff >= 0 ? 'var(--green)' : 'var(--red)' }}>{r.diff >= 0 ? '+' : ''}{r.diff}</td>
                        <td className="col-num text-muted">{r.err}%</td>
                        <td className="col-num" style={{ color: parseFloat(r.rsi) > 70 ? 'var(--red)' : parseFloat(r.rsi) < 30 ? 'var(--green)' : 'var(--text-secondary)' }}>{r.rsi}</td>
                        <td style={{ color: r.spike === 1 ? 'var(--accent)' : 'var(--text-secondary)', textAlign: 'center' }}>{r.spike === 1 ? <Zap size={14} style={{ display: 'inline-block' }} /> : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty */}
      {!results && !loading && (
        <div className="empty-state" style={{ marginTop: '24px' }}>
          <TreePine size={48} className="empty-icon" />
          <h3>Model Not Trained</h3>
          <p>
            Click <strong>Full Train</strong> to fetch history, engineer features, train XGBoost, and cache the model.
          </p>
        </div>
      )}
    </div>
  );
};

export default MLPredictionPage;
