import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Zap, Mail, Lock, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button, Input, Card, CardBody } from '../../components/ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyMfa, isLoading, error, clearError, isAuthenticated, hasRole } = useAuthStore();
  
  const [step, setStep] = useState('credentials'); // 'credentials' | 'mfa'
  const [tempToken, setTempToken] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    totpCode: '',
  });
  const [formErrors, setFormErrors] = useState({});

  // Redirect if already logged in (after all hooks)
  if (isAuthenticated) {
    if (hasRole('admin')) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (hasRole('host') && !hasRole('driver')) {
      return <Navigate to="/host/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: '' }));
    clearError();
  };

  const validateCredentials = () => {
    const errors = {};
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Invalid email';
    if (!formData.password) errors.password = 'Password is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getRedirectPath = (user) => {
    const roles = user?.roles || [];
    if (roles.includes('admin')) return '/admin/dashboard';
    if (roles.includes('host') && !roles.includes('driver')) return '/host/dashboard';
    return '/dashboard';
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (!validateCredentials()) return;

    try {
      const result = await login(formData.email, formData.password);
      
      if (result.mfaRequired) {
        setTempToken(result.tempToken);
        setStep('mfa');
      } else if (result.success) {
        // Get updated user from store and navigate
        const currentUser = useAuthStore.getState().user;
        navigate(getRedirectPath(currentUser));
      }
    } catch (err) {
      // Error handled in store
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!formData.totpCode || formData.totpCode.length !== 6) {
      setFormErrors({ totpCode: 'Enter 6-digit code' });
      return;
    }

    try {
      await verifyMfa(tempToken, formData.totpCode);
      const currentUser = useAuthStore.getState().user;
      navigate(getRedirectPath(currentUser));
    } catch (err) {
      // Error handled in store
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50/30 to-accent-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardBody className="p-8">
            {step === 'credentials' ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
                  Welcome back
                </h2>
                <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                  Sign in to continue charging
                </p>
                
                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  <Input
                    label="Email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    error={formErrors.email}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />

                  <Input
                    label="Password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    error={formErrors.password}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />

                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-800">
                      {error}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full"
                    isLoading={isLoading}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
                    Sign up
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/30 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Shield className="w-10 h-10 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Two-Factor Authentication
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <form onSubmit={handleMfaSubmit} className="space-y-6">
                  {/* OTP Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      name="totpCode"
                      value={formData.totpCode}
                      onChange={handleChange}
                      placeholder="000000"
                      maxLength={6}
                      autoComplete="one-time-code"
                      className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 px-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all"
                    />
                    {formErrors.totpCode && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2 text-center">{formErrors.totpCode}</p>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm border border-red-200 dark:border-red-800 text-center">
                      {error}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full"
                    isLoading={isLoading}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Verify & Sign In
                  </Button>

                  {/* Help text */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-400 text-center">
                      Open your authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code shown for ChargeNest.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setTempToken('');
                      setFormData(prev => ({ ...prev, totpCode: '' }));
                      clearError();
                    }}
                    className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <span>←</span>
                    <span>Back to login</span>
                  </button>
                </form>
              </>
            )}
          </CardBody>
        </Card>

        {/* Trust badges */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            <span>Secure & Encrypted</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="w-4 h-4" />
            <span>MFA Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
