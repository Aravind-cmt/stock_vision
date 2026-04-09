import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { StockProvider } from './context/StockContext';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import SelectStocksPage from './pages/SelectStocksPage';
import DashboardPage from './pages/DashboardPage';
import InputPage from './pages/InputPage';
import OutputPage from './pages/OutputPage';
import ReportPage from './pages/ReportPage';
import MLPredictionPage from './pages/MLPredictionPage';
import FeatureDetailsPage from './pages/FeatureDetailsPage';

function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <AuthProvider>
          <StockProvider>
            <div className="app-layout">
              <Sidebar />
              <div className="page-wrapper">
                <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
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
              <Route path="/ml-prediction" element={
                <ProtectedRoute><MLPredictionPage /></ProtectedRoute>
              } />
              <Route path="/feature-details" element={
                <ProtectedRoute><FeatureDetailsPage /></ProtectedRoute>
              } />

              {/* Default redirect for unknown paths */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </StockProvider>
    </AuthProvider>
  </HashRouter>
</ThemeProvider>
  );
}

export default App;
