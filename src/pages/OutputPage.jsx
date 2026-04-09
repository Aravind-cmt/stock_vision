import { useNavigate } from 'react-router-dom';
import { useStock } from '../context/StockContext';
import { downloadCSV } from '../utils/csvExport';
import { isINR } from '../utils/stockMap';
import '../styles/Output.css';

const OutputPage = () => {
  const navigate = useNavigate();
  const { stockData, activeSock } = useStock();
  const currency = activeSock && isINR(activeSock.symbol) ? '₹' : '$';
  const isSimulated = stockData?.some((r) => r.simulated);

  if (!stockData || stockData.length === 0) {
    return (
      <div className="output-empty">
        <span>📭</span>
        <p>No data to display. Go back and fetch some stock data first.</p>
        <button onClick={() => navigate('/input')}>← Go to Input</button>
      </div>
    );
  }

  const startPrice = stockData[0].close;
  const endPrice = stockData[stockData.length - 1].close;
  const marketChange = (((endPrice - startPrice) / startPrice) * 100).toFixed(2);
  const isProfit = endPrice >= startPrice;

  const featureCards = [
    { label: 'Starting Price', value: `${currency}${startPrice.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, icon: '🟢' },
    { label: 'Ending Price',   value: `${currency}${endPrice.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, icon: isProfit ? '📈' : '📉' },
    {
      label: 'Market Change',
      value: `${isProfit ? '+' : ''}${marketChange}%`,
      icon: isProfit ? '💹' : '📉',
      className: isProfit ? 'positive' : 'negative',
    },
    { label: 'Total Trading Days', value: stockData.length, icon: '📅' },
  ];

  return (
    <div className="output-container">
      <div className="bento-container">
        {/* Header */}
        <div className="output-header bento-tile bento-large animate-in delay-1">
          <div>
            <h1>📊 {activeSock?.name} — Data Output</h1>
            <p>{activeSock?.label} · {stockData[0].date} → {stockData[stockData.length - 1].date}</p>
          </div>
          <div className="output-header-actions">
            <button className="btn-outline" onClick={() => navigate('/input')}>← Edit</button>
            <button className="btn-csv-out" onClick={() => downloadCSV(stockData, `${activeSock?.name}_data.csv`)}>⬇️ CSV</button>
            <button className="btn-primary glow-accent" onClick={() => navigate('/report')}>View Report →</button>
          </div>
        </div>

        {isSimulated && (
          <div className="mock-notice bento-tile bento-large animate-in delay-1">
            ℹ️ Yahoo Finance data unavailable for this stock — prices are <strong>simulated</strong>. Try AAPL, TSLA or GOOGL for real data.
          </div>
        )}

        {/* Feature cards */}
        {featureCards.map((card) => (
          <div key={card.label} className={`bento-tile card-hover-shimmer ${card.className || ''}`}>
            <span className="feat-icon">{card.icon}</span>
            <span className="feat-value">{card.value}</span>
            <span className="feat-label">{card.label}</span>
          </div>
        ))}
        
        {/* Sentiment Indicator */}
        <div className="bento-tile bento-large animate-in delay-2" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Market Sentiment</h3>
          <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: isProfit ? '100%' : '5%', background: 'linear-gradient(90deg, transparent, var(--green))', transition: 'width 1s ease-in-out' }}></div>
            <div style={{ width: isProfit ? '5%' : '100%', background: 'linear-gradient(90deg, var(--red), transparent)', transition: 'width 1s ease-in-out' }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600 }}>
            <span style={{ color: !isProfit ? 'var(--red)' : 'var(--text-secondary)', opacity: !isProfit ? 1 : 0.5 }}>Bearish (Selling Pressure)</span>
            <span style={{ color: isProfit ? 'var(--green)' : 'var(--text-secondary)', opacity: isProfit ? 1 : 0.5 }}>Bullish (Buying Pressure)</span>
          </div>
        </div>

        {/* OHLCV table */}
        <div className="table-wrapper bento-tile bento-large animate-in delay-3" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="ohlcv-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Weekday</th>
                  <th>Open</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>Close</th>
                  <th>Volume</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {stockData.map((row, i) => {
                  const change = ((row.close - row.open) / row.open) * 100;
                  const profit = row.close >= row.open;
                  return (
                    <tr key={row.date} className={profit ? 'row-profit' : 'row-loss'}>
                      <td className="td-date">{row.date}</td>
                      <td className="td-weekday">{row.weekday}</td>
                      <td>{currency}{row.open.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td className="td-high">{currency}{row.high.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td className="td-low">{currency}{row.low.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td className="td-close">{currency}{row.close.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td>{row.volume.toLocaleString()}</td>
                      <td className={profit ? 'change-positive' : 'change-negative'}>
                        {profit ? '+' : ''}{change.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutputPage;
