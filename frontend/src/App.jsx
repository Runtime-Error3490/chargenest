import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useAuthStore } from './store/authStore';
import Layout, { FullScreenLayout } from './components/layout/Layout';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import SearchPage from './pages/SearchPage';
import ChargerDetailPage from './pages/ChargerDetailPage';
import BookingConfirmPage from './pages/BookingConfirmPage';
import BookingsPage from './pages/BookingsPage';
import BookingDetailPage from './pages/BookingDetailPage';
import ChatPage from './pages/ChatPage';
import AgentSettingsPage from './pages/AgentSettingsPage';
import DashboardPage from './pages/DashboardPage';
import HostDashboardPage from './pages/HostDashboardPage';
import CreateChargerPage from './pages/CreateChargerPage';
import HostChargersPage from './pages/HostChargersPage';
import HostBookingsPage from './pages/HostBookingsPage';
import TeamPage from './pages/TeamPage';
import NotFoundPage from './pages/NotFoundPage';
import BecomeHostPage from './pages/BecomeHostPage';

// Admin Pages
import {
  AdminDashboardPage,
  AdminUsersPage,
  AdminPaymentsPage,
  AdminAnalyticsPage,
  AdminDisputesPage,
  AdminAuditLogsPage,
  AdminSettingsPage,
  AdminRatingsPage,
  AdminChargersPage,
  AdminBookingsPage,
} from './pages/admin';

// Protected Route wrapper
function ProtectedRoute({ children, roles = [] }) {
  const { isAuthenticated, hasRole } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0 && !roles.some(role => hasRole(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// PayPal options
const paypalOptions = {
  'client-id': import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test',
  currency: 'INR',
  intent: 'capture',
};

function App() {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <PayPalScriptProvider options={paypalOptions}>
      <Routes>
        {/* Public routes with Layout */}
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/login" element={<Layout showFooter={false}><LoginPage /></Layout>} />
        <Route path="/register" element={<Layout showFooter={false}><RegisterPage /></Layout>} />
        <Route path="/search" element={<FullScreenLayout><SearchPage /></FullScreenLayout>} />
        <Route path="/chargers/:id" element={<Layout><ChargerDetailPage /></Layout>} />
        <Route path="/team" element={<Layout><TeamPage /></Layout>} />

        {/* Protected routes - any authenticated user */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout><DashboardPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/bookings" element={
          <ProtectedRoute>
            <Layout><BookingsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/bookings/:id" element={
          <ProtectedRoute>
            <Layout><BookingDetailPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/bookings/:id/confirm" element={
          <ProtectedRoute>
            <Layout showFooter={false}><BookingConfirmPage /></Layout>
          </ProtectedRoute>
        } />

        {/* Chat - accessible by authenticated users */}
        <Route path="/chat" element={
          <ProtectedRoute>
            <FullScreenLayout><ChatPage /></FullScreenLayout>
          </ProtectedRoute>
        } />
        
        {/* Agent settings */}
        <Route path="/settings/agent" element={
          <ProtectedRoute>
            <Layout><AgentSettingsPage /></Layout>
          </ProtectedRoute>
        } />

        {/* Host-only routes */}
        <Route path="/host/register" element={
          <ProtectedRoute>
            <Layout><BecomeHostPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/host/dashboard" element={
          <ProtectedRoute roles={['host']}>
            <Layout><HostDashboardPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/host/chargers/new" element={
          <ProtectedRoute roles={['host']}>
            <Layout><CreateChargerPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/host/chargers" element={
          <ProtectedRoute roles={['host']}>
            <Layout><HostChargersPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/host/chargers/:id/edit" element={
          <ProtectedRoute roles={['host']}>
            <Layout><CreateChargerPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/host/bookings" element={
          <ProtectedRoute roles={['host']}>
            <Layout><HostBookingsPage /></Layout>
          </ProtectedRoute>
        } />

        {/* Admin-only routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminDashboardPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminUsersPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/users/:id" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminUsersPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/payments" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminPaymentsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/analytics" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminAnalyticsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/disputes" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminDisputesPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/audit-logs" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminAuditLogsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminSettingsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/ratings" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminRatingsPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/chargers" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminChargersPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/admin/bookings" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminBookingsPage /></Layout>
          </ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={<Layout><NotFoundPage /></Layout>} />
      </Routes>
    </PayPalScriptProvider>
  );
}

export default App;
