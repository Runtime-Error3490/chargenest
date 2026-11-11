import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { bookingService } from '../services/bookingService';
import { disputeService } from '../services/disputeService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Zap,
  User,
  Navigation,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  DollarSign,
  CreditCard,
  MessageCircle,
  Flag,
  Star,
  Battery,
  Info,
  Play,
  Square
} from 'lucide-react';

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const chargerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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

// One plain line about where the money is, from the booking's payment and status
function describePayment(booking) {
  const p = booking.payment;
  if (!p?.status) return null;
  const amount = (n) => `$${Number(n).toFixed(2)}`;
  switch (p.status) {
    case 'authorized':
      return { label: `Payment held: ${amount(p.authorizedAmount ?? booking.totalAmount)}`, detail: 'Taken from your wallet and kept safe. It is paid to the host when the session is done.', type: 'warning' };
    case 'captured':
      return { label: `Paid: ${amount(p.capturedAmount ?? booking.totalAmount)}`, detail: 'The session is complete and the host has been paid.', type: 'success' };
    case 'partially_refunded':
      return { label: `Paid ${amount(p.capturedAmount)}, rest refunded`, detail: 'The unused part went back to your wallet.', type: 'success' };
    case 'refunded':
    case 'voided':
      return { label: 'Refunded', detail: 'The held amount went back to your wallet.', type: 'default' };
    case 'failed':
      return { label: 'Payment failed', detail: null, type: 'error' };
    default:
      return { label: 'Waiting for payment', detail: null, type: 'warning' };
  }
}

const DEVICE_SCENARIOS = [
  { value: 'success', label: 'Success: unlock, charge, end' },
  { value: 'short_session', label: 'Too short: ends after 1 minute' },
  { value: 'bad_meter', label: 'Meter fault: zero energy' },
  { value: 'offline', label: 'Station offline: nothing arrives' },
  { value: 'no_unlock', label: 'Never unlocked' },
  { value: 'fake_station', label: 'Fake station: unknown device' },
];

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [scenario, setScenario] = useState('success');
  const [simResult, setSimResult] = useState(null);
  
  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  
  // Form states
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Payment success notification
  const paymentSuccess = location.state?.paymentSuccess;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/bookings/${id}` } });
      return;
    }

    const fetchBooking = async () => {
      try {
        setLoading(true);
        const response = await bookingService.getBookingById(id);
        setBooking(response.data);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [id, isAuthenticated, navigate]);

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = () => {
    if (!booking) return 0;
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    return Math.round((end - start) / (1000 * 60 * 60));
  };

  const getTimeUntilStart = () => {
    if (!booking) return null;
    const now = new Date();
    const start = new Date(booking.startTime);
    const diff = start - now;
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      return `${Math.floor(hours / 24)} days`;
    }
    return `${hours}h ${minutes}m`;
  };

  const getCancellationFee = () => {
    if (!booking) return 0;
    const now = new Date();
    const start = new Date(booking.startTime);
    const hoursUntil = (start - now) / (1000 * 60 * 60);
    
    if (hoursUntil >= 24) return 0;
    if (hoursUntil >= 12) return booking.totalAmount * 0.25;
    if (hoursUntil >= 6) return booking.totalAmount * 0.50;
    return booking.totalAmount;
  };

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await bookingService.cancelBooking(id);
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
      setShowCancelModal(false);
    } catch (err) {
      setError(err.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartSession = async () => {
    try {
      setActionLoading(true);
      await bookingService.startSession(id);
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
    } catch (err) {
      setError(err.message || 'Failed to start session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulate = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setSimResult(await bookingService.simulateDevice(id, scenario));
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndSession = async () => {
    try {
      setActionLoading(true);
      await bookingService.endSession(id);
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
    } catch (err) {
      setError(err.message || 'Failed to end session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason || !disputeDescription) {
      return;
    }
    
    try {
      setActionLoading(true);
      await disputeService.createDispute({
        bookingId: id,
        reason: disputeReason,
        description: disputeDescription,
      });
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
      setShowDisputeModal(false);
      setDisputeReason('');
      setDisputeDescription('');
    } catch (err) {
      setError(err.message || 'Failed to create dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async () => {
    try {
      setActionLoading(true);
      setReviewError(null);
      await bookingService.submitReview(id, {
        rating: reviewRating,
        comment: reviewComment,
      });
      const response = await bookingService.getBookingById(id);
      setBooking(response.data);
      setShowReviewModal(false);
      setReviewComment('');
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loading size="lg" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Booking not found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button onClick={() => navigate('/bookings')}>View All Bookings</Button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const timeUntilStart = getTimeUntilStart();
  const isUpcoming = booking.status === 'confirmed' && timeUntilStart;
  const paymentLine = describePayment(booking);
  const canCancel = ['pending', 'confirmed'].includes(booking.status);
  const canStartSession = booking.status === 'confirmed' && !timeUntilStart;
  const canEndSession = booking.status === 'active';
  const canDispute = ['completed', 'active'].includes(booking.status);
  const canReview = !!booking.canReview;
  const reviewsDriver = booking.reviewTarget === 'driver';
  const reviewLabel = reviewsDriver ? 'Rate the Driver' : 'Rate this Charger';
  const hasAnyReview = booking.reviews?.charger || booking.reviews?.driver;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => navigate('/bookings')}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Bookings
        </button>

        {/* Payment Success Banner */}
        {paymentSuccess && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-300">Payment Successful!</h3>
              <p className="text-sm text-green-700 dark:text-green-400">Your booking has been confirmed.</p>
            </div>
          </div>
        )}

        {/* Header Card */}
        <Card className="mb-6 overflow-hidden dark:bg-gray-800">
          <div className={`h-2 ${
            booking.status === 'pending' ? 'bg-yellow-500' :
            ['authorized', 'confirmed'].includes(booking.status) ? 'bg-green-500' :
            ['active', 'in_progress'].includes(booking.status) ? 'bg-blue-500' :
            booking.status === 'completed' ? 'bg-gray-400' :
            'bg-red-500'
          }`}></div>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </Badge>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    #{booking.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Booking Details</h1>
              </div>
              {isUpcoming && (
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Starts in</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{timeUntilStart}</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Charger Info */}
            {booking.charger && (
              <Card className="overflow-hidden dark:bg-gray-800">
                <div className="p-6">
                  <div className="flex gap-5">
                    <div className="w-28 h-28 bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden flex-shrink-0">
                      {booking.charger.photos?.[0] ? (
                        <img
                          src={booking.charger.photos[0]}
                          alt={booking.charger.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Battery className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">{booking.charger.name}</h3>
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400 text-sm mb-3">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{booking.charger.address}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge>{booking.charger.connectorType}</Badge>
                        <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <Zap className="w-4 h-4" />
                          {booking.charger.kwTier?.replace('kW', '')} kW
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/chargers/${booking.charger.id}`)}
                    >
                      View Charger
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Time Slot */}
            <Card className="dark:bg-gray-800">
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-600" />
                  Booking Schedule
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Start Time</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatDate(booking.startTime)}</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatTime(booking.startTime)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">End Time</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatDate(booking.endTime)}</p>
                    <p className="text-lg font-bold text-gray-600 dark:text-gray-300">{formatTime(booking.endTime)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Duration</span>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white">{calculateDuration()} hour{calculateDuration() !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </Card>

            {/* Location Map */}
            {booking.charger && (
              <Card className="overflow-hidden dark:bg-gray-800">
                <div className="p-6 pb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-green-600" />
                    Location
                  </h3>
                </div>
                <div className="h-48">
                  <MapContainer
                    center={[booking.charger.latitude, booking.charger.longitude]}
                    zoom={15}
                    className="h-full w-full"
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker 
                      position={[booking.charger.latitude, booking.charger.longitude]} 
                      icon={chargerIcon}
                    >
                      <Popup>{booking.charger.name}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${booking.charger.latitude},${booking.charger.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                  >
                    <Navigation className="w-4 h-4" />
                    Get Directions
                  </a>
                </div>
              </Card>
            )}

            {/* Instructions */}
            {booking.charger?.instructions && (
              <Card className="dark:bg-gray-800">
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-green-600" />
                    Charging Instructions
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line">{booking.charger.instructions}</p>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Payment Summary */}
            <Card className="dark:bg-gray-800">
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  Payment Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Charging fee</span>
                    <span className="text-gray-900 dark:text-white">${(booking.totalAmount * 0.93).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Platform fee (7%)</span>
                    <span className="text-gray-900 dark:text-white">${(booking.totalAmount * 0.07).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <DollarSign className="w-5 h-5" />
                      {booking.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              
                {paymentLine && (
                  <div className={`mt-4 rounded-xl px-4 py-3 ${
                    paymentLine.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' :
                    paymentLine.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300' :
                    paymentLine.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`} role="status">
                    <span className="font-medium">{paymentLine.label}</span>
                    {paymentLine.detail && <span className="block text-xs opacity-80 mt-1">{paymentLine.detail}</span>}
                  </div>
                )}

                {booking.status === 'pending' && (
                  <Button
                    className="w-full mt-4"
                    onClick={() => navigate(`/bookings/${id}/confirm`)}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Complete Payment
                  </Button>
                )}
              </div>
            </Card>

            {/* Demo Device Simulator */}
            {booking.deviceMock && booking.status === 'authorized' && (
              <Card className="border-dashed dark:bg-gray-800">
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Simulate charger device</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Demo tool. Plays what the charger hardware will send, then pays or refunds the booking.
                  </p>
                  <select
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    className="w-full mb-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                    aria-label="Device scenario"
                  >
                    {DEVICE_SCENARIOS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <Button className="w-full" variant="outline" onClick={handleSimulate} disabled={actionLoading}>
                    {actionLoading ? <Loading size="sm" /> : 'Run scenario'}
                  </Button>
                </div>
              </Card>
            )}

            {booking.deviceMock && simResult && (
              <Card className="dark:bg-gray-800">
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Device result: {simResult.scenario}</h3>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {simResult.steps.map((step, i) => (
                      <li key={i}>
                        {step.ok ? '✓' : '✗'} {step.type}
                        {step.outcome ? ` → ${step.outcome}${step.reason ? ` (${step.reason})` : ''}` : ''}
                        {!step.ok ? ` → ${step.code}: ${step.message}` : ''}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                    Booking: {simResult.booking?.status}. Session: {simResult.session?.outcome || simResult.session?.status}.
                    Check /wallet for the money moves.
                  </p>
                </div>
              </Card>
            )}

            {/* Actions */}
            <Card className="dark:bg-gray-800">
              <div className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Actions</h3>
                <div className="space-y-3">
                  {canStartSession && (
                    <Button
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                      onClick={handleStartSession}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loading size="sm" /> : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Charging
                        </>
                      )}
                    </Button>
                  )}
                  
                  {canEndSession && (
                    <Button
                      className="w-full"
                      onClick={handleEndSession}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loading size="sm" /> : (
                        <>
                          <Square className="w-4 h-4 mr-2" />
                          End Session
                        </>
                      )}
                    </Button>
                  )}

                  {canReview && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => { setReviewError(null); setShowReviewModal(true); }}
                    >
                      <Star className="w-4 h-4 mr-2" />
                      {reviewLabel}
                    </Button>
                  )}
                  
                  {canCancel && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setShowCancelModal(true)}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Booking
                    </Button>
                  )}
                  
                  {canDispute && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setShowDisputeModal(true)}
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Report Issue
                    </Button>
                  )}

                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => navigate('/chat')}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
                </div>
              </div>
            </Card>

            {/* Reviews */}
            {hasAnyReview && (
              <Card className="dark:bg-gray-800">
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Reviews
                  </h3>
                  <div className="space-y-4">
                    {[
                      ['Driver → Charger', booking.reviews.charger],
                      ['Host → Driver', booking.reviews.driver],
                    ].filter(([, r]) => r).map(([label, r]) => (
                      <div key={label} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                          <span className="text-yellow-500" aria-label={`${r.rating} out of 5 stars`}>
                            {'★'.repeat(r.rating)}<span className="text-gray-300 dark:text-gray-600">{'★'.repeat(5 - r.rating)}</span>
                          </span>
                        </div>
                        {r.reviewText && <p className="text-sm text-gray-700 dark:text-gray-300">{r.reviewText}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Driver (host view) */}
            {booking.driver && (
              <Card className="dark:bg-gray-800">
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-green-600" />
                    Driver
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-lg">
                        {booking.driver.name?.[0] || 'D'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{booking.driver.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {booking.driver.totalReviews > 0
                          ? `★ ${booking.driver.avgRating.toFixed(1)} from ${booking.driver.totalReviews} review${booking.driver.totalReviews === 1 ? '' : 's'}`
                          : 'No reviews yet'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Host Contact */}
            {booking.charger?.host && (
              <Card className="dark:bg-gray-800">
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-green-600" />
                    Host
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-lg">
                        {booking.charger.host.name?.[0] || 'H'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{booking.charger.host.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Charger Host</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Booking"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to cancel this booking?
          </p>
          
          {getCancellationFee() > 0 && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
              <p className="text-yellow-800 dark:text-yellow-300 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Cancellation fee: ${getCancellationFee().toFixed(2)}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                This fee will be deducted from your refund.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCancelModal(false)}
            >
              Keep Booking
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              {actionLoading ? <Loading size="sm" /> : 'Cancel Booking'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Dispute Modal */}
      <Modal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Report an Issue"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Issue Type
            </label>
            <Select
              value={disputeReason}
              onChange={setDisputeReason}
              placeholder="Select an issue..."
              options={[
                { value: 'charger_not_working', label: 'Charger not working' },
                { value: 'wrong_location', label: 'Wrong location' },
                { value: 'access_issue', label: "Couldn't access charger" },
                { value: 'safety_concern', label: 'Safety concern' },
                { value: 'billing_issue', label: 'Billing issue' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={disputeDescription}
              onChange={(e) => setDisputeDescription(e.target.value)}
              rows={4}
              placeholder="Please describe the issue in detail..."
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Our AI will review your case. If confidence is below 95%, a human agent will assist.
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDisputeModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleDispute}
              disabled={actionLoading || !disputeReason || !disputeDescription}
            >
              {actionLoading ? <Loading size="sm" /> : 'Submit Report'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Review Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={reviewLabel}
      >
        <div className="space-y-4">
          {reviewError && (
            <p className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg" role="alert">{reviewError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rating
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className={`text-3xl transition-colors ${
                    star <= reviewRating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Comment (optional)
            </label>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
              placeholder="Share your experience..."
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowReviewModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleReview}
              disabled={actionLoading}
            >
              {actionLoading ? <Loading size="sm" /> : 'Submit Review'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
