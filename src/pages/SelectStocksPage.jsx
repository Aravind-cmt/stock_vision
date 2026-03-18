import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { STOCK_LIST } from '../utils/stockMap';
import { saveSelectedStocks } from '../utils/localStorage';
import '../styles/SelectStocks.css';

const REQUIRED = 3;

const SelectStocksPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');

  const toggle = (stock) => {
    setError('');
    setSelected((prev) => {
      const existing = prev.find((s) => s.symbol === stock.symbol);
      if (existing) return prev.filter((s) => s.symbol !== stock.symbol);
      if (prev.length >= REQUIRED) {
        setError(`You can only select ${REQUIRED} stocks.`);
        return prev;
      }
      return [...prev, stock];
    });
  };

  const isSelected = (stock) => selected.some((s) => s.symbol === stock.symbol);

  const handleConfirm = () => {
    if (selected.length < REQUIRED) {
      setError(`Please select exactly ${REQUIRED} stocks.`);
      return;
    }
    saveSelectedStocks(currentUser.username, selected);
    navigate('/dashboard');
  };

  const groups = [
    { label: '🇮🇳 Indian Stocks', items: STOCK_LIST.filter((s) => s.country === 'IN' && s.sector !== 'Index') },
    { label: '📈 Market Indices', items: STOCK_LIST.filter((s) => s.sector === 'Index') },
    { label: '🌍 Global Stocks', items: STOCK_LIST.filter((s) => s.country === 'US') },
  ];

  return (
    <div className="select-container">
      <div className="select-header animate-in delay-1">
        <h1>Choose Your Top <span className="accent">3</span> Stocks</h1>
        <p>These will appear on your dashboard for quick access</p>
        <div className="select-progress">
          {Array.from({ length: REQUIRED }).map((_, i) => (
            <div key={i} className={`progress-dot ${i < selected.length ? 'filled' : ''}`} />
          ))}
          <span>{selected.length} / {REQUIRED} selected</span>
        </div>
        {error && <div className="select-error">{error}</div>}
      </div>

      {groups.map((group) => (
        <div key={group.label} className="stock-group animate-in delay-2">
          <h2 className="group-label">{group.label}</h2>
          <div className="stock-grid">
            {group.items.map((stock) => (
              <button
                key={stock.symbol}
                className={`stock-option-card card-hover-shimmer ${isSelected(stock) ? 'selected' : ''}`}
                onClick={() => toggle(stock)}
              >
                <span className="stock-option-name">{stock.name}</span>
                <span className="stock-option-label">{stock.label}</span>
                {stock.mock && <span className="mock-badge">Simulated</span>}
                <div className="check-indicator">{isSelected(stock) ? '✓' : '+'}</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="select-footer animate-in delay-3">
        <button
          className={`confirm-btn ${selected.length === REQUIRED ? 'ready' : ''}`}
          onClick={handleConfirm}
          disabled={selected.length !== REQUIRED}
        >
          Continue to Dashboard →
        </button>
      </div>
    </div>
  );
};

export default SelectStocksPage;
