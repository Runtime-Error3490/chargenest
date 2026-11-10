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
          console.log('Chargers response:', chargersResponse);
          setMyChargers(chargersResponse.data || []);
        } catch (chargerErr) {
          console.error('Failed to load chargers:', chargerErr);
        }

        // Fetch recent bookings for host's chargers
        try {
          const bookingsResponse = await bookingService.getHostBookings();
          setRecentBookings((bookingsResponse.data || []).slice(0, 10));
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
    return new Date(dateString).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Host Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Manage your chargers and track your earnings
            </p>
          </div>
          <div className="flex gap-3">
            {/* Only show Driver View if user has driver role */}
            {user?.roles?.includes('driver') && (
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Driver View
              </Button>
            )}
            <Button onClick={() => navigate('/host/chargers/new')}>
              + Add Charger
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="text-center p-6">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalEarnings)}
            </div>
            <div className="text-sm text-gray-600 mt-2">Total Earnings</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.pendingPayout)}
            </div>
            <div className="text-sm text-gray-600 mt-2">Pending Payout</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-2xl font-bold text-purple-600">{stats.totalBookings}</div>
            <div className="text-sm text-gray-600 mt-2">Total Bookings</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-2xl font-bold text-orange-600">{stats.activeChargers}</div>
            <div className="text-sm text-gray-600 mt-2">Active Chargers</div>
          </Card>
          <Card className="text-center p-6">
            <div className="text-2xl font-bold text-yellow-600">
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
              <span className="text-lg ml-1">⭐</span>
            </div>
            <div className="text-sm text-gray-600 mt-2">Avg Rating</div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Chargers */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">My Chargers</h2>
                <Button variant="outline" size="sm" onClick={() => navigate('/host/chargers')}>
                  Manage All
                </Button>
              </div>

              {myChargers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">🔌</div>
                  <p className="text-gray-600 mb-4">You haven't added any chargers yet</p>
                  <Button onClick={() => navigate('/host/chargers/new')}>
                    Add Your First Charger
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myChargers.map(charger => (
                    <div
                      key={charger.id}
                      className="flex items-center gap-4 p-5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => navigate(`/chargers/${charger.id}`)}
                    >
                      <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {charger.photos?.[0] ? (
                          <img
                            src={charger.photos[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            ⚡
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate">
                            {charger.name}
                          </h3>
                          <Badge
                            variant={charger.status === 'active' ? 'success' : 'error'}
                            size="sm"
                          >
                            {charger.status === 'active' ? 'Active' : charger.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{charger.address}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm">
                          <span>{charger.connectorType}</span>
                          <span>{charger.kwTier}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {charger.avgRating > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{charger.avgRating.toFixed(1)}</span>
                            <span className="text-yellow-500">⭐</span>
                          </div>
                        )}
                        <p className="text-sm text-gray-600">
                          {charger.totalBookings || 0} bookings
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Bookings */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
                <Button variant="outline" size="sm" onClick={() => navigate('/host/bookings')}>
                  View All
                </Button>
              </div>

              {recentBookings.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No bookings yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b">
                        <th className="pb-3 font-medium">Driver</th>
                        <th className="pb-3 font-medium">Charger</th>
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Amount</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {recentBookings.map(booking => (
                        <tr
                          key={booking.id}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => navigate(`/bookings/${booking.id}`)}
                        >
                          <td className="py-3">
                            <span className="font-medium">
                              {booking.user?.name || 'Driver'}
                            </span>
                          </td>
                          <td className="py-3 text-gray-600">
                            {booking.charger?.name || booking.charger?.title}
                          </td>
                          <td className="py-3 text-gray-600">
                            {formatDateTime(booking.startTime)}
                          </td>
                          <td className="py-3 font-medium">
                            ₹{booking.totalAmount?.toFixed(0)}
                          </td>
                          <td className="py-3">
                            <Badge
                              variant={
                                booking.status === 'confirmed' ? 'success' :
                                booking.status === 'active' ? 'primary' :
                                booking.status === 'completed' ? 'default' :
                                booking.status === 'cancelled' ? 'error' : 'warning'
                              }
                              size="sm"
                            >
                              {booking.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Earnings Summary */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Earnings Summary</h2>
              <div className="space-y-4">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">This Month</span>
                  <span className="font-medium text-green-600">{formatCurrency(stats.thisMonthEarnings)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">All Time</span>
                  <span className="font-medium">{formatCurrency(stats.totalEarnings)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Pending Payout</span>
                  <span className="font-medium text-blue-600">{formatCurrency(stats.pendingPayout)}</span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-600">Platform Fee</span>
                    <span className="text-sm text-gray-500">7%</span>
                  </div>
                </div>
              </div>
              <Button className="w-full mt-4" variant="outline">
                View Payout History
              </Button>
            </Card>

            {/* Quick Tips */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Host Tips 💡</h2>
              <ul className="space-y-4 text-sm text-gray-600">
                <li className="flex items-start gap-3">
                  <span>📷</span>
                  <span>Add clear photos to get more bookings</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>💰</span>
                  <span>Competitive pricing attracts more drivers</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>📍</span>
                  <span>Accurate location helps drivers find you</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>⏰</span>
                  <span>Update availability regularly</span>
                </li>
                <li className="flex items-start gap-3">
                  <span>⭐</span>
                  <span>Great reviews boost visibility</span>
                </li>
              </ul>
            </Card>

            {/* Support */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 p-6">
              <div className="text-center">
                <div className="text-3xl mb-2">🤝</div>
                <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Our support team is here to help you succeed
                </p>
                <Button variant="outline" onClick={() => navigate('/chat')}>
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
