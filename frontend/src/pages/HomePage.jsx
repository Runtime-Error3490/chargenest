import { Link, Navigate } from 'react-router-dom';
import { 
  Zap, MapPin, Shield, CreditCard, MessageSquare, 
  Users, TrendingUp, ArrowRight, CheckCircle 
} from 'lucide-react';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';

export default function HomePage() {
  const { isAuthenticated, hasRole } = useAuthStore();

  // Redirect logged-in users to appropriate dashboard
  if (isAuthenticated) {
    if (hasRole('admin')) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (hasRole('host') && !hasRole('driver')) {
      return <Navigate to="/host/dashboard" replace />;
    }
    // Default: client or client+host goes to main dashboard
    return <Navigate to="/dashboard" replace />;
  }
  const features = [
    {
      icon: MapPin,
      title: 'Find Nearby Chargers',
      description: 'Discover available home chargers in your area with our interactive map.',
    },
    {
      icon: MessageSquare,
      title: 'AI-Powered Booking',
      description: 'Just tell our AI concierge your needs and it will find the best charger for you.',
    },
    {
      icon: Shield,
      title: 'Secure Payments',
      description: 'PayPal-powered payments with authorization holds protect both parties.',
    },
    {
      icon: CreditCard,
      title: 'Fair Pricing',
      description: 'Time-based packages with transparent pricing. Pay only for what you use.',
    },
  ];

  const howItWorks = [
    { step: 1, title: 'Search', description: 'Find chargers near you or use the AI concierge' },
    { step: 2, title: 'Book', description: 'Select a time package and authorize payment' },
    { step: 3, title: 'Charge', description: 'Arrive, confirm start, and charge your EV' },
    { step: 4, title: 'Pay', description: 'Session ends, payment captured, host gets paid' },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTJ2LTJoMnYyem0wLTR2LTJoLTJ2Mmgyem0tNC00di0ySDMwdjJoMnptNCAyaDJ2LTJoLTJ2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Find & Book EV Chargers Near You
              </h1>
              <p className="mt-6 text-lg md:text-xl text-primary-100">
                Connect with homeowners who have idle charger capacity. 
                Book instantly with AI assistance and pay securely with PayPal.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link to="/search" className="flex-shrink-0">
                  <Button size="lg" className="bg-white text-primary-700 hover:bg-primary-50 w-full sm:w-auto">
                    <MapPin className="w-5 h-5 flex-shrink-0" />
                    Find Chargers
                  </Button>
                </Link>
                <Link to="/chat" className="flex-shrink-0">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 w-full sm:w-auto">
                    <MessageSquare className="w-5 h-5 flex-shrink-0" />
                    Ask AI Concierge
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="relative">
                <div className="absolute inset-0 bg-white/10 rounded-3xl transform rotate-3" />
                <div className="relative bg-white/20 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 bg-white/10 rounded-xl p-4">
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">AI Concierge</p>
                        <p className="text-sm text-primary-200">"Find me a charger near Koramangala, max ₹500"</p>
                      </div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <p className="text-sm text-primary-200 mb-2">Found 3 chargers. Recommended:</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-300" />
                        <span className="font-medium">Priya's Home Charger - ₹260/2hr</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Why Choose EV Charge?
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              We make EV charging accessible, affordable, and convenient for everyone.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6">
                <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-7 h-7 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Get charging in four simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {howItWorks.map((item) => (
              <div key={item.step} className="relative">
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-600">
                    {item.description}
                  </p>
                </div>
                {item.step < 4 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[80%] border-t-2 border-dashed border-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Hosts */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-accent-100 text-accent-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <TrendingUp className="w-4 h-4" />
                For Charger Owners
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Turn Your Idle Charger Into Income
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Have a home charger that sits idle? List it on our marketplace and earn 
                money while helping fellow EV owners charge up.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Set your own prices and availability',
                  'AI-powered pricing suggestions',
                  'Secure payments via PayPal',
                  'Only 7% platform fee',
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-primary-600" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className="inline-block mt-8">
                <Button size="lg">
                  Become a Host
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
            <div className="bg-gray-100 rounded-2xl p-8">
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">This Month's Earnings</p>
                      <p className="text-3xl font-bold text-primary-600 mt-1">₹8,450</p>
                    </div>
                    <div className="text-green-600 text-sm font-medium">+23%</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">Bookings</p>
                    <p className="text-2xl font-bold text-gray-900">24</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-500">Rating</p>
                    <p className="text-2xl font-bold text-gray-900">4.8 ⭐</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Start Charging?
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Join thousands of EV owners who are already using our platform.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="bg-white text-primary-700 hover:bg-primary-50">
                Get Started Free
              </Button>
            </Link>
            <Link to="/search">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Explore Chargers
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
