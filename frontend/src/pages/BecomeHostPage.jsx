import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Zap, DollarSign, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import { Card, CardBody, Button } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function BecomeHostPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // If already a host, redirect
  if (user?.roles?.includes('host') && !success) {
    navigate('/host/dashboard');
    return null;
  }

  const handleBecomeHost = async () => {
    if (!agreed) {
      setError('Please agree to the host terms and conditions');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/users/roles', { role: 'host' });
      
      // Update user roles in auth store
      const updatedRoles = response.data.data.roles;
      setUser({
        ...user,
        roles: updatedRoles,
      });

      setSuccess(true);
    } catch (err) {
      if (err.response?.data?.error?.code === 'USER_ROLE_EXISTS') {
        setError('You are already registered as a host!');
      } else {
        setError(err.response?.data?.error?.message || 'Failed to register as host. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12">
        <div className="max-w-2xl mx-auto px-4">
          <Card className="text-center p-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to the Host Community! 🎉
            </h1>
            <p className="text-gray-600 mb-8">
              You're now registered as a host. Start earning by listing your home charger and sharing it with EV drivers in your area.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={() => navigate('/chargers/new')} size="lg">
                List Your First Charger
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/host/dashboard')} size="lg">
                Go to Host Dashboard
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Hero Section */}
      <div className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Turn Your Home Charger Into Income
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join thousands of hosts earning passive income by sharing their EV chargers with drivers in their neighborhood.
          </p>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card className="p-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Earn Extra Income</h3>
            <p className="text-gray-600">
              Hosts earn an average of ₹5,000-15,000 per month by sharing their charger during idle hours.
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">You're in Control</h3>
            <p className="text-gray-600">
              Set your own prices, availability windows, and choose which drivers can book your charger.
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Protected & Insured</h3>
            <p className="text-gray-600">
              All bookings are protected with our Host Guarantee. Get paid securely via PayPal.
            </p>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: 1, title: 'Register as Host', desc: 'Click the button below to add host privileges to your account' },
              { step: 2, title: 'List Your Charger', desc: 'Add your charger details, photos, pricing, and availability' },
              { step: 3, title: 'Accept Bookings', desc: 'Drivers discover and book your charger through our platform' },
              { step: 4, title: 'Get Paid', desc: 'Receive payments directly to your PayPal after each session' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                  {item.step}
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Registration Form */}
        <Card className="max-w-xl mx-auto">
          <CardBody className="p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Home className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Become a Host</h2>
              <p className="text-gray-600 mt-2">
                Add hosting capabilities to your account
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* User Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Registering as</p>
                <p className="font-medium text-gray-900">{user?.name}</p>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>

              {/* Terms */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Host Agreement</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• You own or have permission to share the charger</li>
                  <li>• You will maintain your charger in safe working condition</li>
                  <li>• You agree to our 7% platform fee on bookings</li>
                  <li>• You will honor confirmed bookings or cancel with notice</li>
                </ul>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-600">
                  I agree to the <a href="/host-policy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Host Policy</a>, <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Privacy Policy</a>
                </span>
              </label>

              {/* Submit */}
              <Button
                onClick={handleBecomeHost}
                isLoading={loading}
                disabled={!agreed}
                className="w-full"
                size="lg"
              >
                Become a Host
              </Button>

              <p className="text-center text-xs text-gray-500">
                You can continue using the app as a driver while also being a host
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
