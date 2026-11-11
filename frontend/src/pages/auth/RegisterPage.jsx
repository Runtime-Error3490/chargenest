import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Zap, User, Mail, Lock, Phone, CheckCircle, Car, Home, Shield, FileText, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button, Input, Card, CardBody } from '../../components/ui';
import { LegalSections, LEGAL_DOCUMENTS } from '../LegalPage';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError, isAuthenticated, hasRole } = useAuthStore();
  
  const [step, setStep] = useState('form'); // 'form' | 'mfa-setup'
  const [mfaData, setMfaData] = useState(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    roles: ['driver'],
    acceptTerms: false,
    acceptPrivacy: false,
  });
  const [formErrors, setFormErrors] = useState({});

  // Redirect if already logged in (after all hooks)
  if (isAuthenticated) {
    if (hasRole('host') && !hasRole('driver')) {
      return <Navigate to="/host/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      if (name === 'driver' || name === 'host') {
        setFormData(prev => ({
          ...prev,
          roles: checked 
            ? [...prev.roles, name] 
            : prev.roles.filter(r => r !== name),
        }));
      } else {
        setFormData(prev => ({ ...prev, [name]: checked }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    setFormErrors(prev => ({ ...prev, [name]: '' }));
    clearError();
  };

  const validate = () => {
    const errors = {};
    if (!formData.name || formData.name.length < 2) errors.name = 'Name must be at least 2 characters';
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Invalid email';
    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(formData.password)) errors.password = 'Password must contain uppercase letter';
    else if (!/[a-z]/.test(formData.password)) errors.password = 'Password must contain lowercase letter';
    else if (!/[0-9]/.test(formData.password)) errors.password = 'Password must contain a number';
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    if (formData.roles.length === 0) errors.roles = 'Select at least one role';
    if (!formData.acceptTerms) errors.acceptTerms = 'You must accept the Terms and Conditions';
    if (!formData.acceptPrivacy) errors.acceptPrivacy = 'You must accept the Privacy Policy';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        roles: formData.roles,
        acceptTerms: formData.acceptTerms,
        acceptPrivacy: formData.acceptPrivacy,
      });
      
      if (result.mfaSetupRequired) {
        setMfaData({
          qrCode: result.mfaQrCode,
          secret: result.mfaSecret,
        });
        setStep('mfa-setup');
      }
    } catch (err) {
      // Error handled in store
    }
  };

  const handleContinueToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50/30 to-accent-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardBody className="p-8">
            {step === 'form' ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
                  Create your account
                </h2>
                <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                  Start charging smarter today
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Full Name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    error={formErrors.name}
                    placeholder="John Doe"
                  />

                  <Input
                    label="Email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    error={formErrors.email}
                    placeholder="you@example.com"
                  />

                  <Input
                    label="Phone (optional)"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                  />

                  <Input
                    label="Password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    error={formErrors.password}
                    placeholder="••••••••"
                  />

                  <Input
                    label="Confirm Password"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={formErrors.confirmPassword}
                    placeholder="••••••••"
                  />

                  {/* Role selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      I want to...
                    </label>
                    <div className="space-y-2">
                      <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.roles.includes('driver') 
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}>
                        <input
                          type="checkbox"
                          name="driver"
                          checked={formData.roles.includes('driver')}
                          onChange={handleChange}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          formData.roles.includes('driver') 
                            ? 'bg-primary-100 dark:bg-primary-800' 
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <Car className={`w-5 h-5 ${
                            formData.roles.includes('driver') 
                              ? 'text-primary-600 dark:text-primary-400' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Find & Book Chargers</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">I'm an EV driver looking to charge</p>
                        </div>
                      </label>
                      <label className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.roles.includes('host') 
                          ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/20' 
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}>
                        <input
                          type="checkbox"
                          name="host"
                          checked={formData.roles.includes('host')}
                          onChange={handleChange}
                          className="w-4 h-4 text-accent-600 rounded"
                        />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          formData.roles.includes('host') 
                            ? 'bg-accent-100 dark:bg-accent-800' 
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          <Home className={`w-5 h-5 ${
                            formData.roles.includes('host') 
                              ? 'text-accent-600 dark:text-accent-400' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">List My Charger</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">I have a charger to share</p>
                        </div>
                      </label>
                    </div>
                    {formErrors.roles && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.roles}</p>
                    )}
                  </div>

                  {/* Terms & Conditions */}
                  <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="acceptTerms"
                          checked={formData.acceptTerms}
                          onChange={handleChange}
                          className="w-4 h-4 text-primary-600 rounded flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          I agree to the{' '}
                          <button
                            type="button"
                            onClick={() => setShowTerms(true)}
                            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium underline"
                          >
                            Terms and Conditions
                          </button>
                          {' '}*
                        </span>
                      </label>
                      {formErrors.acceptTerms && (
                        <p className="text-sm text-red-600 mt-1 ml-7">{formErrors.acceptTerms}</p>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="acceptPrivacy"
                          checked={formData.acceptPrivacy}
                          onChange={handleChange}
                          className="w-4 h-4 text-primary-600 rounded flex-shrink-0"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          I agree to the{' '}
                          <button
                            type="button"
                            onClick={() => setShowPrivacy(true)}
                            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium underline"
                          >
                            Privacy Policy
                          </button>
                          {' '}and consent to data processing for audit and security purposes *
                        </span>
                      </label>
                      {formErrors.acceptPrivacy && (
                        <p className="text-sm text-red-600 mt-1 ml-7">{formErrors.acceptPrivacy}</p>
                      )}
                    </div>
                  </div>

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
                    Create Account
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
                    Sign in
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Set Up Two-Factor Auth
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Scan this QR code with your authenticator app
                  </p>
                </div>

                <div className="space-y-6">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    {mfaData?.qrCode && (
                      <img 
                        src={mfaData.qrCode} 
                        alt="QR Code" 
                        className="w-48 h-48 border rounded-lg"
                      />
                    )}
                  </div>

                  {/* Manual entry */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Or enter this code manually:</p>
                    <code className="block text-center text-lg font-mono bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600 break-all text-gray-900 dark:text-white">
                      {mfaData?.secret}
                    </code>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
                    <p className="font-medium mb-1">Recommended Apps:</p>
                    <ul className="list-disc list-inside">
                      <li>Google Authenticator</li>
                      <li>Authy</li>
                      <li>Microsoft Authenticator</li>
                    </ul>
                  </div>

                  <Button 
                    onClick={handleContinueToLogin}
                    className="w-full"
                  >
                    Continue to Login
                  </Button>
                </div>
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

      {/* Terms & Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/20">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-800 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Terms of Service</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">The rules and guidelines for using ChargeNest</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTerms(false)} 
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
            {/* Modal Body */}
            <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
              <LegalSections doc="terms" />
            </div>
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowTerms(false)} className="flex-1">
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    setFormData(prev => ({ ...prev, acceptTerms: true }));
                    setShowTerms(false);
                  }} 
                  className="flex-1"
                >
                  Accept Terms
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Privacy Policy</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">How we collect, use, and protect your data</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPrivacy(false)} 
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>
            {/* Modal Body */}
            <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
              <LegalSections doc="privacy" />
            </div>
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowPrivacy(false)} className="flex-1">
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    setFormData(prev => ({ ...prev, acceptPrivacy: true }));
                    setShowPrivacy(false);
                  }} 
                  className="flex-1"
                >
                  Accept Policy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
