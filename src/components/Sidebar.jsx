import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();

  if (!currentUser) return null; // Don't show sidebar on login/signup

  const navLinks = [
    { path: '/select-stocks', label: 'Select Stocks' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/input', label: 'Input Data' },
    { path: '/output', label: 'Output Table' },
    { path: '/report', label: 'Analytics Report'},
    { path: '/ml-placeholder', label: 'AI Predict' }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="brand-logo">StockVision</h2>
        <div className="brand-badge">Student Edition</div>
      </div>

      <nav className="sidebar-nav">
        {navLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`nav-item ${location.pathname === link.path ? 'active' : ''}`}
          >
            <span className="nav-icon">{link.icon}</span>
            <span className="nav-label">{link.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{currentUser.username.charAt(0).toUpperCase()}</div>
          <span className="username">{currentUser.username}</span>
        </div>
        <button className="btn-logout" onClick={logout}>Sign Out</button>

        <div className="tech-stack-label">
          <strong>Built with:</strong><br/>
          React.js &bull; Axios &bull; Recharts<br/>
          jsPDF &bull; localStorage
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
