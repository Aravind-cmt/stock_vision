import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useStock } from '../context/StockContext';
import { mean, max, min, stdDev, interpretTrend } from '../utils/statistics';
import { 
  BarChart2, ArrowLeft, FileDown, TrendingUp, Info, 
  Activity, ArrowUpFromLine, ArrowDownToLine, Ruler, TreePine 
} from 'lucide-react';
import '../styles/Report.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="tt-label">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const ReportPage = () => {
  const navigate = useNavigate();
  const { stockData, activeSock } = useStock();
  const reportRef = useRef(null);

  if (!stockData || stockData.length === 0) {
    return (
      <div className="report-empty empty-state" style={{ margin: '40px auto', maxWidth: '600px' }}>
        <BarChart2 size={48} className="empty-icon" />
        <h3 style={{ marginTop: '16px', color: 'var(--text-primary)' }}>No data</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Fetch stock data first to generate a report.</p>
        <button className="btn-primary" onClick={() => navigate('/input')} style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} /> Go to Input
        </button>
      </div>
    );
  }

  const closes = stockData.map((d) => d.close);
  const stats = {
    mean: mean(closes).toFixed(2),
    max:  max(closes).toFixed(2),
    min:  min(closes).toFixed(2),
    stdDev: stdDev(closes).toFixed(2),
  };

  const interpretation = interpretTrend(stockData);

  // Chart data — every Nth point to keep charts readable
  const stride = Math.max(1, Math.floor(stockData.length / 60));
  const chartData = stockData
    .filter((_, i) => i % stride === 0)
    .map((d) => ({
      date: d.date.slice(5),
      close: d.close,
      open: d.open,
      gain: parseFloat(((d.close - d.open) / d.open * 100).toFixed(2)),
    }));

  // ─── PDF via browser native print ─────────────────────────────────────────
  // html2canvas cannot resolve CSS custom properties (var(--...)) → blank pages.
  // window.print() uses the real browser renderer, so everything is correct.
  const handleDownloadPDF = () => {
    // Force animate-in elements fully visible before printing
    const animEls = document.querySelectorAll('.animate-in');
    animEls.forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      el.style.animation = 'none';
    });

    const prevTitle = document.title;
    document.title = `${activeSock?.name || 'Stock'} – StockVision Report`;

    window.print();

    // Restore after dialog closes
    setTimeout(() => {
      animEls.forEach((el) => {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.animation = '';
      });
      document.title = prevTitle;
    }, 1500);
  };

  return (
    <div className="report-outer bento-container">

      {/* Action buttons — hidden during print */}
      <div className="report-actions no-print" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn-secondary" onClick={() => navigate('/output')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} /> Back to Data
        </button>
        <button className="btn-primary" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileDown size={16} /> Download PDF Report
        </button>
      </div>

      {/* ═══════════ PRINTABLE AREA ═══════════ */}
      <div className="report-content animate-in delay-1" ref={reportRef}>

        {/* Title */}
        <div className="report-title-section bento-tile">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)'}}>
            <TrendingUp size={28} className="text-primary"/> {activeSock?.name} — Analysis Report
          </h1>
          <p className="text-secondary">{activeSock?.label} · {stockData[0].date} → {stockData[stockData.length - 1].date}</p>
          {stockData.some((r) => r.simulated) && (
            <span className="mock-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Info size={14} /> Simulated Fallback Data
            </span>
          )}
        </div>

        {/* Stats cards */}
        <div className="stats-grid animate-in delay-2">
          {[
            { label: 'Mean Price', value: `₹${stats.mean}`,   icon: Activity, color: '#3b82f6' },
            { label: 'Max Price',  value: `₹${stats.max}`,    icon: ArrowUpFromLine, color: '#10B981' },
            { label: 'Min Price',  value: `₹${stats.min}`,    icon: ArrowDownToLine, color: '#EF4444' },
            { label: 'Std Dev',    value: `₹${stats.stdDev}`, icon: Ruler, color: '#F59E0B' },
          ].map((s) => {
            const SIcon = s.icon;
            return (
            <div
              className="stat-card bento-tile card-hover-shimmer"
              key={s.label}
              style={{ borderColor: `${s.color}40`, padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <span className="stat-icon" style={{ color: s.color }}><SIcon size={24} /></span>
              <span className="stat-value" style={{ color: s.color, fontSize: '1.5rem', fontWeight: 700 }}>{s.value}</span>
              <span className="stat-label" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>{s.label}</span>
            </div>
          )})}
        </div>

        {/* Price chart */}
        <div className="chart-section bento-tile bento-large animate-in delay-3">
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Price Over Time (Close)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.08)" />
              <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={parseFloat(stats.mean)}
                stroke="#0B3D91"
                strokeDasharray="4 4"
                label={{ value: 'Mean', fill: '#0B3D91', fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#0B3D91"
                strokeWidth={2}
                dot={false}
                name="Close Price"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gain/loss bar chart */}
        <div className="chart-section bento-tile bento-large animate-in delay-4">
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '16px' }}>Daily Gain / Loss (%)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(0,0,0,0.08)" />
              <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="rgba(0,0,0,0.15)" />
              <Bar
                dataKey="gain"
                name="Daily Change %"
                shape={(props) => {
                  const { x, y, width, height, value } = props;
                  return (
                    <rect
                      x={x} y={y} width={width} height={height}
                      fill={value >= 0 ? '#10B981' : '#EF4444'}
                      rx={2}
                    />
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Statistical interpretation */}
        <div className="interpretation-section bento-tile bento-large animate-in delay-5">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '16px' }}><BarChart2 size={24} className="text-secondary" /> ML Statistical Analysis</h2>
          <div className="interpretation-card card-hover-shimmer" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {interpretation.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        {/* XGBoost feature summary */}
        <div className="ml-summary-box bento-tile bento-large animate-in delay-5">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', marginBottom: '16px' }}><TreePine size={24} className="text-accent" /> XGBoost Model — Feature Highlights</h2>
          <div className="ml-summary-grid">
            {[
              { name: 'RSI (14)',          desc: 'Relative Strength Index — overbought / oversold signal' },
              { name: 'ATR (14)',          desc: 'Average True Range — raw market volatility' },
              { name: 'SMI (14/3/3)',      desc: 'Stochastic Momentum Index — double-smoothed oscillator' },
              { name: 'Volatility',        desc: '20-day annualised log-return std deviation' },
              { name: 'ZScore Vol',        desc: 'Volume z-score vs 20-day rolling window' },
              { name: 'RN = RVI / EMV',   desc: 'Reynolds Number — laminar vs turbulent market regime' },
              { name: 'PriceSpike',        desc: 'Binary 2σ outlier flag on daily change %' },
              { name: 'Grade (0–6)',       desc: '7-bucket daily return classification' },
              { name: 'lag_RSI / lag_SMI',desc: 'Lagged signals to prevent look-ahead bias' },
            ].map((f) => (
              <div key={f.name} className="ml-feat-row">
                <span className="ml-feat-name">{f.name}</span>
                <span className="ml-feat-desc">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="report-footer">
          Generated by StockVision ·{' '}
          {new Date().toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
          <span style={{ marginLeft: '1rem', opacity: 0.5 }}>
            XGBoost · Yahoo Finance · React.js
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
