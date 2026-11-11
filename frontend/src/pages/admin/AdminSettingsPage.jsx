import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings, Save, Shield, DollarSign, Clock, Mail,
  AlertTriangle, CheckCircle, Info
} from 'lucide-react';
import { Card, CardBody, Button, Input } from '../../components/ui';
import api from '../../services/api';

export default function AdminSettingsPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [editedConfig, setEditedConfig] = useState({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/admin/config');
      setConfig(response.data.data);
      setEditedConfig(response.data.data);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (key, value) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await api.patch('/admin/config', { key, value });
      setConfig(prev => ({ ...prev, [key]: value }));
      setSaveMessage({ type: 'success', text: `${key} updated successfully` });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.response?.data?.error?.message || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/admin/dashboard" className="hover:text-primary-600">Admin</Link>
            <span>/</span>
            <span>Settings</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-gray-600 mt-1">Configure platform-wide settings and policies</p>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`mb-6 p-5 rounded-lg flex items-center gap-2 ${
            saveMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {saveMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            {saveMessage.text}
          </div>
        )}

        <div className="space-y-6">
          {/* Financial Settings */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-6">
                <DollarSign className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Financial Settings</h2>
              </div>

              <div className="space-y-6">
                <SettingRow
                  label="Platform Fee Percentage"
                  description="The percentage charged on each transaction as platform fee"
                  value={editedConfig.platformFeePercent}
                  type="number"
                  suffix="%"
                  onChange={(val) => setEditedConfig(prev => ({ ...prev, platformFeePercent: parseFloat(val) }))}
                  onSave={() => handleSave('platformFeePercent', editedConfig.platformFeePercent)}
                  saving={saving}
                  hasChanged={editedConfig.platformFeePercent !== config.platformFeePercent}
                />

                <SettingRow
                  label="Minimum Withdrawal Amount"
                  description="Minimum amount hosts can withdraw from their earnings"
                  value={editedConfig.minWithdrawalAmount}
                  type="number"
                                    prefix="$"
                  onChange={(val) => setEditedConfig(prev => ({ ...prev, minWithdrawalAmount: parseFloat(val) }))}
                  onSave={() => handleSave('minWithdrawalAmount', editedConfig.minWithdrawalAmount)}
                  saving={saving}
                  hasChanged={editedConfig.minWithdrawalAmount !== config.minWithdrawalAmount}
                />

                <SettingRow
                  label="Cancellation Fee Percentage"
                  description="Fee charged for late cancellations (within 2 hours of booking)"
                  value={editedConfig.cancellationFeePercent}
                  type="number"
                  suffix="%"
                  onChange={(val) => setEditedConfig(prev => ({ ...prev, cancellationFeePercent: parseFloat(val) }))}
                  onSave={() => handleSave('cancellationFeePercent', editedConfig.cancellationFeePercent)}
                  saving={saving}
                  hasChanged={editedConfig.cancellationFeePercent !== config.cancellationFeePercent}
                />
              </div>
            </CardBody>
          </Card>

          {/* AI Settings */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">AI & Automation</h2>
              </div>

              <div className="space-y-6">
                <SettingRow
                  label="AI Confidence Threshold"
                  description="Minimum AI confidence required for automatic dispute resolution. Disputes below this threshold require admin review."
                  value={editedConfig.aiConfidenceThreshold}
                  type="number"
                  suffix="%"
                  onChange={(val) => setEditedConfig(prev => ({ ...prev, aiConfidenceThreshold: parseFloat(val) }))}
                  onSave={() => handleSave('aiConfidenceThreshold', editedConfig.aiConfidenceThreshold)}
                  saving={saving}
                  hasChanged={editedConfig.aiConfidenceThreshold !== config.aiConfidenceThreshold}
                />
              </div>
            </CardBody>
          </Card>

          {/* Booking Settings */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Booking Settings</h2>
              </div>

              <div className="space-y-6">
                <SettingRow
                  label="Maximum Advance Booking Days"
                  description="How far in advance users can book a charging session"
                  value={editedConfig.maxBookingAdvanceDays}
                  type="number"
                  suffix="days"
                  onChange={(val) => setEditedConfig(prev => ({ ...prev, maxBookingAdvanceDays: parseInt(val) }))}
                  onSave={() => handleSave('maxBookingAdvanceDays', editedConfig.maxBookingAdvanceDays)}
                  saving={saving}
                  hasChanged={editedConfig.maxBookingAdvanceDays !== config.maxBookingAdvanceDays}
                />
              </div>
            </CardBody>
          </Card>

          {/* Contact & Legal */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-6">
                <Mail className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Contact & Legal</h2>
              </div>

              <div className="space-y-6">
                <SettingRow
                  label="Support Email"
                  description="Email address for customer support inquiries"
                  value={editedConfig.supportEmail}
                  type="email"
                  onChange={(val) => setEditedConfig(prev => ({ ...prev, supportEmail: val }))}
                  onSave={() => handleSave('supportEmail', editedConfig.supportEmail)}
                  saving={saving}
                  hasChanged={editedConfig.supportEmail !== config.supportEmail}
                />

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-5 bg-gray-50 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">Terms of Service Version</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{config.termsVersion}</p>
                    <p className="text-xs text-gray-500 mt-1">Update requires legal review</p>
                  </div>
                  <div className="p-5 bg-gray-50 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">Privacy Policy Version</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{config.privacyPolicyVersion}</p>
                    <p className="text-xs text-gray-500 mt-1">Update requires legal review</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Security Notice */}
          <div className="p-5 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Security & Compliance Notice</p>
                <p className="text-sm text-yellow-700 mt-1">
                  All configuration changes are logged for audit purposes. Changes to financial settings 
                  take effect immediately for new bookings. Existing bookings retain their original terms.
                  For major policy changes, consult with legal counsel.
                </p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800">Environment Variables</p>
                <p className="text-sm text-blue-700 mt-1">
                  Some settings like PayPal credentials, database URLs, and API keys are configured 
                  through environment variables for security reasons and cannot be modified here.
                  Contact your DevOps team for infrastructure changes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Setting Row Component
function SettingRow({ label, description, value, type, prefix, suffix, onChange, onSave, saving, hasChanged }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="flex-1">
        <label className="font-medium text-gray-900">{label}</label>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {prefix && <span className="text-gray-500">{prefix}</span>}
        <input
          type={type === 'email' ? 'email' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-right"
        />
        {suffix && <span className="text-gray-500">{suffix}</span>}
        <Button
          size="sm"
          onClick={onSave}
          disabled={!hasChanged || saving}
          className={hasChanged ? '' : 'opacity-50 cursor-not-allowed'}
        >
          <Save className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
