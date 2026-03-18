// localStorage helpers
export const LS_USERS = 'stockapp_users';
export const LS_CURRENT_USER = 'stockapp_current_user';
export const LS_SELECTED_STOCKS = 'stockapp_selected_stocks';
export const LS_STOCK_CACHE = 'stockapp_stock_cache';

export const getUsers = () => JSON.parse(localStorage.getItem(LS_USERS) || '[]');
export const saveUsers = (users) => localStorage.setItem(LS_USERS, JSON.stringify(users));

export const getCurrentUser = () => JSON.parse(localStorage.getItem(LS_CURRENT_USER) || 'null');
export const saveCurrentUser = (user) => localStorage.setItem(LS_CURRENT_USER, JSON.stringify(user));
export const clearCurrentUser = () => localStorage.removeItem(LS_CURRENT_USER);

export const getSelectedStocks = (username) => {
  const all = JSON.parse(localStorage.getItem(LS_SELECTED_STOCKS) || '{}');
  return all[username] || [];
};
export const saveSelectedStocks = (username, stocks) => {
  const all = JSON.parse(localStorage.getItem(LS_SELECTED_STOCKS) || '{}');
  all[username] = stocks;
  localStorage.setItem(LS_SELECTED_STOCKS, JSON.stringify(all));
};

export const getCachedStock = (key) => {
  const all = JSON.parse(localStorage.getItem(LS_STOCK_CACHE) || '{}');
  return all[key] || null;
};
export const setCachedStock = (key, data) => {
  const all = JSON.parse(localStorage.getItem(LS_STOCK_CACHE) || '{}');
  all[key] = data;
  localStorage.setItem(LS_STOCK_CACHE, JSON.stringify(all));
};
