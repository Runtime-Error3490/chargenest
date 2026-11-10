import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Zap, User, Mail, Lock, Phone, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button, Input, Card, CardBody } from '../../components/ui';
import { LegalSections } from '../LegalPage';

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
            {step === 'form' ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 text-center mb-6">
                  Create your account
                </h2>

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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      I want to...
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          name="driver"
                          checked={formData.roles.includes('driver')}
                          onChange={handleChange}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <div>
                          <p className="font-medium text-gray-900">Find & Book Chargers</p>
                          <p className="text-sm text-gray-500">I'm an EV driver looking to charge</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          name="host"
                          checked={formData.roles.includes('host')}
                          onChange={handleChange}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <div>
                          <p className="font-medium text-gray-900">List My Charger</p>
                          <p className="text-sm text-gray-500">I have a charger to share</p>
                        </div>
                      </label>
                    </div>
                    {formErrors.roles && (
                      <p className="text-sm text-red-600 mt-1">{formErrors.roles}</p>
                    )}
                  </div>

                  {/* Terms & Conditions */}
                  <div className="space-y-3 pt-4 border-t">
                    <div>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="acceptTerms"
                          checked={formData.acceptTerms}
                          onChange={handleChange}
                          className="w-4 h-4 text-primary-600 rounded mt-0.5"
                        />
                        <span className="text-sm text-gray-700">
                          I agree to the{' '}
                          <button
                            type="button"
                            onClick={() => setShowTerms(true)}
                            className="text-primary-600 hover:text-primary-700 font-medium underline"
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
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          name="acceptPrivacy"
                          checked={formData.acceptPrivacy}
                          onChange={handleChange}
                          className="w-4 h-4 text-primary-600 rounded mt-0.5"
                        />
                        <span className="text-sm text-gray-700">
                          I agree to the{' '}
                          <button
                            type="button"
                            onClick={() => setShowPrivacy(true)}
                            className="text-primary-600 hover:text-primary-700 font-medium underline"
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
                    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
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

                <div className="mt-6 text-center text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                    Sign in
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Set Up Two-Factor Auth
                  </h2>
                  <p className="text-gray-600 mt-2">
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
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Or enter this code manually:</p>
                    <code className="block text-center text-lg font-mono bg-white p-2 rounded border break-all">
                      {mfaData?.secret}
                    </code>
                  </div>

                  <div className="p-4 bg-blue-50 text-blue-700 rounded-lg text-sm">
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
      </div>

      {/* Terms & Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Terms and Conditions</h3>
              <button onClick={() => setShowTerms(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              <LegalSections doc="terms" />
            </div>
            <div className="px-6 py-4 border-t">
              <Button onClick={() => setShowTerms(false)} className="w-full">Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Privacy Policy</h3>
              <button onClick={() => setShowPrivacy(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
              <LegalSections doc="privacy" />
            </div>
            <div className="px-6 py-4 border-t">
              <Button onClick={() => setShowPrivacy(false)} className="w-full">Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
