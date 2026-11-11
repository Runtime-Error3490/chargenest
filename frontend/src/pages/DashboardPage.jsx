import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { chargerService } from '../services/chargerService';
import { walletService } from '../services/walletService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import WalletBanner from '../components/WalletBanner';
import { HelpCircle, Wallet, ArrowRight, Sparkles, MapPin, MessageSquare, Calendar, ChevronRight, LayoutDashboard, Settings } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    activeBookings: 0,
    totalSpent: 0,
    savedCO2: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [nearbyChargers, setNearbyChargers] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/dashboard' } });
      return;
    }

    // Redirect host-only users to host dashboard
    if (user?.roles?.includes('host') && !user?.roles?.includes('driver')) {
      navigate('/host/dashboard');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch recent bookings (driver's own bookings only)
        const bookingsResponse = await bookingService.getUserBookings();
        const bookings = bookingsResponse.data || [];
        setRecentBookings(bookings.slice(0, 5));

        // Calculate stats from actual bookings
        const completedBookings = bookings.filter(b => b.status === 'completed');
        const activeBookings = bookings.filter(b => ['authorized', 'confirmed', 'in_progress', 'active', 'pending'].includes(b.status));
        const totalSpent = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        
        // Estimate CO2 saved (avg 2.5 kg per completed booking)
        const savedCO2 = Math.round(completedBookings.length * 2.5);

        setStats({
          totalBookings: completedBookings.length,
          activeBookings: activeBookings.length,
          totalSpent,
          savedCO2,
        });

        // Check if new user (no completed bookings)
        setIsNewUser(bookings.length === 0);

        // Fetch wallet balance
        try {
          const walletData = await walletService.getWallet();
          setWalletBalance(walletData.wallet);
        } catch (e) {
          console.error('Failed to fetch wallet:', e);
        }

        // Fetch nearby chargers (default Bengaluru center)
        const chargersResponse = await chargerService.searchChargers({
          latitude: 12.9716,
          longitude: 77.5946,
          radius: 10,
          limit: 4,
        });
        setNearbyChargers(chargersResponse.data || []);

      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAuthenticated, navigate, user]);

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading size="lg" />
      </div>
    );
  }

  // Check if user is also a host
  const isHost = user?.roles?.includes('host');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <WalletBanner />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome back, {user?.name?.split(' ')[0] || 'Driver'}! 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Here's what's happening with your EV charging
            </p>
          </div>
          <Button onClick={() => navigate('/search')}>
            <MapPin className="w-4 h-4 mr-2" />
            Find Chargers
          </Button>
        </div>

        {/* New User Onboarding Card */}
        {isNewUser && (
          <Card className="mb-8 p-0 overflow-hidden bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 border-0">
            <div className="p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2">Welcome to ChargeNest! 🎉</h2>
                  <p className="text-primary-100 mb-4">
                    Let's get you started with your first charging session. Here's what to do:
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-white text-primary-600 rounded-full flex items-center justify-center text-sm font-bold">1</div>
                        <span className="font-medium">Add Wallet Balance</span>
                      </div>
                      <p className="text-sm text-primary-100">Fund your wallet to enable bookings</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-white text-primary-600 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                        <span className="font-medium">Find a Charger</span>
                      </div>
                      <p className="text-sm text-primary-100">Search or ask our AI concierge</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-white text-primary-600 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                        <span className="font-medium">Book & Charge</span>
                      </div>
                      <p className="text-sm text-primary-100">Pick a time and start charging!</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button 
                      variant="secondary" 
                      className="bg-white text-primary-600 hover:bg-primary-50"
                      onClick={() => navigate('/wallet')}
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      Add Money to Wallet
                    </Button>
                    <Link 
                      to="/#how-it-works" 
                      className="inline-flex items-center gap-2 text-white/90 hover:text-white text-sm font-medium"
                    >
                      Learn how it works <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Wallet Balance Card (for returning users) */}
        {!isNewUser && walletBalance && (
          <Card className="mb-8 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Available Balance</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ₹{parseFloat(walletBalance.available || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/wallet')}>
                Manage Wallet
              </Button>
            </div>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="text-center p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/bookings')}>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.totalBookings}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Total Sessions</div>
          </Card>
          <Card className="text-center p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/bookings')}>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.activeBookings}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Active/Upcoming</div>
          </Card>
          <Card className="text-center p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/wallet')}>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">₹{stats.totalSpent.toLocaleString()}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Total Spent</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.savedCO2} kg</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">CO₂ Saved 🌱</div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Bookings */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Bookings</h2>
                <Button variant="outline" size="sm" onClick={() => navigate('/bookings')}>
                  View All
                </Button>
              </div>

              {recentBookings.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No bookings yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-sm mx-auto">
                    Ready to charge your EV? Find a charger near you or let our AI assistant help you.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={() => navigate('/search')}>
                      <MapPin className="w-4 h-4 mr-2" />
                      Find Chargers
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/chat')}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Ask AI Concierge
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentBookings.map(booking => (
                    <div
                      key={booking.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                      onClick={() => navigate(`/bookings/${booking.id}`)}
                    >
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden flex-shrink-0">
                        {booking.charger?.photos?.[0] ? (
                          <img
                            src={booking.charger.photos[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img src="/charger-placeholder.svg" alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {booking.charger?.name || 'Charging Session'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDateTime(booking.startTime)}
                        </p>
                      </div>
                      <Badge variant={
                        booking.status === 'authorized' ? 'success' :
                        booking.status === 'confirmed' ? 'success' :
                        booking.status === 'in_progress' ? 'primary' :
                        booking.status === 'active' ? 'primary' :
                        booking.status === 'completed' ? 'default' :
                        booking.status === 'cancelled' ? 'error' : 'warning'
                      }>
                        {booking.status === 'authorized' ? 'confirmed' : booking.status}
                      </Badge>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Actions - Only show useful secondary actions */}
            <Card className="mt-6 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => navigate('/chat')}
                  className="p-5 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-center hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all hover:scale-105"
                >
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-300">AI Concierge</span>
                </button>
                <button
                  onClick={() => navigate('/bookings')}
                  className="p-5 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-center hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all hover:scale-105"
                >
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">My Bookings</span>
                </button>
                <button
                  onClick={() => navigate('/wallet')}
                  className="p-5 bg-green-50 dark:bg-green-900/30 rounded-xl text-center hover:bg-green-100 dark:hover:bg-green-900/50 transition-all hover:scale-105"
                >
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium text-green-800 dark:text-green-300">Wallet</span>
                </button>
                {isHost ? (
                  <button
                    onClick={() => navigate('/host/dashboard')}
                    className="p-5 bg-accent-50 dark:bg-accent-900/30 rounded-xl text-center hover:bg-accent-100 dark:hover:bg-accent-900/50 transition-all hover:scale-105"
                  >
                    <div className="w-10 h-10 bg-accent-100 dark:bg-accent-800 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <LayoutDashboard className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                    </div>
                    <span className="text-sm font-medium text-accent-800 dark:text-accent-300">Host Dashboard</span>
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/settings/agent')}
                    className="p-5 bg-orange-50 dark:bg-orange-900/30 rounded-xl text-center hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-all hover:scale-105"
                  >
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-800 rounded-lg flex items-center justify-center mx-auto mb-2">
                      <Settings className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-300">Agent Settings</span>
                  </button>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Nearby Chargers */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nearby Chargers</h2>
                <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
                  View Map
                </Button>
              </div>

              {nearbyChargers.length === 0 ? (
                <div className="text-center py-6">
                  <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 dark:text-gray-400">No chargers nearby</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate('/search')}>
                    Expand Search
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {nearbyChargers.map(charger => (
                    <div
                      key={charger.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => navigate(`/chargers/${charger.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {charger.name}
                        </span>
                        <Badge size="sm">{charger.connectorType}</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {charger.kwTier?.replace('kW', '')} kW
                        </span>
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                          ₹{charger.lowestPrice || charger.packages?.[0]?.price || '--'}/session
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Become a Host */}
            {!isHost && (
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border-green-200 dark:border-green-800 p-6">
                <div className="text-center">
                  <div className="text-4xl mb-3">🏠</div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Have a home charger?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Earn money by sharing your charger when you're not using it.
                  </p>
                  <Button onClick={() => navigate('/register')} className="w-full">
                    Become a Host
                  </Button>
                </div>
              </Card>
            )}

            {/* Help & Resources */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Help & Resources</h2>
              </div>
              <ul className="space-y-2">
                <li>
                  <Link 
                    to="/#how-it-works" 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">How It Works</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/#faq" 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">FAQ</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/#payment-security" 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">Payment Security</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={() => navigate('/chat')}
                    className="w-full flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                  >
                    <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">Ask AI for Help</span>
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                  </button>
                </li>
              </ul>
            </Card>

            {/* Tips */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">💡 Pro Tips</h2>
              <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-lg">⚡</span>
                  <span>Book during off-peak hours for better availability</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">💰</span>
                  <span>Longer sessions often have better per-hour rates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-lg">🤖</span>
                  <span>Try "Find me a charger under ₹300" in AI Concierge</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
