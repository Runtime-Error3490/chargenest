import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chargerService } from '../services/chargerService';
import { bookingService } from '../services/bookingService';
import { userService } from '../services/userService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import WalletBanner from '../components/WalletBanner';
import {
  Zap,
  DollarSign,
  TrendingUp,
  Calendar,
  Star,
  Plus,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Wallet,
  Lightbulb,
  HelpCircle,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Settings
} from 'lucide-react';

export default function HostDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEarnings: 0,
    thisMonthEarnings: 0,
    pendingPayout: 0,
    totalBookings: 0,
    activeChargers: 0,
    averageRating: 0,
  });
  const [myChargers, setMyChargers] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/host/dashboard' } });
      return;
    }

    // Check if user is a host
    if (!user?.roles?.includes('host')) {
      navigate('/host/register');
      return;
    }

    const fetchHostData = async () => {
      try {
        setLoading(true);
        
        // Fetch host stats
        const statsResponse = await userService.getHostStats();
        if (statsResponse.data) {
          setStats({
            totalEarnings: statsResponse.data.totalEarnings || 0,
            thisMonthEarnings: statsResponse.data.thisMonthEarnings || 0,
            pendingPayout: statsResponse.data.pendingPayout || 0,
            totalBookings: statsResponse.data.totalBookings || 0,
            activeChargers: statsResponse.data.activeChargers || 0,
            averageRating: statsResponse.data.averageRating || 0,
          });
        }

        // Fetch host's chargers
        try {
          const chargersResponse = await chargerService.getMyChargers();
          setMyChargers(chargersResponse.data || []);
        } catch (chargerErr) {
          console.error('Failed to load chargers:', chargerErr);
        }

        // Fetch recent bookings for host's chargers
        try {
          const bookingsResponse = await bookingService.getHostBookings();
          setRecentBookings((bookingsResponse.data || []).slice(0, 5));
        } catch (bookingErr) {
          console.error('Failed to load bookings:', bookingErr);
        }

      } catch (err) {
        console.error('Failed to load host dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHostData();
  }, [isAuthenticated, navigate, user]);

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusConfig = (status) => {
    const configs = {
      confirmed: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: '✓' },
      active: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: '⚡' },
      completed: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: '✓' },
      cancelled: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: '✕' },
      pending: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: '⏳' },
    };
    return configs[status] || configs.pending;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 dark:from-emerald-800 dark:via-green-800 dark:to-teal-800">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <WalletBanner />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <LayoutDashboard className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Host Dashboard</h1>
                <p className="text-green-100">
                  Welcome back, {user?.name?.split(' ')[0] || 'Host'}! 👋
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              {user?.roles?.includes('driver') && (
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/dashboard')}
                  className="border-white/30 text-white hover:bg-white/10 bg-white/5"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Driver View
                </Button>
              )}
              <Button 
                onClick={() => navigate('/host/chargers/new')}
                className="bg-white text-green-600 hover:bg-green-50 shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Charger
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Earnings */}
          <Card className="p-5 bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(stats.totalEarnings)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                    {formatCurrency(stats.thisMonthEarnings)} this month
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/25">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          {/* Pending Payout */}
          <Card className="p-5 bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Pending Payout</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(stats.pendingPayout)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Available for withdrawal
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Wallet className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          {/* Total Bookings */}
          <Card className="p-5 bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalBookings}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Across all chargers
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          {/* Active Chargers & Rating */}
          <Card className="p-5 bg-white dark:bg-gray-800 border-0 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Active Chargers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.activeChargers}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'No'} rating
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 pb-8">
          {/* Main Content - Left 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Chargers */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Chargers</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{myChargers.length} total</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/host/chargers')}
                  className="dark:border-gray-600 dark:text-gray-300"
                >
                  Manage All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              <div className="p-5">
                {myChargers.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Zap className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No chargers yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                      Start earning by adding your first EV charger to the marketplace
                    </p>
                    <Button onClick={() => navigate('/host/chargers/new')} className="bg-gradient-to-r from-green-500 to-emerald-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Charger
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myChargers.slice(0, 3).map(charger => (
                      <div
                        key={charger.id}
                        className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group"
                        onClick={() => navigate(`/chargers/${charger.id}`)}
                      >
                        <div className="w-14 h-14 bg-gray-200 dark:bg-gray-600 rounded-xl overflow-hidden flex-shrink-0">
                          {charger.photos?.[0] ? (
                            <img
                              src={charger.photos[0]}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Zap className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                              {charger.name}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              charger.status === 'active' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                            }`}>
                              {charger.status === 'active' ? 'Active' : charger.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5" />
                              {charger.kwTier}
                            </span>
                            <span>•</span>
                            <span>{charger.totalBookings || 0} bookings</span>
                            {charger.avgRating > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                  {charger.avgRating.toFixed(1)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors" />
                      </div>
                    ))}
                    {myChargers.length > 3 && (
                      <button 
                        onClick={() => navigate('/host/chargers')}
                        className="w-full py-3 text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                      >
                        View all {myChargers.length} chargers →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Bookings */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Bookings</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Latest activity</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/host/bookings')}
                  className="dark:border-gray-600 dark:text-gray-300"
                >
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              <div className="p-5">
                {recentBookings.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/30 dark:to-violet-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No bookings yet</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Bookings will appear here once drivers start using your chargers
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentBookings.map(booking => {
                      const statusConfig = getStatusConfig(booking.status);
                      return (
                        <div
                          key={booking.id}
                          className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group"
                          onClick={() => navigate(`/bookings/${booking.id}`)}
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Users className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                                {booking.user?.name || 'Driver'}
                              </h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                                {booking.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                              <span className="truncate">{booking.charger?.name || booking.charger?.title}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {formatDateTime(booking.startTime)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              ${booking.totalAmount?.toFixed(0)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar - Right column */}
          <div className="space-y-6">
            {/* Earnings Card */}
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 border-0 shadow-lg overflow-hidden">
              <div className="p-5 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold">Earnings Overview</h2>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/20">
                    <span className="text-green-100">This Month</span>
                    <span className="font-bold text-xl">{formatCurrency(stats.thisMonthEarnings)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/20">
                    <span className="text-green-100">All Time</span>
                    <span className="font-semibold">{formatCurrency(stats.totalEarnings)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-green-100">Platform Fee</span>
                    <span className="text-green-200">7%</span>
                  </div>
                </div>

                <Button 
                  className="w-full mt-4 bg-white/20 hover:bg-white/30 border-0 text-white backdrop-blur-sm"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  View Payout History
                </Button>
              </div>
            </Card>

            {/* Quick Tips */}
            <Card className="bg-white dark:bg-gray-800 border-0 shadow-lg overflow-hidden">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Host Tips</h2>
                </div>
                <ul className="space-y-3">
                  {[
                    { icon: '📷', text: 'Add clear photos for more bookings' },
                    { icon: '💰', text: 'Competitive pricing attracts drivers' },
                    { icon: '📍', text: 'Accurate location helps discovery' },
                    { icon: '⭐', text: 'Great reviews boost visibility' },
                  ].map((tip, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                      <span className="text-lg">{tip.icon}</span>
                      <span>{tip.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            {/* Support Card */}
            <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 border-0 shadow-lg overflow-hidden">
              <div className="p-5 text-center text-white">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <HelpCircle className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Need Help?</h3>
                <p className="text-blue-100 text-sm mb-4">
                  Our support team is here to help you succeed
                </p>
                <Button 
                  onClick={() => navigate('/chat')}
                  className="bg-white/20 hover:bg-white/30 border-0 text-white backdrop-blur-sm"
                >
                  Contact Support
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
