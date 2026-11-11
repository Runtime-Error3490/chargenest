import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';

const STATUS_CONFIG = {
  pending: { label: 'Pending Payment', variant: 'warning', icon: '⏳' },
  authorized: { label: 'Confirmed', variant: 'success', icon: '✓' },
  confirmed: { label: 'Confirmed', variant: 'success', icon: '✓' },
  in_progress: { label: 'In Progress', variant: 'primary', icon: '⚡' },
  active: { label: 'In Progress', variant: 'primary', icon: '⚡' },
  completed: { label: 'Completed', variant: 'default', icon: '✓' },
  cancelled: { label: 'Cancelled', variant: 'error', icon: '✕' },
  no_show: { label: 'No Show', variant: 'error', icon: '✕' },
  disputed: { label: 'Disputed', variant: 'warning', icon: '⚠' },
};

export default function BookingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/bookings' } });
      return;
    }

    const fetchBookings = async () => {
      try {
        setLoading(true);
        const response = await bookingService.getUserBookings();
        setBookings(response.data || []);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load bookings');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [isAuthenticated, navigate]);

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    if (filter === 'upcoming') return ['pending', 'authorized', 'confirmed'].includes(booking.status);
    if (filter === 'active') return ['active', 'in_progress'].includes(booking.status);
    if (filter === 'past') return ['completed', 'cancelled', 'no_show'].includes(booking.status);
    return true;
  });

  // Sort by date (newest first for past, soonest first for upcoming)
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    if (filter === 'past') {
      return new Date(b.endTime) - new Date(a.endTime);
    }
    return new Date(a.startTime) - new Date(b.startTime);
  });

    const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Bookings</h1>
          <Button onClick={() => navigate('/search')}>
            Find Chargers
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'active', label: 'Active' },
            { id: 'past', label: 'Past' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg mb-6 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        {sortedBookings.length === 0 ? (
          <Card className="text-center py-16 p-6">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No bookings yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {filter === 'all' 
                ? "You haven't made any bookings yet."
                : `No ${filter} bookings found.`}
            </p>
            <Button onClick={() => navigate('/search')}>
              Find a Charger
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedBookings.map(booking => {
              const statusConfig = getStatusConfig(booking.status);
              const isUpcoming = new Date(booking.startTime) > new Date();
              
              return (
                <Card
                  key={booking.id}
                  className="cursor-pointer hover:shadow-md transition-shadow p-6"
                  onClick={() => navigate(`/bookings/${booking.id}`)}
                >
                  <div className="flex gap-5">
                    {/* Charger Image */}
                    <div className="flex-shrink-0 w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                      {booking.charger?.photos?.[0] ? (
                        <img
                          src={booking.charger.photos[0]}
                          alt={booking.charger.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img src="/charger-placeholder.svg" alt="" className="w-full h-full object-cover" />
                      )}
                    </div>

                    {/* Booking Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {booking.charger?.name || 'Charging Session'}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {booking.charger?.address}
                          </p>
                        </div>
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.icon} {statusConfig.label}
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Start</span>
                          <p className="font-medium text-gray-900 dark:text-white">{formatDateTime(booking.startTime)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">End</span>
                          <p className="font-medium text-gray-900 dark:text-white">{formatDateTime(booking.endTime)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                                    ${booking.totalAmount?.toFixed(2)}
                        </span>
                        
                        {/* Quick Actions */}
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          {booking.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/bookings/${booking.id}/confirm`)}
                            >
                              Pay Now
                            </Button>
                          )}
                          {booking.status === 'confirmed' && isUpcoming && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                              View Details
                            </Button>
                          )}
                          {booking.status === 'active' && (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                              View Session
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
