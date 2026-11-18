import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  MapPin,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Clock,
  Thermometer,
  Droplets,
  CloudRain,
  PhoneCall,
  Eye,
  Send,
  Loader2,
  Mail
} from 'lucide-react';
import RiskChart from '../components/RiskChart';
import apiClient from '../api/client';

const PhcDashboard = () => {
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatchingId, setDispatchingId] = useState(null);
  const [notifyingAshaId, setNotifyingAshaId] = useState(null);

  const fetchPhcData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/phc/jurisdiction-status');
      if (Array.isArray(res.data)) {
        setVillages(res.data);
      }
    } catch (e) {
      console.error('Error fetching PHC jurisdiction data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhcData();
    const intervalId = setInterval(() => {
      fetchPhcData();
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const totalVillages = villages.length;
  const criticalCount = villages.filter(
    (v) => (v.risk_score || v.risk) === 'Critical'
  ).length;
  const highCount = villages.filter(
    (v) => (v.risk_score || v.risk) === 'High'
  ).length;

  const getRiskBadgeClass = (risk) => {
    switch (risk) {
      case 'Critical':
        return 'text-red-700 bg-red-50 border-red-200/80 ring-1 ring-red-500/20';
      case 'High':
        return 'text-orange-700 bg-orange-50 border-orange-200/80 ring-1 ring-orange-500/20';
      case 'Normal':
      case 'Low':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200/80 ring-1 ring-emerald-500/20';
      default:
        return 'text-slate-700 bg-slate-50 border-slate-200/80';
    }
  };

  const riskToNumeric = (risk) => {
    switch (risk) {
      case 'Critical':
        return 3;
      case 'High':
        return 2;
      default:
        return 1;
    }
  };

  const chartData = villages.map((v) => ({
    name: v.village_name || v.name,
    temperature: v.temperature ?? 0,
    humidity: v.humidity ?? 0,
    rainfall: v.rainfall ?? 0,
    riskNum: riskToNumeric(v.risk_score || v.risk),
    riskLevel: v.risk_score || v.risk || 'Low',
  }));

  const handleNotifyAsha = async (village) => {
    const targetVillageId = village.village_id || village.id;
    const villageName = village.village_name || village.name || 'target location';
    const ashaName = village.asha_worker_name || 'ASHA Worker';

    setNotifyingAshaId(targetVillageId);
    try {
      const payload = {
        village_id: targetVillageId,
        village_name: villageName,
        risk_level: village.risk_score || village.risk || 'High',
        disease_outbreak: 'Vector-Borne Disease Outbreak Advisory',
        target_role: 'ASHA',
        temperature: village.temperature || 30.0,
        humidity: village.humidity || 75.0,
        rainfall: village.rainfall || 50.0,
      };

      const res = await apiClient.post('/alerts/notify-asha', payload);
      alert(res?.data?.message || `Email and SMS alert successfully sent to ASHA worker (${ashaName}) for ${villageName}!`);
    } catch (err) {
      console.error('Failed to notify ASHA worker:', err);
      const errMsg = err?.response?.data?.detail || 'Failed to send alert to ASHA worker. Please check backend connection.';
      alert(errMsg);
    } finally {
      setNotifyingAshaId(null);
    }
  };

  const handleDispatchTeam = async (village) => {
    const targetVillageId = village.village_id || village.id;
    setDispatchingId(targetVillageId);
    try {
      const res = await apiClient.post('/phc/dispatch-team', {
        village_id: targetVillageId,
      });
      const ashaName = res?.data?.target_asha_name || village.asha_worker_name || 'Assigned ASHA Worker';
      const villageName = village.village_name || village.name || 'target village';
      alert(res?.data?.message || `Emergency medical response team dispatched to ${villageName}! ASHA worker (${ashaName}) notified.`);
    } catch (err) {
      console.error('Failed to dispatch medical response team:', err);
      const errMsg = err?.response?.data?.detail || 'Failed to dispatch medical response team. Please check backend connection.';
      alert(errMsg);
    } finally {
      setDispatchingId(null);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Not Synced Yet';
    try {
      const date = new Date(ts);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return ts;
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Primary Health Centre (PHC) Level
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight mt-2">
            PHC View - Jurisdiction Surveillance
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time block telemetry and multi-village emergency dispatch console for medical officers.
          </p>
        </div>
        <button
          onClick={fetchPhcData}
          disabled={loading}
          className="flex items-center space-x-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden md:inline">Refresh Data</span>
        </button>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Jurisdiction Places</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{loading ? '...' : totalVillages}</p>
            </div>
            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
              <MapPin className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Critical Risk Outbreaks</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{loading ? '...' : criticalCount}</p>
            </div>
            <div className="p-3.5 bg-red-50 text-red-600 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">High Risk Watchlist</p>
              <p className="text-3xl font-bold text-orange-500 mt-2">{loading ? '...' : highCount}</p>
            </div>
            <div className="p-3.5 bg-orange-50 text-orange-500 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Recharts Analytics Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">Telemetry Trends Across Block</h2>
          </div>
        </div>
        {chartData.length > 0 ? (
          <RiskChart data={chartData} />
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            No place telemetry data available
          </div>
        )}
      </div>

      {/* Multi-Place Surveillance Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-0">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Multi-Place Monitoring Grid</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time health and risk status across all assigned locations.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
            {villages.length} Active Locations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Place Name & ID</th>
                <th className="px-6 py-4">Assigned ASHA</th>
                <th className="px-6 py-4">Last Telemetry Sync</th>
                <th className="px-6 py-4">Environmental Telemetry</th>
                <th className="px-6 py-4">Risk Status</th>
                <th className="px-6 py-4 text-right">Surveillance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <span>Loading jurisdiction status...</span>
                    </div>
                  </td>
                </tr>
              ) : villages.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                    No places in jurisdiction yet.
                  </td>
                </tr>
              ) : (
                villages.map((v) => {
                  const risk = v.risk_score || v.risk || 'Low';
                  const displayRisk = risk === 'Low' ? 'Normal' : risk;

                  return (
                    <tr key={v.village_id || v.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Village Name & ID */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{v.village_name || v.name}</div>
                        <div className="text-xs text-slate-400 flex items-center space-x-1 mt-0.5">
                          <span>ID: #{v.village_id || v.id}</span>
                          <span>•</span>
                          <span>{v.district || 'District'}</span>
                        </div>
                      </td>

                      {/* Assigned ASHA Worker */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 text-xs">
                          {v.asha_worker_name || 'Unassigned'}
                        </div>
                        {v.asha_worker_phone && (
                          <a
                            href={`tel:${v.asha_worker_phone}`}
                            className="text-[11px] text-blue-600 hover:underline flex items-center space-x-1 mt-0.5"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>{v.asha_worker_phone}</span>
                          </a>
                        )}
                      </td>

                      {/* Last Synced Date/Time */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatTimestamp(v.last_updated)}</span>
                        </div>
                      </td>

                      {/* Telemetry Metrics */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3 text-xs">
                          <span className="flex items-center space-x-1 text-slate-700 bg-slate-100 px-2 py-1 rounded-md" title="Temperature">
                            <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                            <span>{v.temperature ?? 0}°C</span>
                          </span>
                          <span className="flex items-center space-x-1 text-slate-700 bg-slate-100 px-2 py-1 rounded-md" title="Humidity">
                            <Droplets className="w-3.5 h-3.5 text-blue-500" />
                            <span>{v.humidity ?? 0}%</span>
                          </span>
                          <span className="flex items-center space-x-1 text-slate-700 bg-slate-100 px-2 py-1 rounded-md" title="Rainfall">
                            <CloudRain className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{v.rainfall ?? 0}mm</span>
                          </span>
                        </div>
                      </td>

                      {/* Color-Coded Risk Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getRiskBadgeClass(
                            risk
                          )}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              risk === 'Critical'
                                ? 'bg-red-500 animate-pulse'
                                : risk === 'High'
                                ? 'bg-orange-500'
                                : 'bg-emerald-500'
                            }`}
                          ></span>
                          {displayRisk}
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {v.asha_worker_name || v.asha_worker_phone ? (
                            <button
                              onClick={() => handleNotifyAsha(v)}
                              disabled={notifyingAshaId === (v.village_id || v.id)}
                              title={`Notify ASHA Worker (${v.asha_worker_name || 'Assigned'})`}
                              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-75"
                            >
                              <Mail className={`w-3.5 h-3.5 ${notifyingAshaId === (v.village_id || v.id) ? 'animate-spin' : ''}`} />
                              <span>{notifyingAshaId === (v.village_id || v.id) ? 'Notifying...' : 'Notify ASHA'}</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              title="No ASHA worker assigned to this location yet"
                              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>No ASHA</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleDispatchTeam(v)}
                            disabled={dispatchingId === (v.village_id || v.id)}
                            className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                              risk === 'Critical' || risk === 'High'
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/20'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            <Send className={`w-3.5 h-3.5 ${dispatchingId === (v.village_id || v.id) ? 'animate-spin' : ''}`} />
                            <span>{dispatchingId === (v.village_id || v.id) ? 'Dispatching...' : 'Dispatch Team'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PhcDashboard;
