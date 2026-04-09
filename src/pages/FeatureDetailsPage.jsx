import { 
  BarChart2, Tag, Axis3D, Zap, 
  Activity, Wind, Ruler, LineChart, Target,
  FileText, ArrowDownToLine, Droplets
} from 'lucide-react';
import '../styles/FeatureDetails.css';

// ─── All 16+ features from the pipeline ──────────────────────────────────────
const FEATURES = [
  // PRICE / TREND
  {
    name: 'Change%',
    fullName: 'Daily Price Change Percentage',
    icon: BarChart2,
    category: 'price',
    formula: `Change% = ((Close_t - Close_{t-1}) / Close_{t-1}) × 100`,
    desc: 'The percentage change in closing price from the previous trading day. This raw momentum signal captures the immediate market reaction and drives the Grade classification bucket.',
    tags: ['used_in_model', 'momentum', 'raw_signal'],
    usedInModel: true,
  },
  {
    name: 'grade_no',
    fullName: 'Grade (7-bucket classification)',
    icon: Tag,
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
    icon: Axis3D,
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
    icon: Activity,
    category: 'momentum',
    formula: `RSI = 100 - 100 / (1 + avg_gain14 / avg_loss14)
lag_rsi = RSI.shift(1)`,
    desc: 'RSI measures the speed and magnitude of price changes on a 0–100 scale. Values above 70 indicate overbought, below 30 indicate oversold. Using the lagged value prevents look-ahead bias.',
    tags: ['used_in_model', 'oscillator', 'overbought/oversold', '14-period'],
    usedInModel: true,
  },
  {
    name: 'lag_smi',
    fullName: 'Lagged SMI (Stochastic Momentum Index)',
    icon: Wind,
    category: 'momentum',
    formula: `SMI = 100 × EWM(EWM(Close - mid, 3), 3) / EWM(EWM((High - Low)/2, 3), 3)
lag_smi = SMI.shift(1)`,
    desc: 'A refined version of the Stochastic Oscillator centred around zero. Double EWM smoothing reduces noise.',
    tags: ['used_in_model', 'oscillator', 'stochastic', '14/3/3'],
    usedInModel: true,
  },

  // VOLATILITY / RISK
  {
    name: 'atr',
    fullName: 'Average True Range (14-period)',
    icon: Ruler,
    category: 'risk',
    formula: `TR = max(High - Low, |High - prev_Close|, |Low - prev_Close|)
ATR = EWM(TR, span=14)`,
    desc: 'Measures market volatility by decomposing the entire range of a price bar — including gaps. Higher ATR means greater price movement regardless of direction.',
    tags: ['used_in_model', 'volatility', '14-period', 'true_range'],
    usedInModel: true,
  },
  {
    name: 'volatility',
    fullName: 'Annualised Volatility (20-day rolling std of log returns)',
    icon: LineChart,
    category: 'risk',
    formula: `log_return = ln(Close_t / Close_{t-1})
volatility = rollStd(log_return, 20) × √252`,
    desc: 'The standard deviation of log returns over the past 20 days, scaled to annual units (×√252 trading days). A key risk measure used in options pricing.',
    tags: ['used_in_model', 'risk', 'annualised', '20-day'],
    usedInModel: true,
  },
  {
    name: 'price_spike',
    fullName: 'Price Spike Flag (2σ outlier detector)',
    icon: Zap,
    category: 'risk',
    formula: `upper = rollMean(Change%, 20) + 2 × rollStd(...)
price_spike = 1 if Change% > upper OR Change% < lower`,
    desc: 'Binary flag (0/1) indicating whether today\'s price change is an extreme outlier. When spike=1, the prediction is dampened to avoid false extremes.',
    tags: ['used_in_model', 'binary', 'outlier', '2sigma'],
    usedInModel: true,
  },

  // VOLUME
  {
    name: 'zscore',
    fullName: 'ZScore of Volume (20-day rolling)',
    icon: ArrowDownToLine,
    category: 'volume',
    formula: `zscore_vol = (Volume - rollMean(Volume,20)) / rollStd(Volume,20)`,
    desc: 'How unusual today\'s trading volume is relative to the past 20 trading days, expressed in standard deviations. Normalises across different stocks.',
    tags: ['used_in_model', 'volume', '20-day', 'z-score'],
    usedInModel: true,
  },

  // PHYSICS-INSPIRED
  {
    name: 'RVI',
    fullName: 'Relative Volatility Index',
    icon: Activity,
    category: 'physics',
    formula: `RVI = 100 × std(upWARD, 14) / (std(upWARD,14) + std(downWARD,14))`,
    desc: 'Like RSI but uses standard deviation of price moves instead of magnitude. Measures the direction of volatility rather than just price.',
    tags: ['volatility', 'directional', '14-period'],
    usedInModel: false,
  },
  {
    name: 'EMV',
    fullName: 'Ease of Movement (14-day smoothed)',
    icon: Droplets,
    category: 'physics',
    formula: `Box_ratio = (Volume / vol_scale) / (High - Low)
EMV = Distance / Box_ratio`,
    desc: 'Measures how easily price moves through the volume. Near zero means price is struggling to move despite heavy volume.',
    tags: ['volume_price', 'efficiency', '14-day'],
    usedInModel: false,
  },
  {
    name: 'RN',
    fullName: 'Reynolds Number (Physics-Inspired Turbulence Index)',
    icon: Wind,
    category: 'physics',
    formula: `RN = RVI / EMV_smooth`,
    desc: 'Inspired by fluid dynamics, the Reynolds Number in finance measures the ratio of inertial forces (RVI) to viscous forces (EMV). Small RN = smooth trend; Large RN = chaotic.',
    tags: ['used_in_model', 'physics', 'novel', 'turbulence'],
    usedInModel: true,
  },
];

const CATEGORIES = {
  price:    { label: 'Price & Trend Features',      icon: BarChart2,    color: 'price' },
  momentum: { label: 'Momentum Oscillators',        icon: Activity,     color: 'momentum' },
  risk:     { label: 'Risk & Volatility Features',  icon: Zap,          color: 'risk' },
  volume:   { label: 'Volume Features',             icon: ArrowDownToLine,color: 'volume' },
  physics:  { label: 'Physics-Inspired Features',   icon: Orbit,        color: 'physics' },
};
import { Orbit } from 'lucide-react'; // missed it at top

const OVERVIEW = [
  { icon: BarChart2, name:'Change%',          cat:'price',    desc:'Daily % change → drives grade bucketing' },
  { icon: Tag,       name:'grade_no',         cat:'price',    desc:'7-class ordinal regime label (0–6)' },
  { icon: Axis3D,    name:'range_norm_close', cat:'price',    desc:'TARGET: 20-day range-normalised close' },
  { icon: Activity,  name:'lag_RSI [14]',     cat:'momentum', desc:'Lagged 14-period RSI (no look-ahead)' },
  { icon: Wind,      name:'lag_SMI [14/3/3]', cat:'momentum', desc:'Lagged double-smoothed stochastic' },
  { icon: Ruler,     name:'ATR [14]',         cat:'risk',     desc:'Average True Range for raw volatility' },
  { icon: LineChart, name:'Volatility [20]',  cat:'risk',     desc:'Annualised log-return std deviation' },
  { icon: Zap,       name:'price_spike',      cat:'risk',     desc:'Binary 2σ outlier flag with spike controller' },
  { icon: ArrowDownToLine, name:'ZScore_Vol [20]',cat:'volume', desc:'z-score of daily volume vs 20-day window' },
  { icon: Activity,  name:'RVI [14]',         cat:'physics',  desc:'Direction-of-volatility index (RSI variant)' },
  { icon: Droplets,  name:'EMV [14]',         cat:'physics',  desc:'Ease-of-Movement: price efficiency' },
  { icon: Wind,      name:'RN = RVI/EMV',     cat:'physics',  desc:'Reynolds Number: laminar vs turbulent market' },
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
      <div className="fd-header bento-tile">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileText size={28} className="text-primary"/> Feature Engineering Pipeline
        </h1>
        <p className="text-secondary" style={{ maxWidth: '800px', marginTop: '12px' }}>
          Complete documentation of all <strong>12 engineered features</strong> used in the Nifty 50 XGBoost
          prediction model.
          Features marked <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ Used in model</span> are
          the 9 selected features fed to XGBRegressor.
        </p>
      </div>

      <div className="grid-12">
        {/* Target box */}
        <div className="bento-tile" style={{ gridColumn: 'span 12', background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--text-primary)' }}>
            <Target size={20} className="text-accent" /> Prediction Target: range_norm_close.shift(-1)
          </h3>
          <p className="text-secondary" style={{ marginTop: '12px', marginBottom: 0 }}>
            The model predicts the <em>next day's</em> 20-day range-normalised closing price.
            A value of <strong>1.0</strong> means the next close is at the top of its recent 20-day range; <strong> 0.0</strong> means at the bottom.
          </p>
        </div>

        {/* Pipeline overview grid */}
        <div className="bento-tile" style={{ gridColumn: 'span 12' }}>
          <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '20px' }}>All Features at a Glance</h2>
          <div className="grid-12">
            {OVERVIEW.map(f => {
              const OIcon = f.icon;
              return (
                <div key={f.name} style={{ gridColumn: 'span 4', display: 'flex', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ color: 'var(--accent)', flexShrink: 0 }}><OIcon size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{f.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Model parameters */}
      <div className="bento-tile">
        <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '20px' }}>XGBoost Model Configuration</h2>
        <div className="grid-12">
          <div style={{ gridColumn: 'span 6' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '12px' }}>Hyperparameters</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                ['n_estimators',   '100'],
                ['max_depth',      '4'],
                ['learning_rate',  '0.05'],
                ['subsample',      '0.8'],
                ['colsample_bytree','0.8'],
                ['objective',      'reg:squarederror'],
              ].map(([k,v])=>(
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: 'span 6' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '12px' }}>Pipeline Steps</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                ['Sorting',         'sort_values("Date")'],
                ['Lag creation',    'RSI.shift(1), SMI.shift(1)'],
                ['Feature matrix',  '9 selected features'],
                ['Poly expansion',  'PolynomialFeatures(degree=2)'],
                ['Split strategy',  'TimeSeriesSplit(n_splits=5)'],
                ['Spike control',   '0.5 + 0.3×(pred−0.5)'],
              ].map(([k,v])=>(
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-category feature cards */}
      {grouped.map(grp=>{
        const CIcon = grp.icon;
        return (
        <div key={grp.key} style={{ marginTop: '24px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '16px' }}>
            <CIcon size={20} className="text-secondary" /> {grp.label}
          </h2>
          <div className="grid-12">
            {grp.features.map(f=>{
              const FIcon = f.icon;
              return (
              <div key={f.name} className="bento-tile" style={{ gridColumn: 'span 6', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <FIcon size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{f.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{f.fullName}</div>
                  </div>
                </div>
                <div style={{ background: '#070b14', padding: '12px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px', border: '1px solid var(--border)' }}>
                  {f.formula}
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>{f.desc}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 'auto' }}>
                  {f.usedInModel && <span style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--green)', padding: '4px 10px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 600 }}>✓ Used in Model</span>}
                  {f.tags.filter(t=>t!=='used_in_model').map(t=>(
                    <span key={t} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '100px', fontSize: '0.7rem' }}>{t.replace(/_/g,' ')}</span>
                  ))}
                </div>
              </div>
            )})}
          </div>
        </div>
      )})}
    </div>
  );
};

export default FeatureDetailsPage;
