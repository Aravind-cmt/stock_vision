export const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

export const max = (arr) => Math.max(...arr);

export const min = (arr) => Math.min(...arr);

export const stdDev = (arr) => {
  const m = mean(arr);
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
};

export const interpretTrend = (data) => {
  if (!data || data.length < 2) return 'Insufficient data for analysis.';
  const closes = data.map((d) => d.close);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const change = ((last - first) / first) * 100;
  const sd = stdDev(closes);
  const avgPrice = mean(closes);
  const volatility = (sd / avgPrice) * 100;

  const lines = [];

  if (change > 5) lines.push('📈 Stock shows a strong upward trend over the selected period.');
  else if (change > 0) lines.push('📈 Stock shows a moderate upward trend over the selected period.');
  else if (change > -5) lines.push('📉 Stock shows a slight downward trend over the selected period.');
  else lines.push('📉 Stock shows a strong downward trend over the selected period.');

  if (volatility > 4) lines.push('⚡ High volatility observed — prices fluctuated significantly.');
  else if (volatility > 2) lines.push('〰️ Moderate volatility observed during this period.');
  else lines.push('🟢 Low volatility observed — stock price was relatively stable.');

  const maxP = max(closes);
  const minP = min(closes);
  lines.push(`🔝 Peak price: ₹/$ ${maxP.toFixed(2)} | 🔻 Lowest price: ₹/$ ${minP.toFixed(2)}`);
  lines.push(`📊 Overall change: ${change >= 0 ? '+' : ''}${change.toFixed(2)}% from start to end of period.`);

  return lines.join('\n');
};
