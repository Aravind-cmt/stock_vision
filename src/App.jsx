import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { StockProvider } from './context/StockContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import SelectStocksPage from './pages/SelectStocksPage';
import DashboardPage from './pages/DashboardPage';
import InputPage from './pages/InputPage';
import OutputPage from './pages/OutputPage';
import ReportPage from './pages/ReportPage';
import MLPlaceholderPage from './pages/MLPlaceholderPage';

function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <AuthProvider>
          <StockProvider>
          <Navbar />
          <div className="page-wrapper">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              {/* Protected routes */}
              <Route path="/select-stocks" element={
                <ProtectedRoute><SelectStocksPage /></ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute><DashboardPage /></ProtectedRoute>
              } />
              <Route path="/input" element={
                <ProtectedRoute><InputPage /></ProtectedRoute>
              } />
              <Route path="/output" element={
                <ProtectedRoute><OutputPage /></ProtectedRoute>
              } />
              <Route path="/report" element={
                <ProtectedRoute><ReportPage /></ProtectedRoute>
              } />
              <Route path="/ml-placeholder" element={
                <ProtectedRoute><MLPlaceholderPage /></ProtectedRoute>
              } />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </div>
          </StockProvider>
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
