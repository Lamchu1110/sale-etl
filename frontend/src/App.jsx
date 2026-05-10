import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/common/PrivateRoute';

import LoginPage      from './pages/auth/LoginPage';
import UploadPage     from './pages/upload/UploadPage';
import DashboardPage  from './pages/dashboard/DashboardPage';
import ETLStatusPage  from './pages/etl/ETLStatusPage';
import ForecastPage   from './pages/forecast/ForecastPage';
import AdminPage      from './pages/admin/AdminPage';
import NotFoundPage   from './pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<PrivateRoute />}>
            <Route path="/"           element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<DashboardPage />} />
            <Route path="/upload"     element={<UploadPage />} />
            <Route path="/etl-status" element={<ETLStatusPage />} />
            <Route path="/forecast"   element={<ForecastPage />} />
            <Route path="/admin"      element={<AdminPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: 500,
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          },
          success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
        }}
      />
    </AuthProvider>
  );
}
