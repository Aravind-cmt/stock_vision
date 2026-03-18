import { createContext, useContext, useState } from 'react';

const StockContext = createContext(null);
export const useStock = () => useContext(StockContext);

export const StockProvider = ({ children }) => {
  const [stockData, setStockData] = useState([]);   // fetched OHLCV rows
  const [activeSock, setActiveStock] = useState(null); // { name, symbol, ... }
  const [isMock, setIsMock] = useState(false);

  return (
    <StockContext.Provider value={{
      stockData, setStockData,
      activeSock, setActiveStock,
      isMock, setIsMock,
    }}>
      {children}
    </StockContext.Provider>
  );
};
