import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BarChart2, TrendingUp, Bot, Smartphone } from 'lucide-react';
import '../styles/Landing.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Redirect users who are already logged in to the dashboard
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  return (
    <div className="landing-container">
      <nav className="landing-nav animate-in delay-1">
        <div className="landing-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={24} className="text-primary" /> StockVision
        </div>
        <div className="landing-nav-actions">
          <button className="btn-login" onClick={() => navigate('/login')}>Log In</button>
          <button className="btn-signup glow-accent" onClick={() => navigate('/signup')}>Sign Up</button>
        </div>
      </nav>

      <main className="landing-hero animate-in delay-2">

        <h1>
          Navigate the Markets with <span className="hero-accent">Precision</span>
        </h1>
        <p>
          StockVision is a modern FinTech intelligence platform. From area chart visualizations
          to machine learning forecasts, get the ultimate edge on the Nifty 50 and global stocks.
        </p>
        <div className="hero-actions">
          <button className="btn-primary-large glow-accent" onClick={() => navigate('/signup')}>
            Start Analyzing Now →
          </button>
          <button className="btn-secondary-large" onClick={() => navigate('/login')}>
            View Dashboard
          </button>
        </div>
      </main>

      <section className="landing-features animate-in delay-3">
        <div className="features-header">
          <h2>Platform Features</h2>
          <p>Everything you need to analyze and forecast market movements.</p>
        </div>
        <div className="features-grid">

          <div className="feature-card bento-tile">
            <div className="feature-icon" style={{ color: 'var(--accent)' }}><TrendingUp size={32} /></div>
            <h3>Dynamic Visualizations</h3>
            <p>
              Beautifully rendered area and sparkline charts with integrated sentiment gauges
              that track market changes.
            </p>
          </div>

          <div className="feature-card bento-tile">
            <div className="feature-icon" style={{ color: 'var(--accent)' }}><Bot size={32} /></div>
            <h3>XGBoost ML Predictions</h3>
            <p>
              Simulate high-end quantitative trading strategies on historical data. Our XGBoost engine predicts
              up/down movements with engineered technical indicators.
            </p>
          </div>

          <div className="feature-card bento-tile">
            <div className="feature-icon" style={{ color: 'var(--accent)' }}><Smartphone size={32} /></div>
            <h3>FinTech Dashboard</h3>
            <p>
              Assemble a lightning-fast bento-layout dashboard of your favorite stocks and
              indices across global and Indian markets.
            </p>
          </div>

        </div>
      </section>

      <footer className="landing-footer">
        &copy; {new Date().getFullYear()} StockVision Platform. All rights reserved.
      </footer>
    </div>
  );
};

export default LandingPage;
