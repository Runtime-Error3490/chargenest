import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';

export default function BookingConfirmPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [searchParams] = useSearchParams();
  const authorizing = useRef(false);
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/bookings/${id}/confirm` } });
    }
  }, [isAuthenticated, navigate, id]);

  // Fetch booking details
  useEffect(() => {
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

    if (id) {
      fetchBooking();
    }
  }, [id]);

  // PayPal sends the buyer back here after approval (?token=<order id>). Finish the authorization.
  useEffect(() => {
    if (!booking || booking.status !== 'pending' || !searchParams.get('token')) return;
    if (authorizing.current) return;
    authorizing.current = true;

    const authorize = async () => {
      try {
        setPaymentLoading(true);
        setPaymentError(null);
        await bookingService.authorizeBooking(id);
        navigate(`/bookings/${id}`, { state: { paymentSuccess: true } });
      } catch (err) {
        setPaymentError(err.message || 'Payment failed');
        authorizing.current = false;
      } finally {
        setPaymentLoading(false);
      }
    };
    authorize();
  }, [booking, id, navigate, searchParams]);

    const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const calculateDuration = () => {
    if (!booking) return 0;
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    return Math.round((end - start) / (1000 * 60 * 60)); // hours
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking not found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => navigate('/search')}>Find Chargers</Button>
        </div>
      </div>
    );
  }

  // If already paid or confirmed
  if (booking.status !== 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="text-center py-12">
            <div className="text-6xl mb-4">
              {['confirmed', 'authorized'].includes(booking.status) ? '✅' : '⏳'}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {['confirmed', 'authorized'].includes(booking.status) ? 'Booking Confirmed!' : 'Booking Status'}
            </h2>
            <p className="text-gray-600 mb-6">
              {['confirmed', 'authorized'].includes(booking.status) 
                ? 'Your charging session has been booked successfully.'
                : `Your booking is ${booking.status}.`
              }
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => navigate(`/bookings/${id}`)}>
                View Booking
              </Button>
              <Button variant="outline" onClick={() => navigate('/bookings')}>
                All Bookings
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Confirm Your Booking</h1>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Booking Details */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Details</h2>
            
            {booking.charger && (
              <div className="flex gap-4 mb-6 pb-6 border-b">
                <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {booking.charger.images?.[0] ? (
                    <img
                      src={booking.charger.images[0]}
                      alt={booking.charger.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      ⚡
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{booking.charger.title}</h3>
                  <p className="text-sm text-gray-600">{booking.charger.address}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge size="sm">{booking.charger.connectorType}</Badge>
                    <span className="text-sm text-gray-600">{booking.charger.powerKw} kW</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Start Time</span>
                <span className="font-medium">{formatDateTime(booking.startTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">End Time</span>
                <span className="font-medium">{formatDateTime(booking.endTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration</span>
                <span className="font-medium">{calculateDuration()} hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Booking ID</span>
                <span className="font-mono text-sm">{booking.id.slice(0, 8)}</span>
              </div>
            </div>

            {/* Cancellation Policy */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Cancellation Policy</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Free cancellation 24+ hours before</li>
                <li>• 25% fee 12-24 hours before</li>
                <li>• 50% fee 6-12 hours before</li>
                <li>• 100% fee less than 6 hours before</li>
              </ul>
            </div>
          </Card>

          {/* Payment Section */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment</h2>
            
            {/* Price Breakdown */}
            <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm">
                <span className="text-gray-600">Charging fee</span>
                <span>${(booking.totalAmount * 0.93).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Platform fee (7%)</span>
                <span>${(booking.totalAmount * 0.07).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg pt-3 border-t">
                <span>Total</span>
                <span>${booking.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {paymentLoading && (
              <div className="flex justify-center py-4 mb-4">
                <Loading />
              </div>
            )}

            {paymentError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
                {paymentError}
              </div>
            )}

            {/* Secure Payment Note */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Payments are handled by PayPal (sandbox)</span>
            </div>

            {/* Alternative: Cancel */}
            <div className="mt-6 pt-6 border-t text-center">
              <button
                onClick={() => navigate(-1)}
                className="text-gray-600 hover:text-gray-900 text-sm"
              >
                Cancel and go back
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
