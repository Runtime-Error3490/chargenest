import { useEffect, useState, useRef } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { 
  Zap, MapPin, Shield, CreditCard, MessageSquare, 
  Users, TrendingUp, ArrowRight, CheckCircle, Clock,
  Star, Lock, Wallet, Home, Car, Battery, ChevronDown, HelpCircle
} from 'lucide-react';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

export default function HomePage() {
  const { isAuthenticated, hasRole } = useAuthStore();
  const { hash } = useLocation();
  const [showTyping, setShowTyping] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [showResult, setShowResult] = useState(false);
  
  // Real stats from backend
  const [stats, setStats] = useState({
    earlyAdopters: 0,
    hostChargers: 0,
    pilotCity: 'Bengaluru',
    avgRating: '5.0★'
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('driver'); // 'driver' or 'host'
  const [openFaq, setOpenFaq] = useState(null);
  const [visibleSections, setVisibleSections] = useState({});

  // Fetch real stats from backend
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/public/stats');
        if (response.data?.data) {
          setStats(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        // Keep default values on error
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Trigger AI demo card animations (faster timing)
  useEffect(() => {
    const timer1 = setTimeout(() => setShowTyping(true), 200);
    const timer2 = setTimeout(() => setShowResponse(true), 800);
    const timer3 = setTimeout(() => setShowResult(true), 1200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Scroll-triggered animations
  useEffect(() => {
    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setVisibleSections(prev => ({ ...prev, [entry.target.id]: true }));
        }
      });
    };
    
    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    const sections = document.querySelectorAll('[data-animate]');
    sections.forEach(section => observer.observe(section));
    
    return () => observer.disconnect();
  }, []);

  // Scroll to an in-page section (e.g. footer "How It Works" -> /#how-it-works)
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  // Redirect logged-in users to appropriate dashboard
  // BUT if they came with a hash (like /#how-it-works), let them see the page
  if (isAuthenticated && !hash) {
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
      title: 'Chargers in Your Neighbourhood',
      description: 'Find verified home chargers within walking distance. No more hunting for public stations.',
    },
    {
      icon: MessageSquare,
      title: 'AI That Understands You',
            description: '"Find a charger near me under $30" — our AI concierge handles the rest.',
    },
    {
      icon: Lock,
      title: 'Money-Back Guarantee',
      description: 'Payment is held until charging completes. Full refund if anything goes wrong.',
    },
    {
      icon: Clock,
      title: 'Book in 30 Seconds',
      description: 'See real-time availability. No calls, no waiting. Instant confirmation.',
    },
  ];

  const trustSignals = [
    { number: statsLoading ? '...' : `${stats.earlyAdopters}+`, label: 'Early Adopters' },
    { number: statsLoading ? '...' : `${stats.hostChargers}+`, label: 'Host Chargers' },
    { number: stats.pilotCity, label: 'Pilot City' },
    { number: stats.avgRating, label: 'Beta Rating' },
  ];

  const howItWorksDriver = [
    { step: 1, title: 'Search', description: 'Enter your location or let AI find the best match', icon: MapPin },
    { step: 2, title: 'Book & Pay', description: 'Choose a time slot. Money is held securely, not charged yet.', icon: Wallet },
    { step: 3, title: 'Charge', description: 'Arrive, plug in, and both of you confirm the session started.', icon: Battery },
    { step: 4, title: 'Done', description: 'Unplug when ready. You pay only for actual usage.', icon: CheckCircle },
  ];

  const howItWorksHost = [
    { step: 1, title: 'List', description: 'Add your charger details, photos, and set your availability.', icon: Home },
    { step: 2, title: 'Set Rates', description: 'Choose your pricing. We suggest competitive rates for your area.', icon: CreditCard },
    { step: 3, title: 'Accept', description: 'Get booking requests. Approve or let auto-accept handle them.', icon: CheckCircle },
    { step: 4, title: 'Earn', description: 'Money goes to your PayPal after each completed session.', icon: Wallet },
  ];

  const testimonials = [
    {
      name: 'Ananya R.',
      role: 'Beta Tester, Bengaluru',
      text: 'I live in an apartment with no charging. ChargeNest lets me charge at a neighbor\'s house every week. Exactly what I needed!',
      rating: 5,
      avatar: 'AR',
      type: 'driver'
    },
    {
      name: 'Vikram S.',
      role: 'Early Host, HSR Layout',
      text: 'My charger used to sit idle 20 hours a day. Now I\'m part of the beta and already seeing bookings. Excited for the full launch!',
      rating: 5,
      avatar: 'VS',
      type: 'host'
    },
    {
      name: 'Priya M.',
      role: 'EV Owner, Koramangala',
      text: 'The AI concierge is amazing! I just said "find me something cheap nearby" and it found the perfect charger. Booked in literally 30 seconds.',
      rating: 5,
      avatar: 'PM',
      type: 'driver'
    },
    {
      name: 'Rajesh K.',
      role: 'Host, Indiranagar',
            text: 'Made $75 last month just from my home charger. The PayPal payouts are automatic — I don\'t have to do anything!',
      rating: 5,
      avatar: 'RK',
      type: 'host'
    },
  ];

  const faqs = [
    {
      question: 'How long does it take to charge my EV?',
      answer: 'Charging time depends on your vehicle\'s battery size and the charger\'s power output. Most home chargers are 7-22 kW, which means a typical EV takes 2-6 hours for a full charge. You can see estimated charging times when booking.'
    },
    {
      question: 'How does the payment escrow work?',
      answer: 'When you book, your payment is held securely in escrow — not sent to the host yet. The money only releases to the host after charging completes successfully. If anything goes wrong, you get a full refund. This protects both drivers and hosts.'
    },
    {
      question: 'What if the charger doesn\'t work or something goes wrong?',
      answer: 'You\'re protected by our money-back guarantee. Since payment is held in escrow until charging completes, if the charger doesn\'t work or the session fails, you get a full refund automatically. You can also raise a dispute for any issues.'
    },
    {
      question: 'Is my car safe at someone else\'s home?',
      answer: 'All hosts are verified with phone, email, and manual review. You can see their ratings from previous drivers. Most charging happens in driveways or parking spots with good visibility. You can also chat with the host before booking.'
    },
    {
      question: 'How do hosts get paid?',
      answer: 'Hosts receive automatic payouts to their wallet after each completed session. The payment releases only after the driver confirms charging completed successfully. We charge a 7% platform fee, so hosts keep 93% of the booking amount. Hosts can withdraw their wallet balance to PayPal anytime.'
    },
    {
      question: 'What types of chargers are available?',
      answer: 'Most hosts have Type 2 AC chargers (7-22 kW), which are compatible with all modern EVs. You can filter by connector type and power output when searching. Some hosts also have CCS or CHAdeMO for faster charging.'
    },
    {
      question: 'Can I cancel a booking?',
      answer: 'Yes! Free cancellation if you cancel more than 24 hours before your slot. Cancellations closer to the start time have a small fee (25-50%). No-shows are charged the full amount. The remaining amount returns to your wallet instantly.'
    },
    {
      question: 'What is smart metering (coming soon)?',
      answer: 'We\'re building IoT-enabled smart chargers that automatically track your exact energy usage. Instead of paying for a fixed time slot, you\'ll pay only for the actual kWh you consume. The device will automatically complete the session when your car is fully charged.'
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTJ2LTJoMnYyem0wLTR2LTJoLTJ2Mmgyem0tNC00di0ySDMwdjJoMnptNCAyaDJ2LTJoLTJ2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Peer-to-Peer EV Charging — Now in Beta
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Charge Your EV at a <span className="text-accent-300">Neighbour's Home</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-primary-100 leading-relaxed">
                No charger at home? No problem. Book a verified home charger near you in seconds. 
                <span className="font-semibold text-white"> Pay only for what you use.</span>
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link to="/search" className="flex-shrink-0">
                  <Button size="lg" className="bg-white text-primary-700 hover:bg-primary-50 w-full sm:w-auto text-base font-semibold shadow-lg">
                    <MapPin className="w-5 h-5 flex-shrink-0" />
                    Find Chargers Near Me
                  </Button>
                </Link>
                <Link to="/chat" className="flex-shrink-0">
                  <Button size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10 w-full sm:w-auto text-base">
                    <MessageSquare className="w-5 h-5 flex-shrink-0" />
                    Ask AI Concierge
                  </Button>
                </Link>
              </div>
              {/* Trust badges */}
              <div className="mt-10 flex items-center gap-6 text-primary-200 text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  <span>PayPal Protected</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Verified Hosts</span>
                </div>
              </div>
            </div>
            
            <div className="hidden md:block">
              <div className="demo-card-wrapper">
                <div className="relative demo-card animate-float">
                  <div className="absolute inset-0 bg-white/10 rounded-3xl transform -rotate-3" />
                  <div className="relative bg-white/20 backdrop-blur-sm rounded-3xl p-6 lg:p-8 shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-5 pb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-accent-400 to-primary-500 rounded-xl flex items-center justify-center animate-pulse-glow">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg">AI Concierge</p>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-400 rounded-full status-pulse" />
                          <span className="text-sm text-primary-200">Online • Ready to help</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {/* User message */}
                      <div className={`message-bubble flex items-start gap-3 bg-white/15 rounded-2xl p-4 transition-all duration-500 ${showTyping ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-base mb-1">You</p>
                          <p className="text-base text-primary-100 leading-relaxed">
                            "Find me a charger near Koramangala, max $50"
                            {showTyping && !showResponse && <span className="typing-cursor" />}
                          </p>
                        </div>
                      </div>
                      
                      {/* AI Response */}
                      <div className={`message-bubble bg-white/15 rounded-2xl p-4 transition-all duration-500 ${showResponse ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 bg-gradient-to-br from-accent-400 to-primary-500 rounded-lg flex items-center justify-center">
                            <Zap className="w-3 h-3 text-white" />
                          </div>
                          <p className="text-base font-semibold gradient-text-animated">AI Concierge</p>
                        </div>
                        <p className="text-base text-primary-100 mb-4 leading-relaxed">
                          Found <span className="font-semibold text-white">3 chargers</span> within 2km. Here's my top recommendation:
                        </p>
                        
                        {/* Charger Result Card */}
                        <div className={`bg-white/15 rounded-xl p-4 hover:bg-white/20 transition-all duration-300 ${showResult ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-bold text-lg text-white">Priya's Home Charger</p>
                              <p className="text-base text-primary-200 mt-1">HSR Layout • 1.2 km away</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                                            <p className="font-bold text-2xl text-accent-300">$26</p>
                              <p className="text-sm text-primary-300">for 2 hours</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-primary-200">
                            <span className="flex items-center gap-1.5">
                              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> 
                              <span className="font-medium">4.9</span> 
                              <span className="text-primary-300">(45 reviews)</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Zap className="w-4 h-4 text-accent-400" />
                              7.4 kW Type 2
                            </span>
                          </div>
                        </div>
                        
                        <button className={`mt-4 w-full bg-white/20 hover:bg-white/30 py-3 rounded-xl text-base font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${showResult ? 'opacity-100' : 'opacity-0'}`}>
                          Book This Charger
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Stats */}
      <section className="py-8 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {trustSignals.map((stat, index) => (
              <div key={index}>
                <p className="text-3xl md:text-4xl font-bold text-primary-400">{stat.number}</p>
                <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" data-animate className={`py-20 bg-white dark:bg-gray-900 transition-all duration-700 ${visibleSections['features'] ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Why EV Owners Love ChargeNest
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Charging should be as easy as ordering food. We made it happen.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 hover:shadow-lg dark:hover:shadow-black/30 transition-all duration-300 border border-transparent dark:border-gray-700 hover:-translate-y-2">
                <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/50 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gray-50 dark:bg-gray-800 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Simple steps for both EV drivers and charger hosts
            </p>
            
            {/* Toggle Tabs with Sliding Indicator */}
            <div className="mt-8 inline-flex items-center bg-white dark:bg-gray-700 rounded-xl shadow-md tab-slider-container relative">
              {/* Sliding indicator */}
              <div className={`tab-slider-indicator ${activeTab}`} />
              
              <button
                onClick={() => setActiveTab('driver')}
                className={`tab-slider-btn ${activeTab === 'driver' ? 'active' : ''}`}
              >
                <Car className="w-5 h-5" />
                I'm an EV Driver
              </button>
              <button
                onClick={() => setActiveTab('host')}
                className={`tab-slider-btn ${activeTab === 'host' ? 'active' : ''}`}
              >
                <Home className="w-5 h-5" />
                I'm a Host
              </button>
            </div>
          </div>

          {/* Driver Steps */}
          <div className={`transition-all duration-500 ${activeTab === 'driver' ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">From search to charge in under 2 minutes</p>
            <div className="grid md:grid-cols-4 gap-8">
              {howItWorksDriver.map((item) => (
                <div key={item.step} className="relative">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <div className="w-16 h-16 bg-primary-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <item.icon className="w-8 h-8" />
                      </div>
                      {item.step < 4 && (
                        <div className="hidden md:flex absolute top-8 -translate-y-1/2 items-center" style={{ left: 'calc(100% + 22px)', width: 'calc(200% + 30px)' }}>
                          <div className="flex-1 border-t-2 border-dashed border-primary-300 dark:border-white/30"></div>
                          <span className="text-primary-500 dark:text-white/60 text-2xl font-bold animate-bounce-forward leading-none" style={{ marginTop: '-2px' }}>›</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-primary-600 dark:text-primary-400 mb-1">Step {item.step}</div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Host Steps */}
          <div className={`transition-all duration-500 ${activeTab === 'host' ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Start earning from your idle charger in minutes</p>
            <div className="grid md:grid-cols-4 gap-8">
              {howItWorksHost.map((item) => (
                <div key={item.step} className="relative">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <div className="w-16 h-16 bg-accent-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <item.icon className="w-8 h-8" />
                      </div>
                      {item.step < 4 && (
                        <div className="hidden md:flex absolute top-8 -translate-y-1/2 items-center" style={{ left: 'calc(100% + 22px)', width: 'calc(200% + 30px)' }}>
                          <div className="flex-1 border-t-2 border-dashed border-accent-300 dark:border-white/30"></div>
                          <span className="text-accent-500 dark:text-white/60 text-2xl font-bold animate-bounce-forward leading-none" style={{ marginTop: '-2px' }}>›</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-accent-600 dark:text-accent-400 mb-1">Step {item.step}</div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section id="testimonials" data-animate className={`py-20 bg-white dark:bg-gray-900 transition-all duration-700 ${visibleSections['testimonials'] ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Real Stories from Real Users
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              See what our beta community is saying
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((t, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 border border-transparent dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${t.type === 'host' ? 'bg-accent-500' : 'bg-primary-500'}`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.role}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed flex-grow">"{t.text}"</p>
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.type === 'host' ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'}`}>
                    {t.type === 'host' ? '🏠 Host' : '🚗 Driver'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Hosts */}
      <section id="for-hosts" data-animate className={`py-20 bg-gradient-to-br from-accent-50 to-white dark:from-gray-900 dark:to-gray-800 transition-all duration-700 ${visibleSections['for-hosts'] ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Home className="w-4 h-4" />
                For Home Charger Owners
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                                Your Idle Charger Could Earn You $60–180/Month*
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                Your charger sits unused most of the day. Join our beta program, share it with EV owners nearby, and 
                start earning passive income while helping the planet.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  { text: 'You control the schedule — share only when you want', icon: Clock },
                  { text: 'Set your own rates — we suggest competitive prices', icon: CreditCard },
                  { text: 'PayPal payouts — money in your account automatically', icon: Wallet },
                  { text: 'Only 7% platform fee — you keep 93% of earnings', icon: TrendingUp },
                  { text: 'Verified users only — all users complete identity verification', icon: Shield },
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">{item.text}</span>
                  </li>
                ))}
              </ul>
              <Link to="/register" className="inline-block mt-8">
                <Button size="lg" className="text-base font-semibold inline-flex items-center justify-center gap-2">
                  <span>Become a Beta Host</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                *Estimated earnings vary based on location, charger type, availability, and demand. Figures based on projections for active hosts in Bengaluru.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl dark:shadow-2xl dark:shadow-black/20 border border-transparent dark:border-gray-700">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sample Host Dashboard</p>
              </div>
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-primary-100 text-sm">This Month's Earnings</p>
                                            <p className="text-4xl font-bold mt-1">$102</p>
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                      ↑ 23% vs last month
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">24</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Bookings</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">4.9</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Rating</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">98%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completion</p>
                  </div>
                </div>
                <div className="text-center pt-4">
                  <p className="text-xs text-gray-400 dark:text-gray-500">*Sample data for illustration. Actual earnings vary based on usage.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How Payment Works */}
      <section id="payment-security" data-animate className={`py-20 bg-white dark:bg-gray-900 transition-all duration-700 ${visibleSections['payment-security'] ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Lock className="w-4 h-4" />
              Secure Escrow System
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              How Payment Protection Works
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Your money is held securely until charging completes. Both parties are protected.
            </p>
          </div>

          {/* Payment Flow Diagram */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
              {/* Flow Steps */}
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wide">Step 1</span>
                      <span className="text-xs text-gray-400">When you book</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Money is Held Securely</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                      When you book, the payment amount is held in escrow — not sent to the host yet. Your funds are protected by PayPal's secure payment infrastructure.
                    </p>
                  </div>
                  <div className="hidden md:block w-24 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                      <span className="text-yellow-600 dark:text-yellow-400 text-lg">💳</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Held</p>
                  </div>
                </div>

                {/* Arrow 1 */}
                <div className="flex items-center gap-4 py-2">
                  <div className="w-12 flex justify-center">
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-6 bg-gradient-to-b from-primary-400 to-accent-400"></div>
                      <div className="text-accent-500 dark:text-accent-400 text-xl animate-bounce">↓</div>
                    </div>
                  </div>
                  <div className="flex-1 border-t border-dashed border-gray-300 dark:border-gray-600"></div>
                  <div className="hidden md:block w-24"></div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-accent-100 dark:bg-accent-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Battery className="w-6 h-6 text-accent-600 dark:text-accent-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-bold text-accent-600 dark:text-accent-400 uppercase tracking-wide">Step 2</span>
                      <span className="text-xs text-gray-400">During charging</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">You Charge, We Track</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                      Both you and the host confirm the session started. Money stays in escrow throughout the charging session. Our system tracks the session progress.
                    </p>
                  </div>
                  <div className="hidden md:block w-24 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <span className="text-blue-600 dark:text-blue-400 text-lg">⚡</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">In Progress</p>
                  </div>
                </div>

                {/* Arrow 2 */}
                <div className="flex items-center gap-4 py-2">
                  <div className="w-12 flex justify-center">
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-6 bg-gradient-to-b from-accent-400 to-green-400"></div>
                      <div className="text-green-500 dark:text-green-400 text-xl animate-bounce">↓</div>
                    </div>
                  </div>
                  <div className="flex-1 border-t border-dashed border-gray-300 dark:border-gray-600"></div>
                  <div className="hidden md:block w-24"></div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">Step 3</span>
                      <span className="text-xs text-gray-400">After completion</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Payment Released to Host</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                      Only after charging completes successfully, the payment is released to the host (minus 7% platform fee). You pay only for what you used.
                    </p>
                  </div>
                  <div className="hidden md:block w-24 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full">
                      <span className="text-green-600 dark:text-green-400 text-lg">✅</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Released</p>
                  </div>
                </div>
              </div>

              {/* Protection Badges */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-3">
                    <Shield className="w-6 h-6 text-primary-500 mx-auto mb-2" />
                    <p className="text-xs font-medium text-gray-900 dark:text-white">Escrow Protected</p>
                  </div>
                  <div className="p-3">
                    <Lock className="w-6 h-6 text-primary-500 mx-auto mb-2" />
                    <p className="text-xs font-medium text-gray-900 dark:text-white">PayPal Secured</p>
                  </div>
                  <div className="p-3">
                    <CreditCard className="w-6 h-6 text-primary-500 mx-auto mb-2" />
                    <p className="text-xs font-medium text-gray-900 dark:text-white">Money-Back Guarantee</p>
                  </div>
                  <div className="p-3">
                    <Zap className="w-6 h-6 text-primary-500 mx-auto mb-2" />
                    <p className="text-xs font-medium text-gray-900 dark:text-white">Pay Per Use</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Future IoT Note */}
            <div className="mt-6 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 border border-primary-200 dark:border-primary-800">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary-100 dark:bg-primary-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h4 className="font-medium text-primary-900 dark:text-primary-100 text-sm">Coming Soon: Smart Metering</h4>
                  <p className="text-primary-700 dark:text-primary-300 text-sm mt-1">
                    We're building IoT-enabled smart chargers that automatically track your exact energy usage (kWh) and duration. 
                    You'll pay precisely for what you charge — down to the kilowatt-hour. No manual confirmations needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & Trust */}
      <section id="safety" data-animate className={`py-20 bg-gray-900 text-white transition-all duration-700 ${visibleSections['safety'] ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              Built on Trust & Safety
            </h2>
            <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
              We protect both EV owners and hosts with industry-leading security
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Verified Identity',
                description: 'All users verify their phone and email. Hosts are manually reviewed before going live.',
              },
              {
                icon: Lock,
                title: 'Secure Payments',
                description: 'PayPal holds money until charging completes. Disputes are reviewed and resolved fairly.',
              },
              {
                icon: Star,
                title: 'Community Reviews',
                description: 'Transparent ratings from real users. Low-rated users are removed from the platform.',
              },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-8 h-8 text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" data-animate className={`py-20 bg-gray-50 dark:bg-gray-800 transition-all duration-700 ${visibleSections['faq'] ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center gap-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <HelpCircle className="w-4 h-4" />
              Got Questions?
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Everything you need to know about ChargeNest
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-md"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{faq.question}</span>
                  <ChevronDown 
                    className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 flex-shrink-0 ${openFaq === index ? 'rotate-180' : ''}`} 
                  />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === index ? 'max-h-96' : 'max-h-0'}`}>
                  <p className="px-6 pb-5 text-gray-600 dark:text-gray-300 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">Still have questions?</p>
            <Link to="/chat">
              <Button variant="outline" className="inline-flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Ask our AI Concierge
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-primary-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to Join Our Beta?
          </h2>
          <p className="mt-4 text-lg text-primary-100 max-w-2xl mx-auto">
            Be among the first to experience hassle-free EV charging. 
            Free to sign up, pay only when you charge.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="bg-white text-primary-700 hover:bg-primary-50 text-base font-semibold shadow-lg">
                Join the Beta — It's Free
              </Button>
            </Link>
            <Link to="/search">
              <Button size="lg" variant="outline" className="border-white/50 text-white hover:bg-white/10 text-base">
                Browse Chargers First
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-primary-200">
            No credit card required • Currently available in Bengaluru
          </p>
        </div>
      </section>
    </>
  );
}
