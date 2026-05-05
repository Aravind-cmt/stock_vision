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

// ─── SYMBOLS ──────────────────────────────────────────────────────────────────
const SYMBOLS = [
  { label: 'Nifty 50 Index', symbol: '^NSEI' },
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

const CACHE_KEY = sym => `mlp_v6_${sym}`;
const TODAY = new Date().toISOString().slice(0, 10);

// ─── FIX #3: Direction accuracy threshold ────────────────────────────────────
const DIR_THRESHOLD_PCT = 0.002;

// ─── YAHOO FINANCE FETCH ──────────────────────────────────────────────────────
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

// ─── ROLLING HELPERS ──────────────────────────────────────────────────────────
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

// ─── FIX #3: ROLLING Z-SCORE NORMALIZATION ───────────────────────────────────
// Uses only past data up to min(i, splitAt) so no future data leaks into test set.
// Stationary normalization that handles distribution shift over time.
function rollingZscore(arr, splitAt) {
  return arr.map((v, i) => {
    const cap = splitAt != null ? Math.min(i, splitAt) : i;
    const window = arr.slice(Math.max(0, cap - 252), cap); // up to 1yr lookback
    if (window.length < 20) return 0;
    const m = window.reduce((a, b) => a + b, 0) / window.length;
    const s = Math.sqrt(window.reduce((a, b) => a + (b - m) ** 2, 0) / window.length);
    return s === 0 ? 0 : Math.max(-3, Math.min(3, (v - m) / s)); // clip to ±3σ
  });
}

// ─── TECHNICAL INDICATORS ────────────────────────────────────────────────────
function calcRSI(close, period = 14) {
  const alpha = 1 / period;
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
  return rollStd(lr, 20, 20).map(v => isNaN(v) ? NaN : v * Math.sqrt(252));
}

function calcZscoreVol(volume) {
  const m = rollMean(volume, 20, 1), s = rollStd(volume, 20, 1);
  return volume.map((v, i) => s[i] === 0 || isNaN(s[i]) ? NaN : (v - m[i]) / s[i]);
}

// ─── FIX #1: LAGGED SPIKE + SPIKE COUNT — eliminates same-day leakage ────────
// Old: spk[i] = did price spike TODAY → used to predict TOMORROW (leaks today's move)
// New: lagSpk[i] = did price spike YESTERDAY (safe lag)
//      spk3[i] = how many of the last 3 days had a spike (momentum signal)
function calcPriceSpike(chgPct) {
  const m = rollMean(chgPct, 20, 1), s = rollStd(chgPct, 20, 1);
  const spk = chgPct.map((c, i) => (c > m[i] + 2 * s[i] || c < m[i] - 2 * s[i]) ? 1 : 0);
  // Lag by 1 — yesterday's spike is a valid predictor of tomorrow's follow-through
  const lagSpk = [0, ...spk.slice(0, -1)];
  // 3-day spike count — captures spike clusters (higher = more volatile regime)
  const spk3 = spk.map((_, i) => {
    if (i < 2) return 0;
    return spk[i - 2] + spk[i - 1] + (i > 0 ? spk[i - 1] : 0);
  });
  return { lagSpk, spk3, spkRaw: spk };
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

// ─── FIX #2: LOG-RETURN TARGET ────────────────────────────────────────────────
// Old: y = (nextClose − baseMin) / rangeDiff → shifts 3× over 6 years, non-stationary
// New: y = log(nextClose / close) → stationary, scale-invariant, bounded ±5% daily
// Price reconstruction: nextPrice = close × exp(predicted_log_return)

// ─── BUILD FEATURE DATASET ───────────────────────────────────────────────────
function buildDataset(raw, splitAt = null) {
  const n = raw.length;
  const close  = raw.map(r => r.Close);
  const high   = raw.map(r => r.High);
  const low    = raw.map(r => r.Low);
  const vol    = raw.map(r => r.Volume);

  // Log-returns (stationary)
  const logRet = close.map((c, i) => i === 0 ? 0 : Math.log(c / close[i - 1]));
  const chgPct = logRet.map(r => r * 100);

  // Indicators
  const rsi  = calcRSI(close);
  const atr  = calcATR(high, low, close);
  const smi  = calcSMI(high, low, close);
  const vola = calcVolatility(close);
  const zsv  = calcZscoreVol(vol);
  const rvi  = calcRVI(close);
  const emv  = calcEMV(high, low, vol);
  const rn   = rvi.map((r, i) => emv[i] === 0 || isNaN(emv[i]) ? NaN : r / emv[i]);

  // FIX #1: use lagged spike (no leakage) + spike count
  const { lagSpk, spk3, spkRaw } = calcPriceSpike(chgPct);

  // Lagged RSI / SMI (safe — these are already indicators of past data)
  const lagRsi = [NaN, ...rsi.slice(0, -1)];
  const lagSmi = [NaN, ...smi.slice(0, -1)];

  // RSI distance from 50 (mean-reversion signal, normalized)
  const rsiDist = rsi.map(r => isNaN(r) ? NaN : (r - 50) / 50);

  // ATR normalized by close (volatility-adjusted)
  const atrPct = atr.map((a, i) => close[i] > 0 ? a / close[i] : NaN);

  // FIX #3: rolling z-score normalization — freeze at splitAt to prevent leakage
  const sp = splitAt ?? Math.floor(n * 0.8);
  const nChgPct  = rollingZscore(chgPct,  sp);
  const nZsv     = rollingZscore(zsv,     sp);
  const nVola    = rollingZscore(vola.map(v => isNaN(v) ? 0 : v), sp);
  const nRN      = rollingZscore(rn.map(v => isNaN(v) ? 0 : v),   sp);
  const nLSMI    = rollingZscore(lagSmi.map(v => isNaN(v) ? 0 : v), sp);
  const nLRSI    = rollingZscore(lagRsi.map(v => isNaN(v) ? 0 : v), sp);
  const nRsiDist = rollingZscore(rsiDist.map(v => isNaN(v) ? 0 : v), sp);
  const nAtrPct  = rollingZscore(atrPct.map(v => isNaN(v) ? 0 : v),  sp);

  // FIX #2: log-return target (stationary)
  const nextLogRet = [...logRet.slice(1), NaN];

  const rows = [];
  for (let i = 0; i < n - 1; i++) {
    // FIX #2: y is log-return to next day — stationary, no rolling baseline needed
    const y = nextLogRet[i];
    // Feature vector — 9 features, all safe (no same-day leakage)
    const x = [
      nChgPct[i],    // today's log-return (already happened, predicting tomorrow)
      nZsv[i],       // volume z-score
      nVola[i],      // realized volatility
      nRN[i],        // RVI/EMV combined
      lagSpk[i],     // FIX #1: yesterday's spike flag (lagged, no leakage)
      spk3[i],       // FIX #1: 3-day spike count (regime indicator)
      nLSMI[i],      // lagged SMI
      nLRSI[i],      // lagged RSI
      nRsiDist[i],   // RSI distance from neutral
    ];
    if (x.some(isNaN) || isNaN(y) || !isFinite(y)) continue;
    rows.push({
      date: raw[i].Date,
      close: close[i],
      nextClose: close[i + 1],
      x, y,
      rsi: rsi[i],
      spike: spkRaw[i],
    });
  }

  // Live (most recent bar) features for next-day prediction
  const liveX = [
    nChgPct[n - 1],
    nZsv[n - 1],
    nVola[n - 1],
    nRN[n - 1],
    lagSpk[n - 1],
    spk3[n - 1],
    nLSMI[n - 1],
    nLRSI[n - 1],
    nRsiDist[n - 1],
  ].map(v => (isNaN(v) || !isFinite(v)) ? 0 : v);

  return {
    rows,
    liveX,
    liveSpike: spkRaw[n - 1],
    liveClose: close[n - 1],
    liveDate: raw[n - 1].Date,
  };
}

// ─── FIX #4: DEPTH-3 XGBOOST TREES ──────────────────────────────────────────
// Old: single-split stump (depth=1) → can't learn interaction effects
// New: recursive tree builder up to depth=3 → captures e.g. "high vol AND oversold"
function buildTree(Xtrain, residuals, idxs, feats, depth, maxDepth = 3) {
  const leafVal = idxs.reduce((s, i) => s + residuals[i], 0) / idxs.length;
  if (depth >= maxDepth || idxs.length < 6) {
    return { leaf: true, val: leafVal };
  }

  let bFeat = -1, bThresh = 0, bGain = -Infinity;
  let bLIdx = [], bRIdx = [];

  for (const f of feats) {
    const vals = idxs.map(i => Xtrain[i][f]).sort((a, b) => a - b);
    // Try 3 split points (25th, 50th, 75th percentile) for better splits
    const candidates = [
      vals[Math.floor(vals.length * 0.25)],
      vals[Math.floor(vals.length * 0.5)],
      vals[Math.floor(vals.length * 0.75)],
    ];
    for (const thresh of candidates) {
      const lIdx = idxs.filter(i => Xtrain[i][f] <= thresh);
      const rIdx = idxs.filter(i => Xtrain[i][f] >  thresh);
      if (lIdx.length < 3 || rIdx.length < 3) continue;
      const lM = lIdx.reduce((s, i) => s + residuals[i], 0) / lIdx.length;
      const rM = rIdx.reduce((s, i) => s + residuals[i], 0) / rIdx.length;
      const gain = -(
        lIdx.reduce((s, i) => s + (residuals[i] - lM) ** 2, 0) +
        rIdx.reduce((s, i) => s + (residuals[i] - rM) ** 2, 0)
      );
      if (gain > bGain) { bGain = gain; bFeat = f; bThresh = thresh; bLIdx = lIdx; bRIdx = rIdx; }
    }
  }

  if (bFeat === -1) return { leaf: true, val: leafVal };

  return {
    leaf: false,
    feat: bFeat,
    thresh: bThresh,
    left:  buildTree(Xtrain, residuals, bLIdx, feats, depth + 1, maxDepth),
    right: buildTree(Xtrain, residuals, bRIdx, feats, depth + 1, maxDepth),
  };
}

function predictTree(tree, row) {
  if (tree.leaf) return tree.val;
  return row[tree.feat] <= tree.thresh
    ? predictTree(tree.left, row)
    : predictTree(tree.right, row);
}

function trainXGB(Xtrain, ytrain) {
  const n = Xtrain.length, nFeat = Xtrain[0].length;
  const LR = 0.03;
  const N_TREES = 300;
  const trees = [];
  const residuals = [...ytrain];

  for (let t = 0; t < N_TREES; t++) {
    const nSamp = Math.floor(n * 0.8);
    const idxs  = Array.from({ length: n }, (_, i) => i)
      .sort(() => Math.random() - 0.5).slice(0, nSamp);
    const feats = Array.from({ length: nFeat }, (_, i) => i)
      .sort(() => Math.random() - 0.5).slice(0, Math.ceil(nFeat * 0.8));

    // FIX #4: depth-3 tree instead of single-split stump
    const tree = buildTree(Xtrain, residuals, idxs, feats, 0, 3);
    trees.push(tree);

    // Update residuals
    for (let i = 0; i < n; i++) {
      residuals[i] -= LR * predictTree(tree, Xtrain[i]);
    }
  }
  return trees;
}

function predictXGB(trees, X, base) {
  const LR = 0.03;
  return X.map(row => {
    let p = base;
    for (const t of trees) p += LR * predictTree(t, row);
    return p;
  });
}

function featureImportance(Xtrain) {
  const names = ['Change%', 'ZScore_Vol', 'Volatility', 'RN', 'lagSpike', 'Spike3d', 'lag_SMI', 'lag_RSI', 'RSI_dist'];
  return names.map((name, fi) => {
    const col = Xtrain.map(r => r[fi]);
    const m   = col.reduce((a, b) => a + b, 0) / col.length;
    return { name, importance: col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length };
  }).sort((a, b) => b.importance - a.importance)
    .map((f, _, arr) => ({ ...f, importance: +(f.importance / (arr[0].importance || 1) * 100).toFixed(1) }));
}

// ─── PREDICT NEXT DAY ─────────────────────────────────────────────────────────
function makePrediction(trees, base, liveX, liveClose, liveDate) {
  // FIX #2: Model predicts log-return → reconstruct price
  const predictedLogReturn = predictXGB(trees, [liveX], base)[0];
  const nextPrice = +(liveClose * Math.exp(predictedLogReturn)).toFixed(2);
  const diff      = +(nextPrice - liveClose).toFixed(2);
  const diffPct   = +((diff / liveClose) * 100).toFixed(2);

  const d = new Date(liveDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);

  return {
    nextPrice, diff, diffPct,
    nextDate: d.toISOString().slice(0, 10),
    todayClose: liveClose,
    todayDate: liveDate,
  };
}

// ─── COMPUTE TEST METRICS ─────────────────────────────────────────────────────
function computeMetrics(rows, trees, base, splitAt) {
  const testSet = rows.slice(splitAt);
  const Xtest   = testSet.map(r => r.x);

  // Predicted log-returns
  const predLogRets = predictXGB(trees, Xtest, base);

  // FIX #2: reconstruct prices from log-returns (stationary → real prices)
  const predClose = predLogRets.map((lr, i) => +(testSet[i].close * Math.exp(lr)).toFixed(2));
  const actClose  = testSet.map(r => r.nextClose);
  const actLogRets = testSet.map(r => r.y);

  // ── Normalized R² (in log-return space — true model quality) ──────────────
  const actLRMean = actLogRets.reduce((a, b) => a + b, 0) / actLogRets.length;
  const ssTotLR   = actLogRets.reduce((a, c) => a + (c - actLRMean) ** 2, 0);
  const ssResLR   = actLogRets.reduce((a, c, i) => a + (c - predLogRets[i]) ** 2, 0);
  const normR2    = +(1 - ssResLR / ssTotLR).toFixed(4);

  // ── Price R² (reconstructed — what users care about) ──────────────────────
  const actMean = actClose.reduce((a, b) => a + b, 0) / actClose.length;
  const ssTot   = actClose.reduce((a, c) => a + (c - actMean) ** 2, 0);
  const ssRes   = actClose.reduce((a, c, i) => a + (c - predClose[i]) ** 2, 0);
  const priceR2 = +(1 - ssRes / ssTot).toFixed(4);

  const mae  = +(actClose.reduce((a, c, i) => a + Math.abs(c - predClose[i]), 0) / actClose.length).toFixed(2);
  const rmse = +(Math.sqrt(ssRes / actClose.length)).toFixed(2);
  const mape = +(actClose.reduce((a, c, i) => a + Math.abs((c - predClose[i]) / c), 0) / actClose.length * 100).toFixed(2);

  // ── Direction accuracy with threshold ─────────────────────────────────────
  let dirCorrect = 0, dirTotal = 0;
  for (let i = 1; i < testSet.length; i++) {
    const prevPrice   = testSet[i - 1].close;
    const threshold   = prevPrice * DIR_THRESHOLD_PCT;
    const actualUp    = actClose[i]  > prevPrice + threshold;
    const actualDown  = actClose[i]  < prevPrice - threshold;
    const predictedUp = predClose[i] > prevPrice + threshold;
    const predictedDn = predClose[i] < prevPrice - threshold;
    if ((actualUp || actualDown) && (predictedUp || predictedDn)) {
      dirTotal++;
      if ((actualUp && predictedUp) || (actualDown && predictedDn)) dirCorrect++;
    }
  }
  const dirAcc = dirTotal > 0 ? +((dirCorrect / dirTotal) * 100).toFixed(1) : 0;

  const chartN    = Math.min(testSet.length, 120);
  const chartData = testSet.slice(-chartN).map((r, i) => ({
    date:      r.date.slice(5),
    actual:    actClose[testSet.length - chartN + i],
    predicted: predClose[testSet.length - chartN + i],
  }));

  const tableRows = testSet.slice(-20).map((r, i) => {
    const off = testSet.length - 20;
    const ac = actClose[off + i], pr = predClose[off + i];
    const df = +(pr - ac).toFixed(2);
    return {
      date: r.date, actual: ac.toFixed(2), predicted: pr.toFixed(2),
      diff: df, err: +(Math.abs(df) / ac * 100).toFixed(2),
      dir: df >= 0 ? 'up' : 'down',
      rsi: isNaN(r.rsi) ? '-' : r.rsi.toFixed(1),
      spike: r.spike,
    };
  });

  return {
    r2: normR2, normR2, priceR2, mae, rmse, mape, dirAcc,
    chartData, tableRows, testSize: testSet.length,
  };
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
  const [cacheInfo,  setCacheInfo]  = useState(null);

  useEffect(() => {
    const cached = loadCache(symbol);
    if (cached) {
      setCacheInfo({ lastDate: cached.liveDate, totalRows: cached.totalRows, trainedAt: cached.trainedAt });
      applyCache(cached);
    } else {
      setStatus({ type: 'info', msg: 'No cache found. Click "Full Train" to build the model.' });
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

  function applyCache(cached) {
    const { rows, trees, base, liveX, liveClose, liveDate,
            totalRows, trainedAt, histChart, fi, trainSize } = cached;

    const pred    = makePrediction(trees, base, liveX, liveClose, liveDate);
    const splitAt = Math.floor(rows.length * 0.8);
    const metrics = computeMetrics(rows, trees, base, splitAt);

    setResults({
      ...pred, ...metrics, histChart, fi, trainSize, totalRows, trainedAt,
      dateRange: `${rows[0].date} → ${liveDate}`,
    });
    const age = liveDate < TODAY
      ? `[Stale] Data is from ${liveDate} — click "Add Today's Data" to update.`
      : `[Valid] Last data: ${liveDate} · Trained: ${trainedAt}`;
    setStatus({ type: liveDate < TODAY ? 'info' : 'success', msg: age });
    setCacheInfo({ lastDate: liveDate, totalRows, trainedAt });
  }

  const fullTrain = useCallback(async () => {
    setLoading(true); setResults(null);

    setActiveStep(0);
    setStatus({ type: 'loading', msg: `Fetching from Jan ${startYear} → Today…` });
    const raw = await fetchYFinance(symbol, Number(startYear));
    if (!raw || raw.length < 120) {
      setStatus({ type: 'error', msg: `Fetch failed or insufficient data (got ${raw?.length ?? 0} rows).` });
      setLoading(false); setActiveStep(-1); return;
    }

    setActiveStep(1);
    setStatus({ type: 'loading', msg: `Computing 9 features (rolling z-score, lagged spike) across ${raw.length} days…` });
    await new Promise(r => setTimeout(r, 50));

    // FIX #3: pass splitAt so normalization freezes at train boundary
    const splitAt = Math.floor((raw.length - 1) * 0.8);
    const { rows, liveX, liveSpike, liveClose, liveDate } = buildDataset(raw, splitAt);

    if (rows.length < 80) {
      setStatus({ type: 'error', msg: 'Not enough clean rows. Try a longer date range.' });
      setLoading(false); setActiveStep(-1); return;
    }

    setActiveStep(2);
    setStatus({ type: 'loading', msg: `Splitting ${rows.length} samples: 80% train / 20% test…` });
    await new Promise(r => setTimeout(r, 50));
    const rowSplit = Math.floor(rows.length * 0.8);
    const Xtrain   = rows.slice(0, rowSplit).map(r => r.x);
    const ytrain   = rows.slice(0, rowSplit).map(r => r.y);

    setActiveStep(3);
    // FIX #4: depth-3 trees, 300 rounds
    setStatus({ type: 'loading', msg: `Training XGBoost (300 trees, depth=3, LR=0.03) on ${Xtrain.length} samples…` });
    await new Promise(r => setTimeout(r, 100));
    const base  = ytrain.reduce((a, b) => a + b, 0) / ytrain.length;
    const trees = trainXGB(Xtrain, ytrain);

    setActiveStep(4);
    setStatus({ type: 'loading', msg: 'Computing test metrics & next-day prediction…' });
    await new Promise(r => setTimeout(r, 50));

    const stride    = Math.max(1, Math.floor(raw.length / 300));
    const histChart = raw.filter((_, i) => i % stride === 0).map(r => ({ date: r.Date.slice(0, 7), close: r.Close }));
    const fi        = featureImportance(Xtrain);
    const trainedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const totalRows = raw.length;

    const cachePayload = {
      rows, trees, base, liveX, liveSpike, liveClose, liveDate,
      totalRows, trainedAt, histChart, fi, trainSize: Xtrain.length,
    };
    saveCache(symbol, cachePayload);
    setCacheInfo({ lastDate: liveDate, totalRows, trainedAt });

    applyCache(cachePayload);
    setLoading(false);
    setActiveStep(-1);
  }, [symbol, startYear]);

  const dailyUpdate = useCallback(async () => {
    const cached = loadCache(symbol);
    if (!cached) { setStatus({ type: 'error', msg: 'No cache. Run Full Train first.' }); return; }

    setLoading(true);
    setStatus({ type: 'loading', msg: `Fetching latest data since ${cached.liveDate}…` });

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

    const shortStart = new Date(cached.liveDate + 'T00:00:00Z');
    shortStart.setUTCDate(shortStart.getUTCDate() - 300);
    const shortStartStr = shortStart.toISOString().slice(0, 10);
    const contextRaw = await fetchYFinance(symbol, null, shortStartStr);

    if (!contextRaw || contextRaw.length < 30) {
      setStatus({ type: 'error', msg: 'Could not fetch context window for feature update.' });
      setLoading(false); return;
    }

    const { liveX, liveSpike, liveClose, liveDate } = buildDataset(contextRaw);
    const { rows: newRows } = buildDataset(contextRaw);
    const freshRows   = newRows.filter(r => r.date > cached.liveDate);
    const updatedRows = [...cached.rows, ...freshRows];
    const totalRows   = cached.totalRows + freshRows.length;

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
      totalRows, trainedAt, histChart: updatedHistChart,
    };
    saveCache(symbol, updatedCache);
    setCacheInfo({ lastDate: liveDate, totalRows, trainedAt });
    applyCache(updatedCache);
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    const cached = loadCache(symbol);
    if (cached && cached.liveDate < TODAY) {
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
          <p>Log-return target · Lagged features · Rolling z-score norm · Depth-3 XGBoost</p>
        </div>
        <div className="mlp-badge">v6 · 4 FIXES APPLIED</div>
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
          <button className="btn-predict glow-accent" onClick={fullTrain} disabled={loading}>
            {loading ? '⏳ Running…' : '🔁 Full Train (2000→Today)'}
          </button>
          <button className="btn-update glow-accent" onClick={dailyUpdate} disabled={loading || !cacheInfo}>
            📅 Add Today's Data
          </button>
          <button className="btn-danger" onClick={() => clearCache(symbol)} disabled={loading}>
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

      {/* Pipeline */}
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
              <div className="ndh-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} /> Next Trading Day Forecast
              </div>
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
              <div className="nds-item"><span className="nds-k">Data Range-</span><span className="nds-v">{results.dateRange}</span></div>
              <div className="nds-item"><span className="nds-k">Total Trading Days-</span><span className="nds-v">{results.totalRows?.toLocaleString()}</span></div>
              <div className="nds-item"><span className="nds-k">Train Samples-</span><span className="nds-v">{results.trainSize?.toLocaleString()}</span></div>
              <div className="nds-item"><span className="nds-k">Test Samples-</span><span className="nds-v">{results.testSize?.toLocaleString()}</span></div>
              <div className="nds-item"><span className="nds-k">Trained At-</span><span className="nds-v">{results.trainedAt}</span></div>
              <div className="nds-item">
                <span className="nds-k">Signal-</span>
                <span className="nds-v" style={{ color: results.diff >= 0 ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {results.diff >= 0 ? <><TrendingUp size={16}/> BUY SIGNAL</> : <><TrendingDown size={16}/> SELL SIGNAL</>}
                </span>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="mlp-metrics">
            <div className="mlp-metric-card blue" title="R² after log-return price reconstruction">
              <div className="mlp-metric-label">Price R² <span style={{ fontSize: '0.65rem', opacity: 0.65 }}>↑ closer to 1</span></div>
              <div className="mlp-metric-value">{results.priceR2}</div>
              <div className="mlp-metric-sub">Reconstructed price</div>
            </div>
            <div className="mlp-metric-card green">
              <div className="mlp-metric-label">MAE (₹)</div>
              <div className="mlp-metric-value">₹{results.mae}</div>
              <div className="mlp-metric-sub">Mean Absolute Error</div>
            </div>
            <div className="mlp-metric-card red">
              <div className="mlp-metric-label">RMSE (₹)</div>
              <div className="mlp-metric-value">₹{results.rmse}</div>
              <div className="mlp-metric-sub">Root Mean Sq. Error</div>
            </div>
            <div className="mlp-metric-card orange">
              <div className="mlp-metric-label">MAPE</div>
              <div className="mlp-metric-value">{results.mape}%</div>
              <div className="mlp-metric-sub">Mean Abs. % Error</div>
            </div>
            <div className="mlp-metric-card blue" title="Direction accuracy using 0.2% threshold filter">
              <div className="mlp-metric-label">Dir. Acc. <span style={{ fontSize: '0.65rem', opacity: 0.65 }}>≥0.2% moves</span></div>
              <div className="mlp-metric-value">{results.dirAcc}%</div>
              <div className="mlp-metric-sub">Threshold-filtered calls</div>
            </div>
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
                  <Line type="monotone" dataKey="actual"    stroke="var(--green)"          strokeWidth={2} dot={false} name="Actual Close" />
                  <Line type="monotone" dataKey="predicted" stroke="var(--text-secondary)"  strokeWidth={2} dot={false} name="Predicted" strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feature importance + table */}
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
                      <th>Date (t)</th>
                      <th className="col-num">Actual ₹</th>
                      <th className="col-num">Predicted ₹</th>
                      <th className="col-num">Diff ₹</th>
                      <th className="col-num">Error %</th>
                      <th className="col-num">RSI</th>
                      <th style={{ textAlign: 'center' }}>Spike</th>
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
                        <td style={{ color: r.spike === 1 ? 'var(--accent)' : 'var(--text-secondary)', textAlign: 'center' }}>
                          {r.spike === 1 ? <Zap size={14} style={{ display: 'inline-block' }} /> : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <div className="empty-state" style={{ marginTop: '24px' }}>
          <TreePine size={48} className="empty-icon" />
          <h3>Model Not Trained</h3>
          <p>Click <strong>Full Train</strong> to fetch history, engineer features, train XGBoost, and cache the model.</p>
        </div>
      )}
    </div>
  );
};

export default MLPredictionPage;