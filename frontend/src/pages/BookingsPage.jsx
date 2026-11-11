import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Zap, 
  Search, 
  CalendarDays,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Battery,
  DollarSign
} from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Pending Payment', variant: 'warning', icon: Timer, color: 'yellow' },
  authorized: { label: 'Confirmed', variant: 'success', icon: CheckCircle, color: 'green' },
  confirmed: { label: 'Confirmed', variant: 'success', icon: CheckCircle, color: 'green' },
  in_progress: { label: 'In Progress', variant: 'primary', icon: Zap, color: 'blue' },
  active: { label: 'In Progress', variant: 'primary', icon: Zap, color: 'blue' },
  completed: { label: 'Completed', variant: 'default', icon: CheckCircle, color: 'gray' },
  cancelled: { label: 'Cancelled', variant: 'error', icon: XCircle, color: 'red' },
  no_show: { label: 'No Show', variant: 'error', icon: AlertCircle, color: 'red' },
  disputed: { label: 'Disputed', variant: 'warning', icon: AlertCircle, color: 'orange' },
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

  // Get stats
  const stats = {
    all: bookings.length,
    upcoming: bookings.filter(b => ['pending', 'authorized', 'confirmed'].includes(b.status)).length,
    active: bookings.filter(b => ['active', 'in_progress'].includes(b.status)).length,
    past: bookings.filter(b => ['completed', 'cancelled', 'no_show'].includes(b.status)).length,
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const getTimeUntilStart = (startTime) => {
    const now = new Date();
    const start = new Date(startTime);
    const diff = start - now;
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `in ${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
  };

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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <CalendarDays className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Bookings</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-0.5">
                {stats.all} total booking{stats.all !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/search')} className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Find Chargers
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 p-1.5 bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
          {[
            { id: 'all', label: 'All', icon: CalendarDays },
            { id: 'upcoming', label: 'Upcoming', icon: Clock },
            { id: 'active', label: 'Active', icon: Zap },
            { id: 'past', label: 'Past', icon: CheckCircle },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-green-600 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {stats[tab.id] > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    filter === tab.id 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {stats[tab.id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl mb-6 border border-red-200 dark:border-red-800 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {sortedBookings.length === 0 ? (
          <Card className="text-center py-16 dark:bg-gray-800">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <CalendarDays className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No bookings yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {filter === 'all' 
                ? "You haven't made any bookings yet. Find a charger near you to get started!"
                : `No ${filter} bookings found.`}
            </p>
            <Button onClick={() => navigate('/search')} className="inline-flex items-center gap-2">
              <Search className="w-4 h-4" />
              Find a Charger
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedBookings.map(booking => {
              const statusConfig = getStatusConfig(booking.status);
              const StatusIcon = statusConfig.icon;
              const isUpcoming = new Date(booking.startTime) > new Date();
              const timeUntil = getTimeUntilStart(booking.startTime);
              
              return (
                <Card
                  key={booking.id}
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-all dark:bg-gray-800 group"
                  onClick={() => navigate(`/bookings/${booking.id}`)}
                >
                  {/* Status Bar */}
                  <div className={`h-1 ${
                    booking.status === 'pending' ? 'bg-yellow-500' :
                    ['authorized', 'confirmed'].includes(booking.status) ? 'bg-green-500' :
                    ['active', 'in_progress'].includes(booking.status) ? 'bg-blue-500' :
                    booking.status === 'completed' ? 'bg-gray-400' :
                    'bg-red-500'
                  }`}></div>

                  <div className="p-5">
                    <div className="flex gap-5">
                      {/* Charger Image */}
                      <div className="flex-shrink-0 w-28 h-28 bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden">
                        {booking.charger?.photos?.[0] ? (
                          <img
                            src={booking.charger.photos[0]}
                            alt={booking.charger.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Battery className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                          </div>
                        )}
                      </div>

                      {/* Booking Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate text-lg">
                              {booking.charger?.name || 'Charging Session'}
                            </h3>
                            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{booking.charger?.address}</span>
                            </div>
                          </div>
                          <Badge variant={statusConfig.variant} className="flex items-center gap-1 flex-shrink-0">
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </Badge>
                        </div>

                        {/* Date/Time Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(booking.startTime)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {booking.totalAmount?.toFixed(2)}
                            </span>
                          </div>
                          
                          {/* Time Until / Quick Actions */}
                          <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                            {isUpcoming && timeUntil && ['authorized', 'confirmed'].includes(booking.status) && (
                              <span className="text-sm text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">
                                {timeUntil}
                              </span>
                            )}
                            {booking.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => navigate(`/bookings/${booking.id}/confirm`)}
                              >
                                Pay Now
                              </Button>
                            )}
                            {booking.status === 'active' && (
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-blue-500 to-blue-600"
                                onClick={() => navigate(`/bookings/${booking.id}`)}
                              >
                                <Zap className="w-4 h-4 mr-1" />
                                View Session
                              </Button>
                            )}
                            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                          </div>
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
