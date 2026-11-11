import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Zap, Calendar, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, MapPin, Activity, Shield, Clock, BarChart3
} from 'lucide-react';
import { Card, CardBody } from '../../components/ui';
import api from '../../services/api';

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/admin/dashboard');
      setDashboard(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const { overview, growth, usersByRole, bookingsByStatus, topCities, chargerStats, disputeStats, ratings } = dashboard;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Platform overview and analytics</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <StatCard
            title="Total Users"
            value={overview.totalUsers}
            icon={Users}
            change={growth.users.percentChange}
            changeLabel="vs last month"
            color="blue"
          />
          <StatCard
            title="Total Chargers"
            value={overview.totalChargers}
            icon={Zap}
            subtitle={`${chargerStats.active} active`}
            color="green"
          />
          <StatCard
            title="Total Bookings"
            value={overview.totalBookings}
            icon={Calendar}
            change={growth.bookings.percentChange}
            changeLabel="vs last month"
            color="purple"
          />
          <StatCard
            title="Platform Earnings"
                        value={`$${overview.platformEarnings.toLocaleString()}`}
            icon={DollarSign}
            change={growth.revenue.percentChange}
            changeLabel="vs last month"
            color="amber"
          />
        </div>

        {/* Alerts */}
        {disputeStats.pending > 0 && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-red-800 font-medium">
                {disputeStats.pending} disputes require admin review
              </span>
            </div>
            <Link
              to="/admin/disputes"
              className="text-red-600 hover:text-red-700 font-medium text-sm"
            >
              Review Now →
            </Link>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue This Month */}
          <Card className="lg:col-span-2">
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="p-6 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">This Month</p>
                  <p className="text-2xl font-bold text-gray-900">
                                        ${growth.revenue.thisMonth.toLocaleString()}
                  </p>
                </div>
                <div className="p-6 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Last Month</p>
                  <p className="text-2xl font-bold text-gray-900">
                                        ${growth.revenue.lastMonth.toLocaleString()}
                  </p>
                </div>
                <div className="p-6 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                                        ${overview.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Link
                  to="/admin/analytics"
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  View Detailed Analytics →
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* Users by Role */}
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Users by Role</h3>
              <div className="space-y-3">
                <RoleBar label="Clients" count={usersByRole.driver || 0} total={overview.totalUsers} color="blue" />
                <RoleBar label="Hosts" count={usersByRole.host || 0} total={overview.totalUsers} color="green" />
                <RoleBar label="Admins" count={usersByRole.admin || 0} total={overview.totalUsers} color="purple" />
              </div>
              <div className="mt-4 flex justify-end">
                <Link
                  to="/admin/users"
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  Manage Users →
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* Bookings by Status */}
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bookings by Status</h3>
              <div className="space-y-2">
                {Object.entries(bookingsByStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="capitalize text-gray-600">{status.replace('_', ' ')}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Link
                  to="/admin/bookings"
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  View All Bookings →
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* Top Cities */}
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Cities</h3>
              <div className="space-y-3">
                {topCities.slice(0, 5).map((city, index) => (
                  <div key={city.city} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{city.city}</span>
                    </div>
                    <span className="text-gray-500 text-sm">{city.count} chargers</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Link
                  to="/admin/analytics?tab=geographic"
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  View Geographic Data →
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* Platform Health */}
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Health</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Avg. Driver Rating</span>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-gray-900">{ratings.avgDriverRating || 'N/A'}</span>
                    {ratings.avgDriverRating && <span className="text-yellow-500">⭐</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Avg. Host Rating</span>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-gray-900">{ratings.avgHostRating || 'N/A'}</span>
                    {ratings.avgHostRating && <span className="text-yellow-500">⭐</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Pending Disputes</span>
                  <span className={`font-semibold ${disputeStats.pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {disputeStats.pending}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Active Chargers</span>
                  <span className="font-semibold text-gray-900">
                    {chargerStats.active} / {chargerStats.total}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <QuickLink to="/admin/users" icon={Users} label="Manage Users" />
            <QuickLink to="/admin/chargers" icon={Zap} label="Manage Chargers" />
            <QuickLink to="/admin/payments" icon={DollarSign} label="View Payments" />
            <QuickLink to="/admin/disputes" icon={Shield} label="Review Disputes" />
            <QuickLink to="/admin/analytics" icon={BarChart3} label="Analytics" />
            <QuickLink to="/admin/ratings" icon={Activity} label="Ratings & Reviews" />
            <QuickLink to="/admin/audit-logs" icon={Clock} label="Audit Logs" />
            <QuickLink to="/admin/settings" icon={Shield} label="Settings" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon: Icon, change, changeLabel, subtitle, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {changeLabel && <p className="text-xs text-gray-400 mt-1">{changeLabel}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

// Role Bar Component
function RoleBar({ label, count, total, color }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{count}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Quick Link Component
function QuickLink({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all"
    >
      <Icon className="w-5 h-5 text-gray-600" />
      <span className="text-gray-700 font-medium">{label}</span>
    </Link>
  );
}
