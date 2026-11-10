import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { chargerService } from '../services/chargerService';
import { bookingService } from '../services/bookingService';
import { useAuthStore } from '../store/authStore';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Loading from '../components/ui/Loading';
import Modal from '../components/ui/Modal';
import StarRating from '../components/ui/StarRating';
import ImageCarousel from '../components/ui/ImageCarousel';
import 'leaflet/dist/leaflet.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Durations a driver can book. Each is priced from the host's hourly rate.
const DURATION_CHOICES = [30, 60, 120];

// Custom duration limits (same as the server)
const CUSTOM_MIN = 15;
const CUSTOM_MAX = 480;
const CUSTOM_STEP = 15;

const customError = (value) => {
  const min = Number(value);
  if (!value || !Number.isInteger(min)) return 'Enter the time in whole minutes';
  if (min < CUSTOM_MIN || min > CUSTOM_MAX) return `Choose between ${CUSTOM_MIN} and ${CUSTOM_MAX} minutes`;
  if (min % CUSTOM_STEP !== 0) return `Use steps of ${CUSTOM_STEP} minutes`;
  return null;
};

const durationName = (min) => (min % 60 === 0 ? `${min / 60} Hour${min === 60 ? '' : 's'}` : `${min} min`);

// Same rounding as the server (priceForDuration)
const priceFor = (hourlyRate, min) => Math.round(((hourlyRate * min) / 60) * 100) / 100;

const customOption = (hourlyRate, minutes) => {
  const min = Number(minutes);
  return { key: 'custom', name: durationName(min), durationMin: min, price: priceFor(hourlyRate, min) };
};

const rateOptions = (hourlyRate) => DURATION_CHOICES.map((min) => ({
  key: `d${min}`,
  name: durationName(min),
  durationMin: min,
  price: priceFor(hourlyRate, min),
}));

const chargerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map kW tier to numeric value
const kwTierToNumber = {
  'kW3_3': 3.3,
  'kW7_4': 7.4,
  'kW11': 11,
  'kW22': 22,
  'kW50': 50,
  'kW150': 150,
};

export default function ChargerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [charger, setCharger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Booking state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [useCustom, setUseCustom] = useState(false);
  const [customMin, setCustomMin] = useState('90');
  const [customTouched, setCustomTouched] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [needsWallet, setNeedsWallet] = useState(false);

  useEffect(() => {
    const fetchCharger = async () => {
      try {
        setLoading(true);
        const response = await chargerService.getChargerById(id);
        const data = response.data;
        setCharger(data);
        
        // Default to 1 hour at the host's rate (or the first fixed package if there is no rate)
        if (data.hourlyRate) {
          setSelectedPackage(rateOptions(data.hourlyRate).find((o) => o.durationMin === 60));
        } else if (data.packages?.length > 0) {
          setSelectedPackage(data.packages[0]);
        }
        
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load charger details');
      } finally {
        setLoading(false);
      }
    };

    fetchCharger();
  }, [id]);

  // Get display values (handle backend field names)
  const getDisplayValues = () => {
    if (!charger) return null;
    return {
      name: charger.name || charger.title || 'Charger',
      description: charger.description,
      address: charger.address,
      city: charger.city || 'Bengaluru',
      latitude: charger.latitude,
      longitude: charger.longitude,
      connectorType: charger.connectorType,
      powerKw: kwTierToNumber[charger.kwTier] || charger.powerKw || 7.4,
      amenities: Array.isArray(charger.amenities) ? charger.amenities : [],
      photos: charger.photos || charger.images || [],
      rating: charger.avgRating || charger.rating || 0,
      totalBookings: charger.totalBookings || 0,
      host: charger.host,
      hourlyRate: charger.hourlyRate || null,
      // Priced from the host's hourly rate when there is one, otherwise the fixed packages
      packages: charger.hourlyRate ? rateOptions(charger.hourlyRate) : (charger.packages || []),
      availability: charger.availability || [],
      reviews: charger.reviews || [],
      status: charger.status || 'active',
      isOwner: charger.isOwner,
    };
  };

  // Calculate pricing for selected package
  const calculatePrice = () => {
    if (!selectedPackage) return { basePrice: 0, platformFee: 0, total: 0 };
    
    const basePrice = selectedPackage.price;
    const platformFee = basePrice * 0.07; // 7% platform fee
    const total = basePrice + platformFee;
    
    return {
      basePrice: basePrice.toFixed(2),
      platformFee: platformFee.toFixed(2),
      total: total.toFixed(2),
    };
  };

  const handleBooking = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/chargers/${id}` } });
      return;
    }

    if (!selectedDate || !selectedTime || !selectedPackage) {
      setBookingError('Please select a date, time, and package');
      return;
    }

    setBookingLoading(true);
    setBookingError(null);
    setNeedsWallet(false);

    try {
      const startTime = new Date(`${selectedDate}T${selectedTime}`);
      const endTime = new Date(startTime.getTime() + selectedPackage.durationMin * 60 * 1000);
      
      // The amount is held from the user's PayPal-funded wallet, so no extra payment step
      const response = await bookingService.createBooking({
        chargerId: id,
        // Rate-based options have a duration; old fixed packages have an id
        ...(selectedPackage.key
          ? { durationMin: selectedPackage.durationMin }
          : { packageId: selectedPackage.id }),
        scheduledStart: startTime.toISOString(),
        fundingSource: 'wallet',
      });

      navigate(`/bookings/${response.booking.id}`, { state: { paymentSuccess: true } });
    } catch (err) {
      setNeedsWallet(err.apiCode === 'DEPOSIT_REQUIRED' || /wallet/i.test(err.message || ''));
      setBookingError(err.message || 'Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get max date (30 days from now)
  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  if (error || !charger) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Charger not found</h2>
          <p className="text-gray-600 mb-4">{error || 'This charger may have been removed.'}</p>
          <Button onClick={() => navigate('/search')}>Browse Chargers</Button>
        </div>
      </div>
    );
  }

  const display = getDisplayValues();
  const pricing = calculatePrice();
  const isAvailable = display.status === 'active';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Carousel */}
            <Card className="p-0 overflow-hidden">
              <ImageCarousel
                images={display.photos}
                alt={display.name}
                aspectRatio="video"
                showArrows={true}
                showDots={true}
                showThumbnails={display.photos?.length > 1}
                autoPlay={false}
              />
            </Card>

            {/* Details */}
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{display.name}</h1>
                  <p className="text-gray-600 mt-1">{display.address}</p>
                </div>
                <Badge variant="success" size="lg">{display.connectorType}</Badge>
              </div>

              {display.rating > 0 && (
                <div className="flex items-center gap-2 mt-4">
                  <StarRating rating={display.rating} readonly />
                  <span className="text-gray-600">
                    {display.rating.toFixed(1)} ({display.totalBookings} bookings)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
                <div className="text-center p-6 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{display.powerKw} kW</div>
                  <div className="text-sm text-gray-600">Power Output</div>
                </div>
                <div className="text-center p-6 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {display.hourlyRate ? `₹${display.hourlyRate}/hr` : (display.packages?.[0] ? `₹${display.packages[0].price}` : 'N/A')}
                  </div>
                  <div className="text-sm text-gray-600">{display.hourlyRate ? 'Host rate' : 'Starting Price'}</div>
                </div>
                <div className="text-center p-6 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{display.connectorType}</div>
                  <div className="text-sm text-gray-600">Connector</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {isAvailable ? '✓' : '✗'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {isAvailable ? 'Available' : 'Unavailable'}
                  </div>
                </div>
              </div>

              {display.description && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-2">About this charger</h3>
                  <p className="text-gray-600">{display.description}</p>
                </div>
              )}

              {display.amenities?.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {display.amenities.map((amenity, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm capitalize"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Map */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Location</h3>
              <div className="h-64 rounded-lg overflow-hidden">
                <MapContainer
                  center={[display.latitude, display.longitude]}
                  zoom={15}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[display.latitude, display.longitude]} icon={chargerIcon}>
                    <Popup>{display.name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </Card>

            {/* Reviews */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Reviews ({display.reviews?.length || 0})
              </h3>
              {!display.reviews?.length ? (
                <p className="text-gray-600 text-center py-8">No reviews yet</p>
              ) : (
                <div className="space-y-4">
                  {display.reviews.map((review, idx) => (
                    <div key={idx} className="border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-700 font-medium">
                              {review.driver?.name?.[0] || 'U'}
                            </span>
                          </div>
                          <span className="font-medium">{review.driver?.name || 'Anonymous'}</span>
                        </div>
                        <StarRating rating={review.rating} size="sm" readonly />
                      </div>
                      {review.reviewText && (
                        <p className="text-gray-600">{review.reviewText}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Host Info */}
            {display.host && (
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Hosted by</h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl text-green-700 font-medium">
                      {display.host.name?.[0] || 'H'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{display.host.name}</p>
                    {display.host.memberSince && (
                      <p className="text-sm text-gray-600">
                        Member since {new Date(display.host.memberSince).toLocaleDateString('en-IN', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </p>
                    )}
                    {display.host.chargersCount && (
                      <p className="text-sm text-gray-500">
                        {display.host.chargersCount} charger{display.host.chargersCount > 1 ? 's' : ''} listed
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Card className="p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Book This Charger</h3>

                {!isAvailable ? (
                  <div className="text-center py-4">
                    <Badge variant="error">Currently Unavailable</Badge>
                    <p className="text-sm text-gray-600 mt-2">
                      This charger is not accepting bookings right now.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Package Selection */}
                    {display.packages?.length > 0 && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {display.hourlyRate ? `Select Duration (₹${display.hourlyRate} per hour)` : 'Select Package'}
                        </label>
                        <div className="space-y-2">
                          {display.packages.map(pkg => (
                            <button
                              key={pkg.key || pkg.id}
                              onClick={() => { setUseCustom(false); setSelectedPackage(pkg); }}
                              className={`w-full p-3 rounded-lg border-2 text-left transition-colors ${
                                !useCustom && (selectedPackage?.key || selectedPackage?.id) === (pkg.key || pkg.id)
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{pkg.name}</div>
                                  <div className="text-xs text-gray-500">{pkg.durationMin} minutes</div>
                                </div>
                                <div className="text-lg font-bold text-green-600">
                                  ₹{pkg.price}
                                </div>
                              </div>
                            </button>
                          ))}

                          {/* Custom duration, priced at the host's hourly rate */}
                          {display.hourlyRate && (
                            <div
                              className={`w-full p-3 rounded-lg border-2 transition-colors ${
                                useCustom ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <button
                                type="button"
                                className="w-full text-left font-medium"
                                onClick={() => {
                                  setUseCustom(true);
                                  setSelectedPackage(customError(customMin) ? null : customOption(display.hourlyRate, customMin));
                                }}
                              >
                                Custom time
                              </button>
                              {useCustom && (
                                <div className="mt-2">
                                  <label htmlFor="custom-minutes" className="block text-xs text-gray-500 mb-1">
                                    Minutes ({CUSTOM_MIN} to {CUSTOM_MAX}, in steps of {CUSTOM_STEP})
                                  </label>
                                  <input
                                    id="custom-minutes"
                                    type="number"
                                    inputMode="numeric"
                                    min={CUSTOM_MIN}
                                    max={CUSTOM_MAX}
                                    step={CUSTOM_STEP}
                                    value={customMin}
                                    onChange={(e) => {
                                      setCustomMin(e.target.value);
                                      setCustomTouched(true);
                                      setSelectedPackage(customError(e.target.value) ? null : customOption(display.hourlyRate, e.target.value));
                                    }}
                                    onBlur={() => setCustomTouched(true)}
                                    aria-invalid={customTouched && !!customError(customMin)}
                                    aria-describedby="custom-minutes-error"
                                    className={`w-full rounded-lg border px-3 py-2 text-sm ${
                                      customTouched && customError(customMin) ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                  />
                                  {customTouched && customError(customMin) && (
                                    <p id="custom-minutes-error" className="mt-1 text-xs text-red-600">{customError(customMin)}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Price Breakdown */}
                    {selectedPackage && (
                      <div className="border-t pt-4 mb-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{selectedPackage.name}</span>
                          <span>₹{pricing.basePrice}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Platform fee (7%)</span>
                          <span>₹{pricing.platformFee}</span>
                        </div>
                        <div className="flex justify-between font-semibold pt-2 border-t">
                          <span>Total</span>
                          <span>₹{pricing.total}</span>
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => setShowBookingModal(true)}
                      disabled={!selectedPackage}
                    >
                      Book Now
                    </Button>

                    <p className="text-xs text-gray-500 text-center mt-3">
                      Free cancellation up to 24 hours before your booking
                    </p>
                  </>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setBookingError(null);
        }}
        title="Book Charging Session"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              min={getMinDate()}
              max={getMaxDate()}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Booking Summary</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Charger</span>
                <span>{display.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Package</span>
                <span>{selectedPackage?.name} ({selectedPackage?.durationMin} min)</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t mt-2">
                <span>Total</span>
                <span>₹{pricing.total}</span>
              </div>
            </div>
          </div>

          {bookingError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {bookingError}
              {needsWallet && (
                <button onClick={() => navigate('/wallet')} className="ml-2 font-medium underline">
                  Add money
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowBookingModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleBooking}
              disabled={bookingLoading || !selectedDate || !selectedTime}
            >
              {bookingLoading ? <Loading size="sm" /> : 'Continue to Payment'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
