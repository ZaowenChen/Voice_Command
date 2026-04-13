import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { FleetPage } from './pages/FleetPage';
import { RobotControlPage } from './pages/RobotControlPage';
import { SettingsPage } from './pages/SettingsPage';

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/fleet" replace /> : <LoginPage />}
      />
      <Route
        path="/fleet"
        element={<ProtectedRoute><FleetPage /></ProtectedRoute>}
      />
      <Route
        path="/robot/:sn"
        element={<ProtectedRoute><RobotControlPage /></ProtectedRoute>}
      />
      <Route
        path="/settings"
        element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/fleet' : '/login'} replace />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
