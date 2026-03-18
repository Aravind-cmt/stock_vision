import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useStock } from '../context/StockContext';
import { mean, max, min, stdDev, interpretTrend } from '../utils/statistics';
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
      <div className="report-empty">
        <span>📊</span>
        <p>No data. Fetch stock data first.</p>
        <button onClick={() => navigate('/input')}>← Go to Input</button>
      </div>
    );
  }

  const closes = stockData.map((d) => d.close);
  const stats = {
    mean: mean(closes).toFixed(2),
    max: max(closes).toFixed(2),
    min: min(closes).toFixed(2),
    stdDev: stdDev(closes).toFixed(2),
  };

  const interpretation = interpretTrend(stockData);

  // Chart data: use every Nth point to avoid too-dense charts
  const stride = Math.max(1, Math.floor(stockData.length / 60));
  const chartData = stockData.filter((_, i) => i % stride === 0).map((d) => ({
    date: d.date.slice(5), // MM-DD
    close: d.close,
    open: d.open,
    gain: parseFloat(((d.close - d.open) / d.open * 100).toFixed(2)),
  }));

  const handleDownloadPDF = async () => {
    const element = reportRef.current;
    const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: '#0a0a0f' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    let heightLeft = pdfH;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
    heightLeft -= pdf.internal.pageSize.getHeight();
    while (heightLeft > 0) {
      position -= pdf.internal.pageSize.getHeight();
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfW, pdfH);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }
    pdf.save(`${activeSock?.name || 'stock'}_report.pdf`);
  };

  return (
    <div className="report-outer">
      {/* Actions strip outside the printable area */}
      <div className="report-actions">
        <button className="btn-back" onClick={() => navigate('/output')}>← Back to Data</button>
        <button className="btn-pdf" onClick={handleDownloadPDF}>⬇️ Download PDF Report</button>
      </div>

      {/* Printable report area */}
      <div className="report-content animate-in delay-1" ref={reportRef}>
        <div className="report-title-section">
          <h1>📈 {activeSock?.name} — Analysis Report</h1>
          <p>{activeSock?.label} · {stockData[0].date} to {stockData[stockData.length - 1].date}</p>
          {stockData.some((r) => r.simulated) && <span className="mock-tag">ℹ️ Simulated Fallback</span>}
        </div>

        {/* Stats cards */}
        <div className="stats-grid animate-in delay-2">
          {[
            { label: 'Mean Price', value: `$${stats.mean}`, icon: '〰️', color: '#a78bfa' },
            { label: 'Max Price', value: `$${stats.max}`, icon: '🔝', color: '#34d399' },
            { label: 'Min Price', value: `$${stats.min}`, icon: '🔻', color: '#f87171' },
            { label: 'Std Dev', value: `$${stats.stdDev}`, icon: '📐', color: '#fbbf24' },
          ].map((s) => (
            <div className="stat-card card-hover-shimmer" key={s.label} style={{ borderColor: `${s.color}30` }}>
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Price line chart */}
        <div className="chart-section animate-in delay-3">
          <h2>Price Over Time (Close)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={parseFloat(stats.mean)} stroke="rgba(167,139,250,0.4)" strokeDasharray="4 4" label={{ value: 'Mean', fill: '#a78bfa', fontSize: 11 }} />
              <Line type="monotone" dataKey="close" stroke="#6c63ff" strokeWidth={2} dot={false} name="Close Price" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Daily gain/loss bar chart */}
        <div className="chart-section animate-in delay-4">
          <h2>Daily Gain / Loss (%)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
              <Bar dataKey="gain" name="Daily Change %" fill="#6c63ff"
                shape={(props) => {
                  const { x, y, width, height, value } = props;
                  const color = value >= 0 ? '#00e676' : '#ff1744';
                  return <rect x={x} y={y} width={width} height={height} fill={color} rx={2} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Interpretation */}
        <div className="interpretation-section animate-in delay-5">
          <h2>🧠 AI Interpretation</h2>
          <div className="interpretation-card card-hover-shimmer">
            {interpretation.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        <div className="report-footer">
          Generated by StockVision · {new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
