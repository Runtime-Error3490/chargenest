import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Zap, Calendar, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, MapPin, Activity, Shield, Clock, BarChart3,
  ChevronRight, Star, Settings, FileText
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const { overview, growth, usersByRole, bookingsByStatus, topCities, chargerStats, disputeStats, ratings } = dashboard;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-800 dark:via-purple-800 dark:to-pink-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-indigo-100">Platform overview and analytics</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Users"
            value={overview.totalUsers}
            icon={Users}
            change={growth.users.percentChange}
            changeLabel="vs last month"
            gradient="from-blue-500 to-cyan-500"
            shadowColor="shadow-blue-500/25"
          />
          <StatCard
            title="Total Chargers"
            value={overview.totalChargers}
            icon={Zap}
            subtitle={`${chargerStats.active} active`}
            gradient="from-green-500 to-emerald-500"
            shadowColor="shadow-green-500/25"
          />
          <StatCard
            title="Total Bookings"
            value={overview.totalBookings}
            icon={Calendar}
            change={growth.bookings.percentChange}
            changeLabel="vs last month"
            gradient="from-purple-500 to-violet-500"
            shadowColor="shadow-purple-500/25"
          />
          <StatCard
            title="Platform Earnings"
            value={`$${overview.platformEarnings.toLocaleString()}`}
            icon={DollarSign}
            change={growth.revenue.percentChange}
            changeLabel="vs last month"
            gradient="from-amber-500 to-orange-500"
            shadowColor="shadow-amber-500/25"
          />
        </div>

        {/* Alerts */}
        {disputeStats.pending > 0 && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <span className="text-red-800 dark:text-red-300 font-medium">
                  {disputeStats.pending} disputes require admin review
                </span>
                <p className="text-sm text-red-600 dark:text-red-400">Action needed</p>
              </div>
            </div>
            <Link
              to="/admin/disputes"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              Review Now
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue This Month */}
          <Card className="lg:col-span-2 bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Revenue Overview</h3>
                </div>
                <Link
                  to="/admin/analytics"
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-sm font-medium flex items-center gap-1"
                >
                  View Analytics
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-100 dark:border-green-800">
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">This Month</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                    ${growth.revenue.thisMonth.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Last Month</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    ${growth.revenue.lastMonth.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">
                    ${overview.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Users by Role */}
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Users by Role</h3>
                </div>
              </div>
              <div className="space-y-4">
                <RoleBar label="Clients" count={usersByRole.driver || 0} total={overview.totalUsers} gradient="from-blue-500 to-cyan-500" />
                <RoleBar label="Hosts" count={usersByRole.host || 0} total={overview.totalUsers} gradient="from-green-500 to-emerald-500" />
                <RoleBar label="Admins" count={usersByRole.admin || 0} total={overview.totalUsers} gradient="from-purple-500 to-violet-500" />
              </div>
              <Link
                to="/admin/users"
                className="mt-4 w-full py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                Manage Users
                <ChevronRight className="w-4 h-4" />
              </Link>
            </CardBody>
          </Card>

          {/* Bookings by Status */}
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Bookings by Status</h3>
              </div>
              <div className="space-y-2">
                {Object.entries(bookingsByStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center py-2.5 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="capitalize text-gray-600 dark:text-gray-300 text-sm">{status.replace('_', ' ')}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                  </div>
                ))}
              </div>
              <Link
                to="/admin/bookings"
                className="mt-4 w-full py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                View All Bookings
                <ChevronRight className="w-4 h-4" />
              </Link>
            </CardBody>
          </Card>

          {/* Top Cities */}
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Cities</h3>
              </div>
              <div className="space-y-3">
                {topCities.slice(0, 5).map((city, index) => (
                  <div key={city.city} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                        index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                        index === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-700' :
                        'bg-gray-300 dark:bg-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{city.city}</span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">{city.count} chargers</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Platform Health */}
          <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Platform Health</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    Avg. Charger Rating
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {ratings.avgDriverRating || 'N/A'} {ratings.avgDriverRating && '⭐'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <Star className="w-4 h-4 text-blue-500" />
                    Avg. Driver Rating
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {ratings.avgHostRating || 'N/A'} {ratings.avgHostRating && '⭐'}
                  </span>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg ${
                  disputeStats.pending > 0 
                    ? 'bg-red-50 dark:bg-red-900/20' 
                    : 'bg-green-50 dark:bg-green-900/20'
                }`}>
                  <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${disputeStats.pending > 0 ? 'text-red-500' : 'text-green-500'}`} />
                    Pending Disputes
                  </span>
                  <span className={`font-semibold ${disputeStats.pending > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {disputeStats.pending}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-500" />
                    Active Chargers
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {chargerStats.active} / {chargerStats.total}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Quick Links */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickLink to="/admin/users" icon={Users} label="Manage Users" gradient="from-blue-500 to-cyan-500" />
            <QuickLink to="/admin/chargers" icon={Zap} label="Manage Chargers" gradient="from-green-500 to-emerald-500" />
            <QuickLink to="/admin/payments" icon={DollarSign} label="View Payments" gradient="from-amber-500 to-orange-500" />
            <QuickLink to="/admin/disputes" icon={Shield} label="Review Disputes" gradient="from-red-500 to-rose-500" />
            <QuickLink to="/admin/analytics" icon={BarChart3} label="Analytics" gradient="from-purple-500 to-violet-500" />
            <QuickLink to="/admin/ratings" icon={Star} label="Ratings & Reviews" gradient="from-yellow-500 to-amber-500" />
            <QuickLink to="/admin/audit-logs" icon={FileText} label="Audit Logs" gradient="from-gray-500 to-slate-500" />
            <QuickLink to="/admin/settings" icon={Settings} label="Settings" gradient="from-indigo-500 to-purple-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon: Icon, change, changeLabel, subtitle, gradient, shadowColor }) {
  return (
    <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-shadow">
      <CardBody className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{Math.abs(change)}% {changeLabel}</span>
              </div>
            )}
            {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{subtitle}</p>}
          </div>
          <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg ${shadowColor}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Role Bar Component
function RoleBar({ label, count, total, gradient }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">{count}</span>
      </div>
      <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Quick Link Component
function QuickLink({ to, icon: Icon, label, gradient }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-transparent hover:shadow-lg transition-all"
    >
      <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-gray-700 dark:text-gray-300 font-medium">{label}</span>
    </Link>
  );
}
