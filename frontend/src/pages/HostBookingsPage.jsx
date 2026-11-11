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
  User, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  CalendarDays,
  ClipboardList,
  Timer,
  CheckCheck,
  Ban,
  Zap,
  ArrowLeft,
  DollarSign,
  Mail,
  CalendarClock
} from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'warning', icon: Timer, color: 'yellow' },
  confirmed: { label: 'Confirmed', variant: 'primary', icon: CheckCircle, color: 'blue' },
  active: { label: 'Active', variant: 'success', icon: Zap, color: 'green' },
  completed: { label: 'Completed', variant: 'default', icon: CheckCheck, color: 'gray' },
  cancelled: { label: 'Cancelled', variant: 'error', icon: Ban, color: 'red' },
};

export default function HostBookingsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/host/bookings' } });
      return;
    }

    if (!user?.roles?.includes('host')) {
      navigate('/host/register');
      return;
    }

    fetchBookings();
  }, [isAuthenticated, navigate, user]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await bookingService.getHostBookings();
      const data = response.data || [];
      setBookings(data);
      
      // Calculate stats
      setStats({
        total: data.length,
        pending: data.filter(b => b.status === 'pending').length,
        confirmed: data.filter(b => b.status === 'confirmed').length,
        active: data.filter(b => b.status === 'active').length,
        completed: data.filter(b => b.status === 'completed').length,
        cancelled: data.filter(b => b.status === 'cancelled').length,
      });
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await bookingService.updateBookingStatus(bookingId, newStatus);
      fetchBookings();
    } catch (err) {
      console.error('Failed to update booking:', err);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    return booking.status === filter;
  });

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  // Stat card configs
  const statCards = [
    { key: 'total', label: 'Total Bookings', icon: ClipboardList, gradient: 'from-gray-500 to-gray-600', darkGradient: 'dark:from-gray-600 dark:to-gray-700' },
    { key: 'pending', label: 'Pending', icon: Timer, gradient: 'from-yellow-500 to-orange-500', darkGradient: 'dark:from-yellow-600 dark:to-orange-600' },
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle, gradient: 'from-blue-500 to-blue-600', darkGradient: 'dark:from-blue-600 dark:to-blue-700' },
    { key: 'active', label: 'Active', icon: Zap, gradient: 'from-green-500 to-emerald-600', darkGradient: 'dark:from-green-600 dark:to-emerald-700' },
    { key: 'completed', label: 'Completed', icon: CheckCheck, gradient: 'from-slate-500 to-slate-600', darkGradient: 'dark:from-slate-600 dark:to-slate-700' },
    { key: 'cancelled', label: 'Cancelled', icon: Ban, gradient: 'from-red-500 to-red-600', darkGradient: 'dark:from-red-600 dark:to-red-700' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <CalendarDays className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Booking Management</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                View and manage bookings for your chargers
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/host/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {statCards.map(({ key, label, icon: Icon, gradient, darkGradient }) => (
            <div
              key={key}
              onClick={() => setFilter(key === 'total' ? 'all' : key)}
              className={`relative overflow-hidden rounded-xl p-4 cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${
                (filter === key || (filter === 'all' && key === 'total'))
                  ? 'ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-900'
                  : ''
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} ${darkGradient} opacity-90`}></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5 text-white/80" />
                  <span className="text-2xl font-bold text-white">{stats[key]}</span>
                </div>
                <p className="text-xs font-medium text-white/80">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 p-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          {['all', 'pending', 'confirmed', 'active', 'completed', 'cancelled'].map(f => {
            const config = f === 'all' ? { icon: ClipboardList, label: 'All' } : { icon: STATUS_CONFIG[f].icon, label: STATUS_CONFIG[f].label };
            const Icon = config.icon;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-green-600 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {config.label}
                {f !== 'all' && stats[f] > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    filter === f 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                  }`}>
                    {stats[f]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <Card className="text-center py-16 dark:bg-gray-800">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <CalendarClock className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {filter === 'all' ? 'No bookings yet' : `No ${filter} bookings`}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              {filter === 'all' 
                ? 'When drivers book your chargers, they will appear here for you to manage.'
                : `You don't have any ${filter} bookings at the moment.`
              }
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map(booking => {
              const statusConfig = getStatusConfig(booking.status);
              const StatusIcon = statusConfig.icon;
              
              return (
                <Card key={booking.id} className="overflow-hidden dark:bg-gray-800 hover:shadow-lg transition-shadow">
                  {/* Status Indicator Bar */}
                  <div className={`h-1 ${
                    booking.status === 'pending' ? 'bg-yellow-500' :
                    booking.status === 'confirmed' ? 'bg-blue-500' :
                    booking.status === 'active' ? 'bg-green-500' :
                    booking.status === 'completed' ? 'bg-gray-400' :
                    'bg-red-500'
                  }`}></div>
                  
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Booking Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </Badge>
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                            #{booking.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>

                        {/* Driver Info */}
                        <div className="flex items-center gap-3 mb-5 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {booking.user?.name || 'Driver'}
                            </p>
                            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                              <Mail className="w-3 h-3" />
                              <span className="truncate">{booking.user?.email || 'No email'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Charger & Time Grid */}
                        <div className="grid sm:grid-cols-2 gap-4">
                          {/* Location */}
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {booking.charger?.title || 'Charger'}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {booking.charger?.address || 'No address'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Schedule */}
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                              <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {formatDateTime(booking.startTime)}
                              </p>
                              <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                                <Clock className="w-3 h-3" />
                                <span>{booking.duration} hour{booking.duration !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Amount & Actions */}
                      <div className="text-right flex flex-col items-end">
                        {/* Earnings Display */}
                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-1 justify-end mb-1">
                            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {(booking.totalAmount || 0).toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Your share: {formatCurrency((booking.totalAmount || 0) * 0.93)}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 w-full">
                          {booking.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleStatusChange(booking.id, 'confirmed')}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Confirm
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                className="w-full"
                                onClick={() => handleStatusChange(booking.id, 'cancelled')}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Decline
                              </Button>
                            </>
                          )}
                          {booking.status === 'confirmed' && (
                            <Button
                              size="sm"
                              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                              onClick={() => handleStatusChange(booking.id, 'active')}
                            >
                              <Zap className="w-4 h-4 mr-1" />
                              Start Session
                            </Button>
                          )}
                          {booking.status === 'active' && (
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleStatusChange(booking.id, 'completed')}
                            >
                              <CheckCheck className="w-4 h-4 mr-1" />
                              Complete
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => navigate(`/bookings/${booking.id}`)}
                          >
                            View Details
                          </Button>
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
