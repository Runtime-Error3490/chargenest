/**
 * App.jsx - Main Application Router with Lazy Loading
 * 
 * WHY LAZY LOADING?
 * -----------------
 * 1. Faster Initial Load: Only loads code needed for the first page, reducing initial bundle size
 * 2. Better Performance: Splits code into smaller chunks that load on-demand
 * 3. Reduced Memory Usage: Pages not visited don't consume memory
 * 4. Improved UX: Users see content faster, with smooth skeleton loading states
 * 
 * HOW IT WORKS:
 * - React.lazy() dynamically imports components only when needed
 * - Suspense provides a fallback UI (skeleton) while loading
 * - Code splitting creates separate JS chunks for each lazy-loaded page
 * 
 * WHAT'S LAZY LOADED:
 * - All page components (they're larger and not all needed at once)
 * - Admin pages (only admins need these)
 * - Host pages (only hosts need these)
 * 
 * WHAT'S NOT LAZY LOADED:
 * - Layout components (needed immediately for structure)
 * - Auth store (needed for route protection)
 * - Core UI components (small and reused everywhere)
 */

import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout, { FullScreenLayout } from './components/layout/Layout';
import { 
  PageLoadingFallback, 
  PageSkeleton, 
  BookingDetailSkeleton, 
  ChatSkeleton 
} from './components/ui/Skeleton';

// ============================================
// LAZY LOADED PAGES
// ============================================

// Public Pages
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ChargerDetailPage = lazy(() => import('./pages/ChargerDetailPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const DisputesPage = lazy(() => import('./pages/DisputesPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Protected Pages - Driver/Client
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));
const BookingDetailPage = lazy(() => import('./pages/BookingDetailPage'));
const BookingConfirmPage = lazy(() => import('./pages/BookingConfirmPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const AgentSettingsPage = lazy(() => import('./pages/AgentSettingsPage'));
const BecomeHostPage = lazy(() => import('./pages/BecomeHostPage'));

// Host Pages - Only loaded when user is a host
const HostDashboardPage = lazy(() => import('./pages/HostDashboardPage'));
const CreateChargerPage = lazy(() => import('./pages/CreateChargerPage'));
const HostChargersPage = lazy(() => import('./pages/HostChargersPage'));
const HostBookingsPage = lazy(() => import('./pages/HostBookingsPage'));

// Admin Pages - Only loaded when user is an admin
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminDisputesPage = lazy(() => import('./pages/admin/AdminDisputesPage'));
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AdminAuditLogsPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminRatingsPage = lazy(() => import('./pages/admin/AdminRatingsPage'));
const AdminChargersPage = lazy(() => import('./pages/admin/AdminChargersPage'));
const AdminBookingsPage = lazy(() => import('./pages/admin/AdminBookingsPage'));

// ============================================
// SUSPENSE WRAPPERS WITH APPROPRIATE SKELETONS
// ============================================

// Default page loading wrapper
function LazyPage({ children }) {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      {children}
    </Suspense>
  );
}

// Dashboard/list pages with full skeleton
function LazyDashboard({ children }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      {children}
    </Suspense>
  );
}

// Booking detail with specific skeleton
function LazyBookingDetail({ children }) {
  return (
    <Suspense fallback={<BookingDetailSkeleton />}>
      {children}
    </Suspense>
  );
}

// Chat with chat-specific skeleton
function LazyChat({ children }) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      {children}
    </Suspense>
  );
}

// ============================================
// PROTECTED ROUTE WRAPPER
// ============================================

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

// ============================================
// MAIN APP COMPONENT
// ============================================

function App() {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <Routes>
      {/* ================================== */}
      {/* PUBLIC ROUTES */}
      {/* ================================== */}
      
      <Route path="/" element={
        <Layout>
          <LazyPage><HomePage /></LazyPage>
        </Layout>
      } />
      
      <Route path="/login" element={
        <Layout showFooter={false}>
          <LazyPage><LoginPage /></LazyPage>
        </Layout>
      } />
      
      <Route path="/register" element={
        <Layout showFooter={false}>
          <LazyPage><RegisterPage /></LazyPage>
        </Layout>
      } />
      
      <Route path="/search" element={
        <FullScreenLayout>
          <LazyDashboard><SearchPage /></LazyDashboard>
        </FullScreenLayout>
      } />
      
      <Route path="/chargers/:id" element={
        <Layout>
          <LazyPage><ChargerDetailPage /></LazyPage>
        </Layout>
      } />
      
      <Route path="/team" element={
        <Layout>
          <LazyPage><TeamPage /></LazyPage>
        </Layout>
      } />
      
      <Route path="/support" element={
        <Layout>
          <LazyPage><SupportPage /></LazyPage>
        </Layout>
      } />

      <Route path="/terms" element={
        <Layout>
          <LazyPage><LegalPage doc="terms" /></LazyPage>
        </Layout>
      } />
      
      <Route path="/privacy" element={
        <Layout>
          <LazyPage><LegalPage doc="privacy" /></LazyPage>
        </Layout>
      } />
      
      <Route path="/host-policy" element={
        <Layout>
          <LazyPage><LegalPage doc="host-policy" /></LazyPage>
        </Layout>
      } />

      {/* ================================== */}
      {/* PROTECTED ROUTES - ANY AUTHENTICATED USER */}
      {/* ================================== */}
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Layout>
            <LazyDashboard><DashboardPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/bookings" element={
        <ProtectedRoute>
          <Layout>
            <LazyDashboard><BookingsPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/bookings/:id" element={
        <ProtectedRoute>
          <Layout>
            <LazyBookingDetail><BookingDetailPage /></LazyBookingDetail>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/bookings/:id/confirm" element={
        <ProtectedRoute>
          <Layout showFooter={false}>
            <LazyPage><BookingConfirmPage /></LazyPage>
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/chat" element={
        <ProtectedRoute>
          <FullScreenLayout>
            <LazyChat><ChatPage /></LazyChat>
          </FullScreenLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/wallet" element={
        <ProtectedRoute>
          <Layout>
            <LazyPage><WalletPage /></LazyPage>
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/disputes" element={
        <ProtectedRoute>
          <Layout>
            <LazyPage><DisputesPage /></LazyPage>
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/settings/agent" element={
        <ProtectedRoute>
          <Layout>
            <LazyDashboard><AgentSettingsPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />

      {/* ================================== */}
      {/* HOST-ONLY ROUTES */}
      {/* ================================== */}
      
      <Route path="/host/register" element={
        <ProtectedRoute>
          <Layout>
            <LazyPage><BecomeHostPage /></LazyPage>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/host/dashboard" element={
        <ProtectedRoute roles={['host']}>
          <Layout>
            <LazyDashboard><HostDashboardPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/host/chargers/new" element={
        <ProtectedRoute roles={['host']}>
          <Layout>
            <LazyPage><CreateChargerPage /></LazyPage>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/host/chargers" element={
        <ProtectedRoute roles={['host']}>
          <Layout>
            <LazyDashboard><HostChargersPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/host/chargers/:id/edit" element={
        <ProtectedRoute roles={['host']}>
          <Layout>
            <LazyPage><CreateChargerPage /></LazyPage>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/host/bookings" element={
        <ProtectedRoute roles={['host']}>
          <Layout>
            <LazyDashboard><HostBookingsPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />

      {/* ================================== */}
      {/* ADMIN-ONLY ROUTES */}
      {/* ================================== */}
      
      <Route path="/admin/dashboard" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminDashboardPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/users" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminUsersPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/users/:id" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminUsersPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/payments" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminPaymentsPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/analytics" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminAnalyticsPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/disputes" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminDisputesPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/audit-logs" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminAuditLogsPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/settings" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminSettingsPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/ratings" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminRatingsPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/chargers" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminChargersPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />
      
      <Route path="/admin/bookings" element={
        <ProtectedRoute roles={['admin']}>
          <Layout>
            <LazyDashboard><AdminBookingsPage /></LazyDashboard>
          </Layout>
        </ProtectedRoute>
      } />

      {/* ================================== */}
      {/* 404 - NOT FOUND */}
      {/* ================================== */}
      
      <Route path="*" element={
        <Layout>
          <LazyPage><NotFoundPage /></LazyPage>
        </Layout>
      } />
    </Routes>
  );
}

export default App;
