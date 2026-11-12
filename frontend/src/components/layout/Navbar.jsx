import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  Zap, Menu, X, User, LogOut, MapPin, Calendar, 
  MessageSquare, Settings, Shield, LayoutDashboard,
  Plus, ChevronDown, Sun, Moon, Wallet, HelpCircle, ALargeSmall, AlertTriangle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

// Light/dark switch. index.html applies the saved theme before first paint;
// this keeps <html class="dark"> and localStorage('theme') in sync.
function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const t = setTimeout(() => root.classList.remove('theme-transition'), 250);
    return () => clearTimeout(t);
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark(d => !d)}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 flex items-center justify-center"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

// Accessibility: larger headings and touch targets. Off by default; saved in localStorage('a11y-large').
function TextSizeToggle() {
  const [large, setLarge] = useState(() => document.documentElement.classList.contains('a11y-large'));

  useEffect(() => {
    document.documentElement.classList.toggle('a11y-large', large);
    localStorage.setItem('a11y-large', large ? '1' : '0');
  }, [large]);

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => setLarge(v => !v)}
        aria-label={large ? 'Larger text is on. Switch to normal text size' : 'Larger text is off. Switch to larger text'}
        aria-pressed={large}
        aria-describedby="text-size-tip"
        className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 flex items-center justify-center ${large ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700'}`}
      >
        <ALargeSmall className="w-5 h-5" />
      </button>
      <div
        id="text-size-tip"
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full mt-2 w-56 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs leading-snug px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-[70]"
      >
        <p className="font-semibold mb-0.5">Accessibility: larger text {large ? '(on)' : '(off)'}</p>
        <p className="text-gray-200">Makes all text bigger and buttons easier to tap. Click to turn {large ? 'off' : 'on'}.</p>
      </div>
    </div>
  );
}

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout, hasRole } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setUserMenuOpen(false);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo-icon.svg" alt="ChargeNest" className="w-8 h-8" />
              <span className="text-xl font-bold">
                <span className="text-primary-600">Charge</span>
                <span className="text-gray-900 dark:text-white">Nest</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-6 whitespace-nowrap">
            {/* Role-based navigation */}
            {isAuthenticated && hasRole('admin') ? (
              /* Admin sees admin-specific nav */
              <>
                <Link 
                  to="/admin/dashboard" 
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                    location.pathname.startsWith('/admin') 
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Admin Dashboard
                </Link>
              </>
            ) : isAuthenticated && hasRole('host') && !hasRole('driver') ? (
              /* Host-only users see host-specific nav */
              <>
                <Link 
                  to="/host/dashboard" 
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                    location.pathname.startsWith('/host') 
                      ? 'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Host Dashboard
                </Link>
                <Link 
                  to="/host/chargers" 
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/host/chargers') 
                      ? 'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  My Chargers
                </Link>
                <Link 
                  to="/host/bookings" 
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/host/bookings') 
                      ? 'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Bookings
                </Link>
                <Link 
                  to="/host/chargers/new" 
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/host/chargers/new') 
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add Charger
                </Link>
              </>
            ) : (
              /* Drivers and mixed role users (driver+host) */
              <>
                {/* Find Chargers - for drivers or anyone not logged in */}
                <Link 
                  to="/search" 
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                    isActive('/search') 
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  Find Chargers
                </Link>

                {isAuthenticated && hasRole('driver') && (
                  <Link 
                    to="/chat" 
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                      isActive('/chat') 
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    AI Concierge
                  </Link>
                )}

                {/* Host link for users who are BOTH driver and host */}
                {isAuthenticated && hasRole('host') && hasRole('driver') && (
                  <Link 
                    to="/host/dashboard" 
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                      location.pathname.startsWith('/host') 
                        ? 'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400' 
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Host Dashboard
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <TextSizeToggle />
            <ThemeToggle />
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {user?.name?.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-[60]">
                    {/* Profile Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-primary-50 to-green-50 dark:from-primary-900/20 dark:to-green-900/20 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-800 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {(() => {
                          const roles = user?.roles || [];
                          const isClient = roles.includes('driver');
                          const isHost = roles.includes('host');
                          const isAdmin = roles.includes('admin');
                          
                          if (isAdmin) {
                            return (
                              <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium">
                                👑 Admin
                              </span>
                            );
                          }
                          if (isClient && isHost) {
                            return (
                              <>
                                <span className="text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full font-medium">
                                  🚗 Client
                                </span>
                                <span className="text-xs bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300 px-2 py-0.5 rounded-full font-medium">
                                  🏠 Host
                                </span>
                              </>
                            );
                          }
                          if (isClient) {
                            return (
                              <span className="text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full font-medium">
                                🚗 Client
                              </span>
                            );
                          }
                          if (isHost) {
                            return (
                              <span className="text-xs bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300 px-2 py-0.5 rounded-full font-medium">
                                🏠 Host
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    
                    {/* Menu Items */}
                    <div className="py-2">
                    {hasRole('admin') ? (
                      /* Admin-only menu items */
                      <Link 
                        to="/admin/dashboard" 
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        Admin Dashboard
                      </Link>
                    ) : hasRole('host') && !hasRole('driver') ? (
                      /* Host-only menu items */
                      <>
                        <Link 
                          to="/host/dashboard" 
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          Host Dashboard
                        </Link>

                        <Link 
                          to="/host/chargers" 
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Zap className="w-4 h-4" />
                          My Chargers
                        </Link>

                        <Link 
                          to="/host/bookings" 
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Calendar className="w-4 h-4" />
                          Host Bookings
                        </Link>

                        <Link 
                          to="/host/chargers/new" 
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Plus className="w-4 h-4" />
                          Add Charger
                        </Link>

                        <Link 
                          to="/wallet" 
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Wallet className="w-4 h-4" />
                          Wallet
                        </Link>

                        <Link 
                          to="/disputes" 
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Disputes
                        </Link>
                      </>
                    ) : (
                      /* Driver or mixed role (driver+host) menu items */
                      <>
                        {/* Driver features */}
                        {hasRole('driver') && (
                          <>
                            <Link 
                              to="/dashboard" 
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <LayoutDashboard className="w-4 h-4" />
                              Dashboard
                            </Link>

                            <Link 
                              to="/bookings" 
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <Calendar className="w-4 h-4" />
                              My Bookings
                            </Link>

                            <Link 
                              to="/wallet" 
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <Wallet className="w-4 h-4" />
                              Wallet
                            </Link>

                            <Link 
                              to="/disputes" 
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <AlertTriangle className="w-4 h-4" />
                              Disputes
                            </Link>

                            <Link 
                              to="/settings/agent" 
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <Shield className="w-4 h-4" />
                              Agent Settings
                            </Link>
                          </>
                        )}

                        {/* Host features for mixed role users */}
                        {hasRole('host') && (
                          <>
                            <div className="my-2 mx-4 border-t border-gray-200 dark:border-gray-600"></div>
                            <p className="px-4 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Host Mode</p>
                            <Link 
                              to="/host/dashboard" 
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-accent-700 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/30 transition-colors"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <Settings className="w-4 h-4" />
                              Host Dashboard
                            </Link>
                          </>
                        )}
                      </>
                    )}
                    </div>

                    {/* Logout Section */}
                    <div className="border-t border-gray-200 dark:border-gray-600 px-2 py-2">
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link 
                  to="/login" 
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 inline-flex items-center justify-center"
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 inline-flex items-center justify-center"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 dark:border-gray-700 py-4 px-4 space-y-2 bg-white dark:bg-gray-800">
          {/* Admin mobile menu */}
          {isAuthenticated && hasRole('admin') ? (
            <Link 
              to="/admin/dashboard" 
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-purple-700 hover:bg-purple-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              <LayoutDashboard className="w-5 h-5" />
              Admin Dashboard
            </Link>
          ) : isAuthenticated && hasRole('host') && !hasRole('driver') ? (
            /* Host-only mobile menu */
            <>
              <Link 
                to="/host/dashboard" 
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="w-5 h-5" />
                Host Dashboard
              </Link>
              <Link 
                to="/host/chargers" 
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Zap className="w-5 h-5" />
                My Chargers
              </Link>
              <Link 
                to="/host/bookings" 
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Calendar className="w-5 h-5" />
                Bookings
              </Link>
              <Link 
                to="/host/chargers/new" 
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Plus className="w-5 h-5" />
                Add Charger
              </Link>
            </>
          ) : (
            /* Driver/mixed role mobile menu */
            <>
              <Link 
                to="/search" 
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <MapPin className="w-5 h-5" />
                Find Chargers
              </Link>
              {isAuthenticated && hasRole('driver') && (
                <Link 
                  to="/chat" 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <MessageSquare className="w-5 h-5" />
                  AI Concierge
                </Link>
              )}
              {isAuthenticated && hasRole('host') && (
                <Link 
                  to="/host/dashboard" 
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Settings className="w-5 h-5" />
                  Host Dashboard
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* Click outside to close menus */}
      {(userMenuOpen || mobileMenuOpen) && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => {
            setUserMenuOpen(false);
            setMobileMenuOpen(false);
          }}
        />
      )}
    </nav>
  );
}

export default Navbar;
