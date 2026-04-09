import { useNavigate } from 'react-router-dom';
import { useStock } from '../context/StockContext';
import { downloadCSV } from '../utils/csvExport';
import { isINR } from '../utils/stockMap';
import { 
  Inbox, TrendingUp, TrendingDown, DollarSign, 
  Calendar, Table, FileDown, ArrowLeft, ArrowRight,
  Info, CircleDot
} from 'lucide-react';
import '../styles/Output.css';

const OutputPage = () => {
  const navigate = useNavigate();
  const { stockData, activeSock } = useStock();
  const currency = activeSock && isINR(activeSock.symbol) ? '₹' : '$';
  const isSimulated = stockData?.some((r) => r.simulated);

  if (!stockData || stockData.length === 0) {
    return (
      <div className="output-empty empty-state" style={{ margin: '40px auto', maxWidth: '600px' }}>
        <Inbox size={48} className="empty-icon" />
        <h3 style={{ marginTop: '16px', color: 'var(--text-primary)' }}>No data to display</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Go back and fetch some stock data first.</p>
        <button className="btn-primary" onClick={() => navigate('/input')} style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} /> Go to Input
        </button>
      </div>
    );
  }

  const startPrice = stockData[0].close;
  const endPrice = stockData[stockData.length - 1].close;
  const marketChange = (((endPrice - startPrice) / startPrice) * 100).toFixed(2);
  const isProfit = endPrice >= startPrice;

  const featureCards = [
    { label: 'Starting Price', value: `${currency}${startPrice.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, icon: CircleDot, iconColor: 'var(--accent)' },
    { label: 'Ending Price',   value: `${currency}${endPrice.toLocaleString(undefined, {minimumFractionDigits:2,maximumFractionDigits:2})}`, icon: isProfit ? TrendingUp : TrendingDown, iconColor: isProfit ? 'var(--green)' : 'var(--red)' },
    {
      label: 'Market Change',
      value: `${isProfit ? '+' : ''}${marketChange}%`,
      icon: DollarSign,
      iconColor: isProfit ? 'var(--green)' : 'var(--red)',
      className: isProfit ? 'positive' : 'negative',
    },
    { label: 'Total Trading Days', value: stockData.length, icon: Calendar, iconColor: 'var(--text-primary)' },
  ];

  return (
    <div className="output-container">
      <div className="bento-container" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div className="bento-tile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 8px 0', color: 'var(--text-primary)' }}><Table size={28} className="text-primary"/> {activeSock?.name} — Data Output</h1>
            <p className="text-secondary" style={{ margin: 0 }}>{activeSock?.label} · {stockData[0].date} → {stockData[stockData.length - 1].date}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => navigate('/input')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeft size={16} /> Edit
            </button>
            <button className="btn-secondary" onClick={() => downloadCSV(stockData, `${activeSock?.name}_data.csv`)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileDown size={16} /> CSV
            </button>
            <button className="btn-primary" onClick={() => navigate('/report')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              View Report <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {isSimulated && (
          <div style={{ padding: '16px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)' }}>
            <Info size={20} style={{ color: '#38bdf8' }} /> Yahoo Finance data unavailable for this stock — prices are <strong>simulated</strong>. Try AAPL, TSLA or GOOGL for real data.
          </div>
        )}

        {/* Feature cards */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {featureCards.map((card) => {
            const CIcon = card.icon;
            return (
              <div key={card.label} className={`bento-tile ${card.className || ''}`} style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px' }}>
                <span style={{ color: card.iconColor, marginBottom: '4px' }}><CIcon size={24} /></span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>{card.value}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
              </div>
            );
          })}
        </div>
        
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
        <div className="table-wrapper bento-tile" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
            <table className="dark-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Weekday</th>
                  <th className="col-num">Open</th>
                  <th className="col-num">High</th>
                  <th className="col-num">Low</th>
                  <th className="col-num">Close</th>
                  <th className="col-num">Volume</th>
                  <th className="col-num">Change</th>
                </tr>
              </thead>
              <tbody>
                {stockData.map((row, i) => {
                  const change = ((row.close - row.open) / row.open) * 100;
                  const profit = row.close >= row.open;
                  return (
                    <tr key={row.date}>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.date}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{row.weekday}</td>
                      <td className="col-num">{currency}{row.open.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td className="col-num" style={{ color: 'var(--text-primary)' }}>{currency}{row.high.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td className="col-num" style={{ color: 'var(--text-secondary)' }}>{currency}{row.low.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td className="col-num" style={{ fontWeight: 600 }}>{currency}{row.close.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td className="col-num" style={{ color: 'var(--text-muted)' }}>{row.volume.toLocaleString()}</td>
                      <td className="col-num" style={{ color: profit ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
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
