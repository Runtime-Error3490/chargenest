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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <img src="/logo-icon.svg" alt="ChargeNest" className="w-10 h-10" />
            <span className="text-2xl font-bold">
              <span className="text-primary-600">Charge</span>
              <span className="text-gray-900">Nest</span>
            </span>
          </Link>
        </div>

        <Card>
          <CardBody>
            {step === 'credentials' ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
                  Welcome back
                </h2>
                
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
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
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

                <div className="mt-6 text-center text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                    Sign up
                  </Link>
                </div>

                {/* Demo accounts */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">Demo Accounts (Password: Demo123!)</p>
                  <div className="space-y-1 text-xs">
                    <p><span className="font-medium">Client:</span> client@demo.com</p>
                    <p><span className="font-medium">Host:</span> host@demo.com</p>
                    <p><span className="font-medium">Client+Host:</span> clienthost@demo.com</p>
                    <p><span className="font-medium">Admin:</span> admin@evcharge.com</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-8 h-8 text-primary-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Two-Factor Authentication
                  </h2>
                  <p className="text-gray-600 mt-2">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <form onSubmit={handleMfaSubmit} className="space-y-4">
                  <Input
                    label="Verification Code"
                    type="text"
                    name="totpCode"
                    value={formData.totpCode}
                    onChange={handleChange}
                    error={formErrors.totpCode}
                    placeholder="000000"
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                    autoComplete="one-time-code"
                  />

                  {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full"
                    isLoading={isLoading}
                  >
                    Verify
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('credentials');
                      setTempToken('');
                      clearError();
                    }}
                    className="w-full text-sm text-gray-600 hover:text-gray-900"
                  >
                    ← Back to login
                  </button>
                </form>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
