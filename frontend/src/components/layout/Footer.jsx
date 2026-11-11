import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function Footer() {
  const { isAuthenticated, hasRole } = useAuthStore();
  const isAdmin = isAuthenticated && hasRole('admin');
  const isClient = isAuthenticated && hasRole('driver');
  const isHost = isAuthenticated && hasRole('host');

  // Determine if user has only one role (client only or host only)
  const isClientOnly = isClient && !isHost;
  const isHostOnly = isHost && !isClient;

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo-icon.svg" alt="ChargeNest" className="w-8 h-8" />
              <span className="text-xl font-bold">
                <span className="text-primary-400">Charge</span>
                <span className="text-white">Nest</span>
              </span>
            </div>
            <p className="text-gray-400 max-w-md">
              The peer-to-peer EV charging marketplace. Connect with homeowners who have idle charger capacity. 
              Find, book, and pay for charging sessions with ease.
            </p>

          </div>

          {/* Links - Different based on auth state and role */}
          {isAdmin ? (
            /* Admin Footer Links */
            <>
              <div>
                <h3 className="text-white font-semibold mb-4">Admin</h3>
                <ul className="space-y-2">
                  <li>
                    <Link to="/admin/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
                  </li>
                  <li>
                    <Link to="/admin/users" className="hover:text-white transition-colors">User Management</Link>
                  </li>
                  <li>
                    <Link to="/admin/payments" className="hover:text-white transition-colors">Payments</Link>
                  </li>
                  <li>
                    <Link to="/admin/disputes" className="hover:text-white transition-colors">Disputes</Link>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Analytics & Settings</h3>
                <ul className="space-y-2">
                  <li>
                    <Link to="/admin/analytics" className="hover:text-white transition-colors">Analytics</Link>
                  </li>
                  <li>
                    <Link to="/admin/audit-logs" className="hover:text-white transition-colors">Audit Logs</Link>
                  </li>
                  <li>
                    <Link to="/admin/settings" className="hover:text-white transition-colors">Settings</Link>
                  </li>
                </ul>
              </div>
            </>
          ) : isAuthenticated ? (
            /* Logged-in User Footer Links (Client/Host/Both) */
            <>
              {/* For client-only users, show Resources in column 3 and For Clients in column 4 */}
              {isClientOnly && (
                <div>
                  <h3 className="text-white font-semibold mb-4">Resources</h3>
                  <ul className="space-y-2">
                    <li>
                      <Link to="/team" className="hover:text-white transition-colors">Our Team</Link>
                    </li>
                    <li>
                      <Link to="/#how-it-works" className="hover:text-white transition-colors">How It Works</Link>
                    </li>
                    <li>
                      <Link to="/#faq" className="hover:text-white transition-colors">FAQ</Link>
                    </li>
                    <li>
                      <Link to="/register" className="hover:text-white transition-colors">Become a Host</Link>
                    </li>
                  </ul>
                </div>
              )}
              
              {/* For host-only users, show For Hosts in column 3 and Resources in column 4 */}
              {isHostOnly && (
                <>
                  <div>
                    <h3 className="text-white font-semibold mb-4">For Hosts</h3>
                    <ul className="space-y-2">
                      <li>
                        <Link to="/host/chargers/new" className="hover:text-white transition-colors">List Your Charger</Link>
                      </li>
                      <li>
                        <Link to="/host/dashboard" className="hover:text-white transition-colors">Host Dashboard</Link>
                      </li>
                      <li>
                        <Link to="/host/bookings" className="hover:text-white transition-colors">Manage Bookings</Link>
                      </li>
                      <li>
                        <Link to="/wallet" className="hover:text-white transition-colors">Wallet & Payouts</Link>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-4">Resources</h3>
                    <ul className="space-y-2">
                      <li>
                        <Link to="/team" className="hover:text-white transition-colors">Our Team</Link>
                      </li>
                      <li>
                        <Link to="/#how-it-works" className="hover:text-white transition-colors">How It Works</Link>
                      </li>
                      <li>
                        <Link to="/#faq" className="hover:text-white transition-colors">FAQ</Link>
                      </li>
                      <li>
                        <Link to="/host-policy" className="hover:text-white transition-colors">Host Policy</Link>
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {/* For client-only users, show For Clients in column 4 (rightmost) */}
              {isClientOnly && (
                <div>
                  <h3 className="text-white font-semibold mb-4">For Clients</h3>
                  <ul className="space-y-2">
                    <li>
                      <Link to="/search" className="hover:text-white transition-colors">Find Chargers</Link>
                    </li>
                    <li>
                      <Link to="/chat" className="hover:text-white transition-colors">AI Concierge</Link>
                    </li>
                    <li>
                      <Link to="/bookings" className="hover:text-white transition-colors">My Bookings</Link>
                    </li>
                    <li>
                      <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
                    </li>
                  </ul>
                </div>
              )}

              {/* For users with both roles, show both columns */}
              {isClient && isHost && (
                <>
                  <div>
                    <h3 className="text-white font-semibold mb-4">For Clients</h3>
                    <ul className="space-y-2">
                      <li>
                        <Link to="/search" className="hover:text-white transition-colors">Find Chargers</Link>
                      </li>
                      <li>
                        <Link to="/chat" className="hover:text-white transition-colors">AI Concierge</Link>
                      </li>
                      <li>
                        <Link to="/bookings" className="hover:text-white transition-colors">My Bookings</Link>
                      </li>
                      <li>
                        <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-4">For Hosts</h3>
                    <ul className="space-y-2">
                      <li>
                        <Link to="/host/chargers/new" className="hover:text-white transition-colors">List Your Charger</Link>
                      </li>
                      <li>
                        <Link to="/host/dashboard" className="hover:text-white transition-colors">Host Dashboard</Link>
                      </li>
                      <li>
                        <Link to="/host/bookings" className="hover:text-white transition-colors">Manage Bookings</Link>
                      </li>
                      <li>
                        <Link to="/wallet" className="hover:text-white transition-colors">Wallet & Payouts</Link>
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Not Logged In - Show general links */
            <>
              <div>
                <h3 className="text-white font-semibold mb-4">Get Started</h3>
                <ul className="space-y-2">
                  <li>
                    <Link to="/search" className="hover:text-white transition-colors">Find Chargers</Link>
                  </li>
                  <li>
                    <Link to="/register" className="hover:text-white transition-colors">Sign Up</Link>
                  </li>
                  <li>
                    <Link to="/login" className="hover:text-white transition-colors">Login</Link>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold mb-4">Learn More</h3>
                <ul className="space-y-2">
                  <li>
                    <Link to="/team" className="hover:text-white transition-colors">Our Team</Link>
                  </li>
                  <li>
                    <Link to="/#how-it-works" className="hover:text-white transition-colors">How It Works</Link>
                  </li>
                  <li>
                    <Link to="/#payment-security" className="hover:text-white transition-colors">Payment Security</Link>
                  </li>
                  <li>
                    <Link to="/#faq" className="hover:text-white transition-colors">FAQ</Link>
                  </li>
                  <li>
                    <Link to="/register" className="hover:text-white transition-colors">Become a Host</Link>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-wrap items-center justify-start gap-x-6 gap-y-2 text-sm text-gray-500">
            <span>© 2026 ChargeNest. Built for PayPal AI Hackathon.</span>
            <span className="flex items-center gap-4">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link to="/host-policy" className="hover:text-white transition-colors">Host Policy</Link>
            </span>
            <span className="flex items-center gap-2 ml-auto">
              <span>Built by:</span>
              <Link to="/team" className="text-gray-300 hover:text-white transition-colors">Nandini A Choukimath & Shaleen Shukla</Link>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
