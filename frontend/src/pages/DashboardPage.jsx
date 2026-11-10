import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { chargerService } from '../services/chargerService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import WalletBanner from '../components/WalletBanner';

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
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  // Check if user is also a host
  const isHost = user?.roles?.includes('host');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <WalletBanner />

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name?.split(' ')[0] || 'Driver'}! 👋
            </h1>
            <p className="text-gray-600 mt-1">
              Here's what's happening with your EV charging
            </p>
          </div>
          <div className="flex gap-3">
            {isHost && (
              <Button variant="outline" onClick={() => navigate('/host/dashboard')}>
                Host Dashboard
              </Button>
            )}
            <Button onClick={() => navigate('/search')}>
              Find Chargers
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="text-center p-6">
            <div className="text-3xl font-bold text-green-600">{stats.totalBookings}</div>
            <div className="text-sm text-gray-600 mt-2">Total Sessions</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-3xl font-bold text-blue-600">{stats.activeBookings}</div>
            <div className="text-sm text-gray-600 mt-2">Active/Upcoming</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-3xl font-bold text-purple-600">₹{stats.totalSpent.toLocaleString()}</div>
            <div className="text-sm text-gray-600 mt-2">Total Spent</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-3xl font-bold text-emerald-600">{stats.savedCO2} kg</div>
            <div className="text-sm text-gray-600 mt-2">CO₂ Saved 🌱</div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Bookings */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
                <Button variant="outline" size="sm" onClick={() => navigate('/bookings')}>
                  View All
                </Button>
              </div>

              {recentBookings.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔌</div>
                  <p className="text-gray-600">No bookings yet</p>
                  <Button size="sm" className="mt-3" onClick={() => navigate('/search')}>
                    Book Your First Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentBookings.map(booking => (
                    <div
                      key={booking.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate(`/bookings/${booking.id}`)}
                    >
                      <div className="w-12 h-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
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
                        <p className="font-medium text-gray-900 truncate">
                          {booking.charger?.name || 'Charging Session'}
                        </p>
                        <p className="text-sm text-gray-600">
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
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Actions */}
            <Card className="mt-6 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <button
                  onClick={() => navigate('/search')}
                  className="p-6 bg-green-50 rounded-lg text-center hover:bg-green-100 transition-colors"
                >
                  <div className="text-2xl mb-2">🔍</div>
                  <span className="text-sm font-medium text-green-800">Find Chargers</span>
                </button>
                <button
                  onClick={() => navigate('/bookings')}
                  className="p-6 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors"
                >
                  <div className="text-2xl mb-2">📅</div>
                  <span className="text-sm font-medium text-blue-800">My Bookings</span>
                </button>
                <button
                  onClick={() => navigate('/chat')}
                  className="p-6 bg-purple-50 rounded-lg text-center hover:bg-purple-100 transition-colors"
                >
                  <div className="text-2xl mb-2">🤖</div>
                  <span className="text-sm font-medium text-purple-800">AI Concierge</span>
                </button>
                <button
                  onClick={() => navigate('/settings/agent')}
                  className="p-6 bg-orange-50 rounded-lg text-center hover:bg-orange-100 transition-colors"
                >
                  <div className="text-2xl mb-2">⚙️</div>
                  <span className="text-sm font-medium text-orange-800">Agent Settings</span>
                </button>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Nearby Chargers */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Nearby Chargers</h2>
                <Button variant="outline" size="sm" onClick={() => navigate('/search')}>
                  View Map
                </Button>
              </div>

              {nearbyChargers.length === 0 ? (
                <p className="text-gray-600 text-center py-4">No chargers nearby</p>
              ) : (
                <div className="space-y-4">
                  {nearbyChargers.map(charger => (
                    <div
                      key={charger.id}
                      className="p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate(`/chargers/${charger.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 truncate">
                          {charger.name}
                        </span>
                        <Badge size="sm">{charger.connectorType}</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-gray-600">
                          {charger.kwTier?.replace('kW', '')} kW
                        </span>
                        <span className="text-sm font-medium text-green-600">
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
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-6">
                <div className="text-center">
                  <div className="text-4xl mb-3">🏠</div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    Have a home charger?
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Earn money by sharing your charger when you're not using it.
                  </p>
                  <Button onClick={() => navigate('/host/register')}>
                    Become a Host
                  </Button>
                </div>
              </Card>
            )}

            {/* Tips */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">💡 Charging Tips</h2>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span>⚡</span>
                  <span>Book during off-peak hours for better availability</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>💰</span>
                  <span>Longer packages offer better discounts (up to 15% off)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>📍</span>
                  <span>Check amenities like WiFi and cafes for longer sessions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>🤖</span>
                  <span>Use the AI concierge for personalized recommendations</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
