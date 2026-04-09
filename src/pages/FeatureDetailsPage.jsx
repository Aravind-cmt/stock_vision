import '../styles/FeatureDetails.css';

// ─── All 16+ features from the pipeline ──────────────────────────────────────
const FEATURES = [
  // PRICE / TREND
  {
    name: 'Change%',
    fullName: 'Daily Price Change Percentage',
    icon: '📊',
    category: 'price',
    formula: `Change% = ((Close_t - Close_{t-1}) / Close_{t-1}) × 100`,
    desc: 'The percentage change in closing price from the previous trading day. This raw momentum signal captures the immediate market reaction and drives the Grade classification bucket.',
    tags: ['used_in_model', 'momentum', 'raw_signal'],
    usedInModel: true,
  },
  {
    name: 'grade_no',
    fullName: 'Grade (7-bucket classification)',
    icon: '🏷️',
    category: 'price',
    formula: `0 → VV Negative  (Change% < -3%)
1 → V Negative   (-3% to -1.5%)
2 → Negative     (-1.5% to -0.5%)
3 → Neutral      (-0.5% to +0.5%)
4 → Positive     (+0.5% to +1.5%)
5 → V Positive   (+1.5% to +3%)
6 → VV Positive  (Change% > +3%)`,
    desc: 'Discretises the daily percentage change into 7 ordinal buckets. Provides the model a non-linear regime encoding — the XGBoost tree can split cleanly on integer boundaries.',
    tags: ['used_in_model', 'ordinal', 'regime'],
    usedInModel: true,
  },
  {
    name: 'range_norm_close',
    fullName: 'Range-Normalised Close (20-day rolling)',
    icon: '📐',
    category: 'price',
    formula: `range_norm = (Close - roll_min(20)) / (roll_max(20) - roll_min(20))`,
    desc: 'Normalises the closing price into [0, 1] relative to its 20-day trading range. This is the TARGET variable the model predicts. Values near 1 indicate the stock is near its recent high, near 0 means near recent low.',
    tags: ['TARGET', 'normalised', '20-day'],
    usedInModel: false,
  },

  // MOMENTUM / OSCILLATORS
  {
    name: 'lag_rsi',
    fullName: 'Lagged RSI (14-period Relative Strength Index)',
    icon: '💪',
    category: 'momentum',
    formula: `RSI = 100 - 100 / (1 + avg_gain14 / avg_loss14)
lag_rsi = RSI.shift(1)`,
    desc: 'RSI measures the speed and magnitude of price changes on a 0–100 scale. Values above 70 indicate overbought, below 30 indicate oversold. Using the lagged value prevents look-ahead bias — the model sees yesterday\'s RSI when predicting today.',
    tags: ['used_in_model', 'oscillator', 'overbought/oversold', '14-period'],
    usedInModel: true,
  },
  {
    name: 'lag_smi',
    fullName: 'Lagged SMI (Stochastic Momentum Index)',
    icon: '🌀',
    category: 'momentum',
    formula: `SMI = 100 × EWM(EWM(Close - mid, 3), 3)
            / EWM(EWM((High - Low)/2, 3), 3)
lag_smi = SMI.shift(1)`,
    desc: 'A refined version of the Stochastic Oscillator centred around zero. Unlike RSI it measures where the close is relative to the midpoint of the high-low range (not just closes). Double EWM smoothing reduces noise.',
    tags: ['used_in_model', 'oscillator', 'stochastic', '14/3/3'],
    usedInModel: true,
  },

  // VOLATILITY / RISK
  {
    name: 'atr',
    fullName: 'Average True Range (14-period)',
    icon: '📏',
    category: 'risk',
    formula: `TR = max(High - Low, |High - prev_Close|, |Low - prev_Close|)
ATR = EWM(TR, span=14)`,
    desc: 'Measures market volatility by decomposing the entire range of a price bar — including gaps. Higher ATR means greater price movement regardless of direction. Used to price position sizes and set stop losses in the model.',
    tags: ['used_in_model', 'volatility', '14-period', 'true_range'],
    usedInModel: true,
  },
  {
    name: 'volatility',
    fullName: 'Annualised Volatility (20-day rolling std of log returns)',
    icon: '⚡',
    category: 'risk',
    formula: `log_return = ln(Close_t / Close_{t-1})
volatility = rollStd(log_return, 20) × √252`,
    desc: 'The standard deviation of log returns over the past 20 days, scaled to annual units (×√252 trading days). A key risk measure used in options pricing (implied vs realised vol) and portfolio construction.',
    tags: ['used_in_model', 'risk', 'annualised', '20-day'],
    usedInModel: true,
  },
  {
    name: 'price_spike',
    fullName: 'Price Spike Flag (2σ outlier detector)',
    icon: '🚨',
    category: 'risk',
    formula: `upper = rollMean(Change%, 20) + 2 × rollStd(Change%, 20)
lower = rollMean(Change%, 20) − 2 × rollStd(Change%, 20)
price_spike = 1 if Change% > upper OR Change% < lower`,
    desc: 'Binary flag (0/1) indicating whether today\'s price change is an extreme outlier (beyond 2 standard deviations of the 20-day rolling distribution). When spike=1, the prediction is dampened: pred = 0.5 + 0.3×(pred−0.5) to avoid false extremes.',
    tags: ['used_in_model', 'binary', 'outlier', '2sigma'],
    usedInModel: true,
  },

  // VOLUME
  {
    name: 'zscore',
    fullName: 'ZScore of Volume (20-day rolling)',
    icon: '📦',
    category: 'volume',
    formula: `zscore_vol = (Volume - rollMean(Volume,20)) / rollStd(Volume,20)`,
    desc: 'How unusual today\'s trading volume is relative to the past 20 trading days, expressed in standard deviations. A high z-score often accompanies breakouts or news events. Normalises across different stocks with wildly different volume levels.',
    tags: ['used_in_model', 'volume', '20-day', 'z-score'],
    usedInModel: true,
  },

  // PHYSICS-INSPIRED
  {
    name: 'RVI',
    fullName: 'Relative Volatility Index',
    icon: '🌡️',
    category: 'physics',
    formula: `RVI = 100 × std(upward_moves, 14)
              / (std(upward_moves,14) + std(downward_moves,14))`,
    desc: 'Like RSI but uses standard deviation of price moves instead of magnitude. Measures the direction of volatility rather than just price. RVI > 50 signals upward vol dominance; < 50 signals downward dominance.',
    tags: ['volatility', 'directional', '14-period'],
    usedInModel: false,
  },
  {
    name: 'EMV',
    fullName: 'Ease of Movement (14-day smoothed)',
    icon: '🌊',
    category: 'physics',
    formula: `Distance  = Δ((High + Low) / 2)
Box_ratio = (Volume / vol_scale) / (High - Low)
EMV       = Distance / Box_ratio
EMV_smooth = rollMean(EMV, 14)`,
    desc: 'Measures how easily price moves through the volume. A large EMV means prices are moving significantly with relatively little volume — an efficient trend. Near zero means price is struggling to move despite heavy volume (possible reversal).',
    tags: ['volume_price', 'efficiency', '14-day'],
    usedInModel: false,
  },
  {
    name: 'RN',
    fullName: 'Reynolds Number (Physics-Inspired Turbulence Index)',
    icon: '🌀',
    category: 'physics',
    formula: `RN = RVI / EMV_smooth
Interpretation: RN < π → Laminar (stable trend)
                RN ≥ π → Turbulent (chaotic market)`,
    desc: 'Inspired by fluid dynamics, the Reynolds Number in finance measures the ratio of inertial forces (RVI) to viscous forces (EMV). Small RN = smooth, predictable trend; Large RN = chaotic, trend-breaking movement. Novel quantitative finance concept.',
    tags: ['used_in_model', 'physics', 'novel', 'turbulence'],
    usedInModel: true,
  },
];

// Group by category
const CATEGORIES = {
  price:    { label: '📊 Price & Trend Features',      color: 'price'    },
  momentum: { label: '💪 Momentum Oscillators',         color: 'momentum' },
  risk:     { label: '⚠️ Risk & Volatility Features',  color: 'risk'     },
  volume:   { label: '📦 Volume Features',              color: 'volume'   },
  physics:  { label: '🔬 Physics-Inspired Features',   color: 'physics'  },
};

// Pipeline overview chips
const OVERVIEW = [
  { icon:'📊', name:'Change%',          cat:'price',    desc:'Daily % change → drives grade bucketing' },
  { icon:'🏷️', name:'grade_no',         cat:'price',    desc:'7-class ordinal regime label (0–6)' },
  { icon:'📐', name:'range_norm_close', cat:'price',    desc:'TARGET: 20-day range-normalised close' },
  { icon:'💪', name:'lag_RSI [14]',     cat:'momentum', desc:'Lagged 14-period RSI (no look-ahead)' },
  { icon:'🌀', name:'lag_SMI [14/3/3]', cat:'momentum', desc:'Lagged double-smoothed stochastic' },
  { icon:'📏', name:'ATR [14]',         cat:'risk',     desc:'Average True Range for raw volatility' },
  { icon:'⚡', name:'Volatility [20]',  cat:'risk',     desc:'Annualised log-return std deviation' },
  { icon:'🚨', name:'price_spike',      cat:'risk',     desc:'Binary 2σ outlier flag with spike controller' },
  { icon:'📦', name:'ZScore_Vol [20]',  cat:'volume',   desc:'z-score of daily volume vs 20-day window' },
  { icon:'🌡️', name:'RVI [14]',         cat:'physics',  desc:'Direction-of-volatility index (RSI variant)' },
  { icon:'🌊', name:'EMV [14]',         cat:'physics',  desc:'Ease-of-Movement: price efficiency' },
  { icon:'🌀', name:'RN = RVI/EMV',     cat:'physics',  desc:'Reynolds Number: laminar vs turbulent market' },
];

const FeatureDetailsPage = () => {
  const grouped = Object.entries(CATEGORIES).map(([key, meta]) => ({
    key,
    ...meta,
    features: FEATURES.filter(f => f.category === key),
  }));

  return (
    <div className="fd-outer bento-container">
      {/* Header */}
      <div className="fd-header bento-tile bento-large">
        <h1>🧬 Feature Engineering Pipeline</h1>
        <p>
          Complete documentation of all <strong>12 engineered features</strong> used in the Nifty 50 XGBoost
          prediction model — from raw OHLCV data to physics-inspired turbulence metrics.
          Features marked <span style={{color:'#a78bfa',fontWeight:700}}>✓ used in model</span> are
          the 9 selected features fed to XGBRegressor.
        </p>
      </div>

      {/* Target box */}
      <div className="fd-target-box bento-tile bento-large">
        <h3>🎯 Prediction Target: range_norm_close (shifted by -1)</h3>
        <p>
          The model predicts <code style={{color:'#a78bfa',fontFamily:'monospace'}}>range_norm_close.shift(-1)</code> —
          the <em>next day's</em> 20-day range-normalised closing price.
          A value of <strong>1.0</strong> means the next close is at the top of its recent 20-day range;
          <strong> 0.0</strong> means at the bottom. After prediction, this normalised value is
          inverse-transformed back to actual ₹ price using 60-day rolling min/max.
        </p>
      </div>

      {/* Pipeline overview grid */}
      <div className="fd-section-title">🗺️ All Features at a Glance</div>
      <div className="fd-pipeline-grid bento-tile bento-large" style={{ padding: '2rem' }}>
        {OVERVIEW.map(f=>(
          <div key={f.name} className="fd-pipeline-chip">
            <span className="fd-chip-icon">{f.icon}</span>
            <div>
              <div className="fd-chip-name">{f.name}</div>
              <span className={`fd-chip-class ${f.cat}`}>{f.cat.toUpperCase()}</span>
              <div className="fd-chip-desc">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Model parameters */}
      <div className="fd-section-title">🔧 XGBoost Model Configuration</div>
      <div className="fd-model-box bento-tile bento-large">
        <div>
          <h3>Hyperparameters</h3>
          <ul className="fd-param-list">
            {[
              ['n_estimators',   '100'],
              ['max_depth',      '4'],
              ['learning_rate',  '0.05'],
              ['subsample',      '0.8'],
              ['colsample_bytree','0.8'],
              ['objective',      'reg:squarederror'],
              ['random_state',   '42'],
            ].map(([k,v])=>(
              <li key={k}>
                <span className="fd-param-key">{k}</span>
                <span className="fd-param-val">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Pipeline Steps</h3>
          <ul className="fd-param-list">
            {[
              ['Sorting',         'sort_values("Date")'],
              ['Lag creation',    'RSI.shift(1), SMI.shift(1)'],
              ['Feature matrix',  '9 selected features'],
              ['Poly expansion',  'PolynomialFeatures(degree=2)'],
              ['Split strategy',  'TimeSeriesSplit(n_splits=5)'],
              ['Spike control',   '0.5 + 0.3×(pred−0.5)'],
              ['Price decode',    'pred × roll_range + roll_min'],
            ].map(([k,v])=>(
              <li key={k}>
                <span className="fd-param-key">{k}</span>
                <span className="fd-param-val" style={{fontSize:'0.7rem'}}>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Per-category feature cards */}
      {grouped.map(grp=>(
        <div key={grp.key}>
          <div className="fd-section-title">{grp.label}</div>
          <div className="fd-cards">
            {grp.features.map(f=>(
              <div key={f.name} className={`fd-card bento-tile ${f.category}`}>
                <div className="fd-card-header">
                  <span className="fd-card-icon">{f.icon}</span>
                  <div>
                    <div className="fd-card-name">{f.name}</div>
                    <div className="fd-card-fullname">{f.fullName}</div>
                  </div>
                </div>
                <p>{f.desc}</p>
                <div className="fd-tags">
                  {f.usedInModel && <span className="fd-tag used">✓ Used in Model</span>}
                  {f.tags.filter(t=>t!=='used_in_model').map(t=>(
                    <span key={t} className="fd-tag">{t.replace(/_/g,' ')}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Footer note */}
      <div style={{
        background:'rgba(108,99,255,0.06)',border:'1px solid rgba(108,99,255,0.2)',
        borderRadius:'var(--radius-md)',padding:'1.25rem 1.5rem',marginBottom:'2rem',
        fontSize:'0.83rem',color:'var(--text-secondary)',lineHeight:1.7
      }}>
        <strong style={{color:'#a78bfa'}}>📌 Data Source & Pipeline</strong><br/>
        Raw data: Nifty 50 Historical CSV (or live from <code style={{color:'#38bdf8'}}>yfinance</code> / Yahoo Finance API).
        All features are computed from OHLCV columns. The target is computed from the closing price alone.
        PolynomialFeatures(degree=2) expands the 9 selected features to {Math.round(9*(9+1)/2+9)} interaction and squared terms.
        TimeSeriesSplit ensures no future data leaks into training folds.
      </div>
    </div>
  );
};

export default FeatureDetailsPage;
