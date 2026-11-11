import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BarChart3, TrendingUp, MapPin, Clock, Users, Zap,
  DollarSign, Calendar, ChevronDown
} from 'lucide-react';
import { Card, CardBody, Button, Select } from '../../components/ui';
import api from '../../services/api';

export default function AdminAnalyticsPage() {
  // ?tab=geographic|usage deep-links (used by the admin dashboard)
  const [searchParams] = useSearchParams();
  const initialTab = ['revenue', 'geographic', 'usage'].includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'revenue';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [period, setPeriod] = useState('month');
  const [revenueData, setRevenueData] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [activeTab, period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      if (activeTab === 'revenue') {
        const response = await api.get('/admin/analytics/revenue', { params: { period } });
        setRevenueData(response.data.data);
      } else if (activeTab === 'geographic') {
        const response = await api.get('/admin/analytics/geographic');
        setGeoData(response.data.data);
      } else if (activeTab === 'usage') {
        const response = await api.get('/admin/analytics/usage');
        setUsageData(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'geographic', label: 'Geographic', icon: MapPin },
    { id: 'usage', label: 'Usage Patterns', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-baseline gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <Link to="/admin/dashboard" className="hover:text-primary-600">Admin</Link>
            <span>/</span>
            <span>Analytics</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Detailed platform analytics and insights</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period Selector for Revenue */}
        {activeTab === 'revenue' && (
          <div className="flex justify-end mb-6">
            <Select
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'day', label: 'Daily (Last 30 days)' },
                { value: 'week', label: 'Weekly (Last 12 weeks)' },
                { value: 'month', label: 'Monthly (Last 12 months)' },
                { value: 'year', label: 'Yearly' },
              ]}
              className="w-56"
            />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            {activeTab === 'revenue' && revenueData && <RevenueAnalytics data={revenueData} />}
            {activeTab === 'geographic' && geoData && <GeographicAnalytics data={geoData} />}
            {activeTab === 'usage' && usageData && <UsageAnalytics data={usageData} />}
          </>
        )}
      </div>
    </div>
  );
}

// Revenue Analytics Component
function RevenueAnalytics({ data }) {
  const { timeline, topHosts, summary } = data;
  const maxRevenue = Math.max(...timeline.map(t => t.revenue), 1);

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">Total Revenue</p>
                        <p className="text-3xl font-bold text-gray-900">${summary.totalRevenue.toLocaleString()}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">Platform Fees (7%)</p>
                        <p className="text-3xl font-bold text-green-600">${summary.totalPlatformFees.toLocaleString()}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">Total Transactions</p>
            <p className="text-3xl font-bold text-gray-900">{summary.totalTransactions}</p>
          </CardBody>
        </Card>
      </div>

      {/* Revenue Chart (Simple Bar Chart) */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Timeline</h3>
          {timeline.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No revenue data for this period</p>
          ) : (
            <div className="space-y-3">
              {timeline.slice(-12).map(item => (
                <div key={item.period} className="flex items-center gap-4">
                  <span className="w-24 text-sm text-gray-500">{item.period}</span>
                  <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-lg flex items-center justify-end pr-2"
                      style={{ width: `${(item.revenue / maxRevenue) * 100}%`, minWidth: item.revenue > 0 ? '60px' : '0' }}
                    >
                      {item.revenue > 0 && (
                                                <span className="text-xs text-white font-medium">${item.revenue.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <span className="w-16 text-sm text-gray-500 text-right">{item.transactions} txns</span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Top Hosts */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Earning Hosts</h3>
          {topHosts.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No host earnings data</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {topHosts.map((host, index) => (
                <div key={host.host.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-900">{host.host.name}</span>
                  </div>
                  <div className="text-right">
                                        <p className="font-semibold text-gray-900">${host.totalEarnings.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{host.bookings} bookings</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// Geographic Analytics Component
function GeographicAnalytics({ data }) {
  const { byCity, hotspots } = data;

  return (
    <div className="space-y-8">
      {/* By City */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Chargers by City</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 text-sm font-medium text-gray-500">City</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-500">Chargers</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-500">Bookings</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-500">Revenue</th>
                  <th className="text-right py-3 text-sm font-medium text-gray-500">Avg Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {byCity.map(city => (
                  <tr key={city.city} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{city.city}</td>
                    <td className="py-3 text-right text-gray-700">{city.chargers}</td>
                    <td className="py-3 text-right text-gray-700">{city.bookings}</td>
                                        <td className="py-3 text-right text-gray-700">${city.revenue.toLocaleString()}</td>
                    <td className="py-3 text-right">
                      {city.avgRating ? (
                        <span className="flex items-center justify-end gap-1">
                          {city.avgRating} <span className="text-yellow-500">⭐</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Hotspots */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Chargers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hotspots.slice(0, 10).map((spot, index) => (
              <div key={spot.id} className="p-5 border border-gray-200 rounded-lg hover:border-primary-300">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-900">{spot.name}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{spot.address}</p>
                    <p className="text-xs text-gray-400">{spot.city}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{spot.bookings} bookings</p>
                    {spot.rating && (
                      <p className="text-sm text-gray-500">{spot.rating} ⭐</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// Usage Analytics Component
function UsageAnalytics({ data }) {
  const { bookingsByHour, bookingsByDayOfWeek, bookingSource, connectorTypes, kwTiers, avgSessionDuration } = data;
  const maxHourly = Math.max(...bookingsByHour.map(h => h.count), 1);
  const maxDaily = Math.max(...bookingsByDayOfWeek.map(d => d.count), 1);

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">Avg Session Duration</p>
            <p className="text-3xl font-bold text-gray-900">{avgSessionDuration || 'N/A'} min</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">AI Agent Bookings</p>
            <p className="text-3xl font-bold text-primary-600">{bookingSource.agentPercentage}%</p>
            <p className="text-xs text-gray-400">{bookingSource.agent} of {bookingSource.agent + bookingSource.manual}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">Manual Bookings</p>
            <p className="text-3xl font-bold text-gray-600">{100 - bookingSource.agentPercentage}%</p>
            <p className="text-xs text-gray-400">{bookingSource.manual} of {bookingSource.agent + bookingSource.manual}</p>
          </CardBody>
        </Card>
      </div>

      {/* Bookings by Hour */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bookings by Hour of Day</h3>
          <div className="flex items-end gap-1 h-40">
            {bookingsByHour.map(item => (
              <div key={item.hour} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-primary-500 rounded-t transition-all"
                  style={{ height: `${(item.count / maxHourly) * 100}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                />
                <span className="text-xs text-gray-400 mt-1">{item.hour}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-2">Hour of day (0-23)</p>
        </CardBody>
      </Card>

      {/* Bookings by Day */}
      <Card>
        <CardBody>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bookings by Day of Week</h3>
          <div className="space-y-3">
            {bookingsByDayOfWeek.map(item => (
              <div key={item.day} className="flex items-center gap-4">
                <span className="w-12 text-sm text-gray-500">{item.day}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-lg"
                    style={{ width: `${(item.count / maxDaily) * 100}%` }}
                  />
                </div>
                <span className="w-12 text-sm text-gray-700 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Connector Types & kW Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Connector Types</h3>
            <div className="space-y-2">
              {connectorTypes.map(item => (
                <div key={item.type} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{item.type}</span>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Power Tiers</h3>
            <div className="space-y-2">
              {kwTiers.map(item => (
                <div key={item.tier} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{item.tier}</span>
                  <span className="font-semibold text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
