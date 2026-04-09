import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStock } from '../context/StockContext';
import { STOCK_LIST, nameToSymbol } from '../utils/stockMap';
import { fetchStockData } from '../utils/apiService';
import { downloadCSV } from '../utils/csvExport';
import { Download, RefreshCw, CheckCircle2, ArrowRight, FileDown, Search, Check } from 'lucide-react';
import '../styles/Input.css';

const InputPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setStockData, setActiveStock, setIsMock } = useStock();

  const preStock = location.state?.stock || null;

  const [stockInput, setStockInput] = useState(preStock ? preStock.name : '');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-06-30');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchedData, setFetchedData] = useState([]);
  const [resolvedStock, setResolvedStock] = useState(preStock);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);

  // live suggestions
  useEffect(() => {
    if (!stockInput.trim() || preStock) { setSuggestions([]); return; }
    const q = stockInput.toUpperCase();
    const s = STOCK_LIST.filter(
      (s) => s.name.includes(q) || s.label.toUpperCase().includes(q)
    ).slice(0, 6);
    setSuggestions(s);
  }, [stockInput]);

  const selectSuggestion = (s) => {
    setStockInput(s.name);
    setResolvedStock(s);
    setSuggestions([]);
    setShowSugg(false);
  };

  const handleFetch = async () => {
    setError('');
    if (!startDate || !endDate) { setError('Please select start and end dates.'); return; }
    if (new Date(startDate) >= new Date(endDate)) { setError('Start date must be before end date.'); return; }

    let stock = resolvedStock;
    if (!stock) {
      stock = nameToSymbol(stockInput);
      if (!stock) {
        setError(`Stock "${stockInput}" not found. Try AAPL, TSLA, RELIANCE, TCS, etc.`);
        return;
      }
      setResolvedStock(stock);
    }

    setLoading(true);
    try {
      const data = await fetchStockData(stock, startDate, endDate);
      if (data.length === 0) { setError('No trading data found for this date range.'); setLoading(false); return; }
      setFetchedData(data);
      setStockData(data);
      setActiveStock(stock);
      setIsMock(stock.mock || false);
    } catch (e) {
      setError('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (fetchedData.length === 0) { setError('Fetch data first before downloading.'); return; }
    downloadCSV(fetchedData, `${resolvedStock?.name || 'stock'}_data.csv`);
  };

  return (
    <div className="input-container bento-container">
      <div className="input-card bento-tile bento-large animate-in delay-1">
        <div className="input-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Download size={24} className="text-primary"/> Analyze a Stock</h1>
          <p className="text-secondary">Enter a stock name and date range to fetch historical data</p>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Stock Name</label>
            <div className="input-autocomplete">
              <input
                type="text"
                value={stockInput}
                onChange={(e) => { setStockInput(e.target.value); setResolvedStock(null); setShowSugg(true); }}
                onFocus={() => setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                placeholder="e.g. AAPL, TSLA, RELIANCE"
                className="dark-input"
                disabled={!!preStock}
              />
              <Search className="input-search-icon" size={16} />
              {showSugg && suggestions.length > 0 && (
                <div className="suggestions-box">
                  {suggestions.map((s) => (
                    <button key={s.symbol} className="suggestion-item" onMouseDown={() => selectSuggestion(s)}>
                      <strong>{s.name}</strong>
                      <span className="text-muted">{s.label}</span>
                      {s.mock && <span className="sugg-mock">Simulated</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {resolvedStock && (
              <div className="resolved-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} className="text-green" /> Resolved: <strong>{resolvedStock.label}</strong> ({resolvedStock.symbol})
                {resolvedStock.mock && <span className="resolved-mock"> · Simulated Data</span>}
              </div>
            )}
          </div>
        </div>

        <div className="form-row two-col">
          <div className="form-field">
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="dark-input" />
          </div>
          <div className="form-field">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="dark-input" max={new Date().toISOString().slice(0,10)} />
          </div>
        </div>

        {error && <div className="input-error" style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.1)', padding: '12px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>{error}</div>}

        <div className="input-actions" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <button className="btn-primary" onClick={handleFetch} disabled={loading || !stockInput.trim()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loading ? <><span className="loading-spinner" /> Fetching...</> : <><RefreshCw size={16} /> Fetch Data</>}
          </button>
          <button className="btn-secondary" onClick={handleDownloadCSV} disabled={fetchedData.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileDown size={16} /> Download CSV
          </button>
        </div>

        {fetchedData.length > 0 && (
          <div className="fetch-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(34,197,94,0.05)', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}><CheckCircle2 size={18} className="text-green"/> Loaded <strong>{fetchedData.length}</strong> trading days for <strong>{resolvedStock?.name}</strong></span>
            <button className="btn-primary btn-sm" onClick={() => navigate('/output')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              View Data Table <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Supported stocks quick reference */}
      <div className="stocks-reference bento-tile bento-large animate-in delay-2">
        <h3>Supported Stocks</h3>
        <div className="ref-grid">
          {STOCK_LIST.map((s) => (
            <button
              key={s.symbol}
              className="ref-item"
              onClick={() => { setStockInput(s.name); setResolvedStock(s); }}
            >
              <span className="ref-name">{s.name}</span>
              {s.mock && <span className="ref-sim">~</span>}
            </button>
          ))}
        </div>
        <p className="ref-note">~ = Simulated data (Indian stocks / indices)</p>
      </div>
    </div>
  );
};

export default InputPage;
