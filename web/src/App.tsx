// Main App with Router
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from '../src/pages/DashboardPage';
import UsersPage from '../src/pages/UsersPage';
import ReportsPage from '../src/pages/ReportsPage';
import FaceVerificationPage from '../src/pages/FaceVerificationPage';
import SettingsPage from '../src/pages/SettingsPage';
import TransferRequestsPage from '../src/pages/TransferRequestsPage';
import OfficePage from './pages/OfficePage';
import KioskPage from './pages/KioskPage';
import KioskManagementPage from './pages/admin/KioskManagementPage';
import EmployeePage from './pages/EmployeePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/kiosk" element={<KioskPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="face-verifications" element={<FaceVerificationPage />} />
            <Route path="offices" element={<OfficePage />} />
            <Route path="kiosks" element={<KioskManagementPage />} />
            <Route path="transfer-requests" element={<TransferRequestsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="employees" element={<EmployeePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
