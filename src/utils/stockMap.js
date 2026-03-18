// Maps human-readable stock names to Yahoo Finance symbols
// Indian NSE stocks use the .NS suffix, indices use Yahoo Finance tickers

export const STOCK_LIST = [
  // Indian Stocks (NSE)
  { name: 'RELIANCE', label: 'Reliance Industries', symbol: 'RELIANCE.NS', country: 'IN', mock: false, sector: 'Energy' },
  { name: 'TCS',      label: 'Tata Consultancy Services', symbol: 'TCS.NS', country: 'IN', mock: false, sector: 'IT' },
  { name: 'INFY',     label: 'Infosys',              symbol: 'INFY.NS',     country: 'IN', mock: false, sector: 'IT' },
  // Indices
  { name: 'NIFTY 50', label: 'Nifty 50',    symbol: '^NSEI',  country: 'IN', mock: false, sector: 'Index' },
  { name: 'SENSEX',   label: 'BSE Sensex',  symbol: '^BSESN', country: 'IN', mock: false, sector: 'Index' },
  // Global Stocks
  { name: 'AAPL',  label: 'Apple Inc.',        symbol: 'AAPL',  country: 'US', mock: false, sector: 'Technology' },
  { name: 'TSLA',  label: 'Tesla Inc.',         symbol: 'TSLA',  country: 'US', mock: false, sector: 'Automotive' },
  { name: 'GOOGL', label: 'Alphabet (Google)',  symbol: 'GOOGL', country: 'US', mock: false, sector: 'Technology' },
  { name: 'MSFT',  label: 'Microsoft',          symbol: 'MSFT',  country: 'US', mock: false, sector: 'Technology' },
  { name: 'AMZN',  label: 'Amazon',             symbol: 'AMZN',  country: 'US', mock: false, sector: 'E-Commerce' },
];

export const nameToSymbol = (name) => {
  const upper = name.toUpperCase().trim();
  const found = STOCK_LIST.find(
    (s) => s.name === upper || s.symbol.toUpperCase() === upper || s.label.toUpperCase() === upper
  );
  return found || null;
};

export const getBasePrice = (symbol) => {
  const prices = {
    'RELIANCE.NS': 2800, 'TCS.NS': 3900, 'INFY.NS': 1800,
    '^NSEI': 22000, '^BSESN': 73000,
    'AAPL': 185, 'TSLA': 220, 'GOOGL': 175, 'MSFT': 415, 'AMZN': 195,
  };
  return prices[symbol] || 100;
};

// Whether a symbol is priced in INR
export const isINR = (symbol) =>
  symbol.endsWith('.NS') || symbol.endsWith('.BO') || symbol === '^NSEI' || symbol === '^BSESN';
