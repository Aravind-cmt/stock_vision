import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { getSelectedStocks } from '../utils/localStorage';
import { STOCK_LIST, getBasePrice } from '../utils/stockMap';
import '../styles/Dashboard.css';

const SECTOR_ICON = {
  IT: '💻', Energy: '⚡', Index: '📈', Technology: '🔵',
  Automotive: '🚗', 'E-Commerce': '🛒',
};

// Simulate a "today's price" using today's date as seed
const todayPrice = (symbol) => {
  const base = getBasePrice(symbol);
  const today = new Date();
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const dayNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const x = Math.sin(seed + dayNum) * 10000;
  const rand = x - Math.floor(x); // 0..1
  const change = (rand - 0.48) * base * 0.03;
  return {
    price: +(base + change).toFixed(2),
    changeAmt: +change.toFixed(2),
    changePct: +((change / base) * 100).toFixed(2),
  };
};

const generateSparkline = (symbol, isProfit, basePrice) => {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  let val = basePrice;
  return Array.from({length: 15}).map((_, i) => {
    val += (Math.sin(seed + i) * basePrice * 0.005) + (isProfit ? 1 : -0.8) * basePrice * 0.002;
    return { val };
  });
};

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const stocks = getSelectedStocks(currentUser.username);

  const now = new Date();
  const weekday = now.toLocaleDateString('en-IN', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // Pre-compute prices for watchlist AND all stocks (for marquee)
  const watchlistPrices = useMemo(() =>
    Object.fromEntries(stocks.map((s) => [s.symbol, todayPrice(s.symbol)])),
    []
  );
  const allPrices = useMemo(() =>
    Object.fromEntries(STOCK_LIST.map((s) => [s.symbol, todayPrice(s.symbol)])),
    []
  );

  const goToInput = (stock) => navigate('/input', { state: { stock } });

  return (
    <div className="dash-container">

      {/* ── Marquee Ticker ── */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {/* duplicate list for seamless loop */}
          {[...STOCK_LIST, ...STOCK_LIST].map((s, i) => {
            const p = allPrices[s.symbol];
            const isProfit = p.changePct >= 0;
            return (
              <span key={`${s.symbol}-${i}`} className="ticker-item">
                <span className="ticker-name">{s.name}</span>
                <span className="ticker-price">{s.country === 'IN' && s.sector !== 'Index' ? '₹' : '$'}{p.price.toLocaleString()}</span>
                <span className={`ticker-change ${isProfit ? 'up' : 'down'}`}>
                  {isProfit ? '▲' : '▼'} {Math.abs(p.changePct)}%
                </span>
                <span className="ticker-sep">·</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Hero: greeting + date ── */}
      <div className="dash-hero animate-in delay-1">
        <div className="dash-greeting">
          <div className="dash-avatar">{currentUser.username.charAt(0).toUpperCase()}</div>
          <div>
            <h1>Hello, <span className="name-accent">{currentUser.username}</span> 👋</h1>
            <div className="dash-date-row">
              <span className="dash-weekday">{weekday}</span>
              <span className="dash-date-sep">—</span>
              <span className="dash-date">{dateStr}</span>
              <span className="dash-time">{timeStr}</span>
            </div>
          </div>
        </div>
        <div className="dash-hero-actions">
          <button className="btn-search" onClick={() => navigate('/input')}>
            🔍 Search Other Stocks
          </button>
          <button className="btn-ml" onClick={() => navigate('/ml-placeholder')}>
            🤖 AI Predict <span className="coming-soon">Soon</span>
          </button>
        </div>
      </div>

      {/* ── Watchlist with today's price ── */}
      <section className="dash-section animate-in delay-2">
        <h2 className="section-title">⭐ Your Watchlist
          <span className="section-sub">Today's Prices</span>
        </h2>
        <div className="stock-cards-row">
          {stocks.map((stock) => {
            const p = watchlistPrices[stock.symbol];
            const isProfit = p.changePct >= 0;
            const currency = stock.country === 'IN' && stock.sector !== 'Index' ? '₹' : '$';
            return (
              <button
                key={stock.symbol}
                className="stock-card card-hover-shimmer"
                onClick={() => goToInput(stock)}
              >
                <div className="sc-left">
                  <div className="sc-icon">{SECTOR_ICON[stock.sector] || '📊'}</div>
                  <div className="sc-body">
                    <span className="sc-name">{stock.name}</span>
                    <span className="sc-label">{stock.label}</span>
                    <div className="sc-price-row">
                      <span className="sc-price">{currency}{p.price.toLocaleString()}</span>
                      <span className={`sc-badge ${isProfit ? 'sc-badge--profit' : 'sc-badge--loss'}`}>
                        {isProfit ? '▲' : '▼'} {Math.abs(p.changePct)}%
                      </span>
                    </div>
                    {stock.mock && <span className="sc-mock">Simulated</span>}
                  </div>
                </div>
                
                <div className="sc-sparkline">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={generateSparkline(stock.symbol, isProfit, p.price)}>
                      <Line type="monotone" dataKey="val" stroke={isProfit ? '#34C759' : '#FF3B30'} strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={1000} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="sc-arrow">→</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Quick Tips ── */}
      <section className="dash-section animate-in delay-3">
        <h2 className="section-title">📘 Quick Start</h2>
        <div className="tips-grid">
          {[
            { icon: '1️⃣', title: 'Select a Stock', desc: 'Click any card above or search a stock below' },
            { icon: '2️⃣', title: 'Choose Date Range', desc: 'Pick start & end dates for the analysis period' },
            { icon: '3️⃣', title: 'Fetch & Analyze', desc: 'View OHLCV table, charts, and statistics' },
            { icon: '4️⃣', title: 'Export Report', desc: 'Download CSV data or a full PDF report' },
          ].map((t) => (
            <div className="tip-card card-hover-shimmer" key={t.icon}>
              <span className="tip-icon">{t.icon}</span>
              <strong>{t.title}</strong>
              <p>{t.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DashboardPage;
