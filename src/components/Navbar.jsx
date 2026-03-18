import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeSwitcher from './ThemeSwitcher';
import './Navbar.css';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">📊</span>
        <span className="brand-name">StockVision</span>
      </div>
      <div className="navbar-links">
        <ThemeSwitcher />
        {currentUser ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/input">Analyze</Link>
            <Link to="/ml-placeholder">AI Predict</Link>
            <span className="navbar-user">👤 {currentUser.username}</span>
            <button className="btn-logout" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
