import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  ShieldAlert,
  CheckCircle,
  PhoneCall,
  Loader2,
  RefreshCw,
  Thermometer,
  Droplets,
  CloudRain,
  MessageSquare,
  Send,
  AlertTriangle,
  Clock,
  User,
  Phone
} from 'lucide-react';
import apiClient from '../api/client';

const AshaDashboard = () => {
  const [villages, setVillages] = useState([]);
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertSending, setAlertSending] = useState(false);
  const [alertLogs, setAlertLogs] = useState([]);

  // Get logged-in user profile info if available
  let loggedInUser = null;
  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) loggedInUser = JSON.parse(rawUser);
  } catch (e) {
    // Ignore JSON parse errors
  }

  const userDisplayName = loggedInUser?.name || localStorage.getItem('userName') || 'ASHA Field Worker';

  const fetchAshaData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await apiClient.get('/villages/live-map');
      const villagesList = Array.isArray(res.data) ? res.data : [];
      setVillages(villagesList);

      // Keep selectedVillage only if user previously clicked a card explicitly
      if (selectedVillage) {
        const updatedSelected = villagesList.find((v) => String(v.id) === String(selectedVillage.id));
        if (updatedSelected) {
          setSelectedVillage(updatedSelected);
        }
      }
    } catch (e) {
      console.error('Error fetching ASHA scoped village data:', e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAshaData();
    const intervalId = setInterval(() => {
      fetchAshaData(true);
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const handleSelectPlace = async (place) => {
    setSelectedVillage(place);
    try {
      const telemetryRes = await apiClient.get(`/sensors/village/${place.id}/latest`);
      if (telemetryRes?.data) {
        setTelemetry(telemetryRes.data);
      }
    } catch (err) {
      setTelemetry({
        temperature: place.temperature ?? 0,
        humidity: place.humidity ?? 0,
        rainfall: place.rainfall ?? 0,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleTriggerEmergencySMSForPlace = async (targetPlace) => {
    const placeToUse = targetPlace || selectedVillage || (villages.length > 0 ? villages[0] : null);
    if (!placeToUse) return;
    setAlertSending(true);

    const targetVillageId = placeToUse.id || placeToUse.village_id;
    const phcOfficerName = placeToUse.phc_officer_name || 'PHC Medical Officer';
    const phcPhone = placeToUse.phc_officer_phone || 'Assigned PHC Officer';

    const payload = {
      village_id: targetVillageId,
      village_name: placeToUse.name || placeToUse.village_name,
      risk_level: placeToUse.risk_score || placeToUse.risk || 'Critical',
      disease_outbreak: 'Vector-Borne Disease Outbreak Warning',
      target_role: 'PHC',
      temperature: placeToUse.temperature || 33.5,
      humidity: placeToUse.humidity || 82.0,
      rainfall: placeToUse.rainfall || 110.0,
    };

    try {
      await apiClient.post('/alerts/notify-phc', payload);
      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        recipient: `${phcOfficerName} (${phcPhone})`,
        status: 'Dispatched to PHC Officer',
        village: placeToUse.name || placeToUse.village_name,
        risk: payload.risk_level,
      };
      setAlertLogs((prev) => [newLog, ...prev]);
      alert(`Emergency alert successfully dispatched to PHC Officer (${phcOfficerName}) for ${placeToUse.name || placeToUse.village_name}!`);
    } catch (err) {
      console.error('Failed to dispatch alert to PHC officer:', err);
      const errMsg = err?.response?.data?.detail || 'Failed to send alert to PHC officer. Please verify backend connection.';
      alert(errMsg);
    } finally {
      setAlertSending(false);
    }
  };

  const handleTriggerEmergencySMS = () => handleTriggerEmergencySMSForPlace(selectedVillage);

  if (loading && villages.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4">
        <Loader2 className="w-10 h-10 text-rose-600 animate-spin" />
        <p className="text-slate-600 font-medium text-center">Loading assigned place telemetry...</p>
      </div>
    );
  }

  if (villages.length === 0) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="p-4 bg-slate-100 rounded-full inline-block text-slate-400">
          <HeartPulse className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">No Places Assigned</h2>
        <p className="text-slate-500 text-sm">No jurisdictional places are currently assigned to your account. Contact your PHC administrator.</p>
        <button
          onClick={() => fetchAshaData()}
          className="inline-flex items-center space-x-2 bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Fetching</span>
        </button>
      </div>
    );
  }

  const highRiskPlaces = villages.filter(
    (v) => (v.risk_score || v.risk) === 'Critical' || (v.risk_score || v.risk) === 'High'
  );

  const totalPlaces = villages.length;
  const criticalCount = villages.filter((v) => (v.risk_score || v.risk) === 'Critical').length;
  const highCount = villages.filter((v) => (v.risk_score || v.risk) === 'High').length;
  const normalCount = totalPlaces - (criticalCount + highCount);

  const getRiskBadgeClass = (r) => {
    switch (r) {
      case 'Critical':
        return 'text-red-700 bg-red-50 border-red-200/80 ring-1 ring-red-500/20';
      case 'High':
        return 'text-orange-700 bg-orange-50 border-orange-200/80 ring-1 ring-orange-500/20';
      case 'Medium':
        return 'text-amber-700 bg-amber-50 border-amber-200/80 ring-1 ring-amber-500/20';
      default:
        return 'text-emerald-700 bg-emerald-50 border-emerald-200/80 ring-1 ring-emerald-500/20';
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Personalized Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
            ASHA Field Officer: {userDisplayName}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight mt-2">
            Field Surveillance Console
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time surveillance and telemetry monitoring across {totalPlaces} assigned location{totalPlaces > 1 ? 's' : ''}.
          </p>
        </div>
        <button
          onClick={() => fetchAshaData()}
          className="p-2.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors flex items-center space-x-2"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="text-xs font-medium hidden sm:inline">Live Refresh</span>
        </button>
      </div>

      {/* Aggregate Multi-Place Surveillance Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 block font-medium">Assigned Places</span>
            <span className="text-xl font-bold text-slate-800">{totalPlaces}</span>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 block font-medium">Critical Outbreaks</span>
            <span className="text-xl font-bold text-red-600">{criticalCount}</span>
          </div>
          <div className="p-2 bg-red-50 text-red-600 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 block font-medium">High Risk Watchlist</span>
            <span className="text-xl font-bold text-orange-500">{highCount}</span>
          </div>
          <div className="p-2 bg-orange-50 text-orange-500 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-slate-400 block font-medium">Normal Status</span>
            <span className="text-xl font-bold text-emerald-600">{normalCount}</span>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* PROMINENT CRITICAL / HIGH RISK BANNERS */}
      {highRiskPlaces.length > 0 ? (
        <div className="space-y-4">
          {highRiskPlaces.map((hrPlace) => {
            const hrRisk = hrPlace.risk_score || hrPlace.risk || 'Critical';
            return (
              <div
                key={hrPlace.id}
                className="bg-gradient-to-br from-red-500 to-rose-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-red-500/20 relative overflow-hidden border border-red-500"
              >
                <div className="absolute -right-8 -bottom-8 opacity-10">
                  <ShieldAlert className="w-64 h-64" />
                </div>

                <div className="flex items-center space-x-3 mb-3">
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider">
                    Outbreak Alert: {hrPlace.name}
                  </span>
                  <span className="px-3 py-1 bg-red-950/40 backdrop-blur-md rounded-full text-xs font-semibold">
                    {hrRisk} Risk Level
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <ShieldAlert className="w-9 h-9 text-white animate-pulse" />
                    <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">HIGH RISK OUTBREAK DETECTED</h2>
                  </div>
                  <p className="text-red-50 text-sm md:text-base leading-relaxed font-medium">
                    CRITICAL WARNING: Outbreak risk is elevated in <strong className="underline underline-offset-4">{hrPlace.name}</strong> ({hrPlace.district || 'District'}). Immediate field intervention, stagnant water treatment, and fever check protocols required.
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleTriggerEmergencySMSForPlace(hrPlace)}
                    disabled={alertSending}
                    className="bg-white text-red-600 hover:bg-red-50 font-bold px-4 py-3 rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 text-sm disabled:opacity-75"
                  >
                    <Send className={`w-4 h-4 ${alertSending ? 'animate-spin' : ''}`} />
                    <span>{alertSending ? 'Sending Alert...' : `Notify PHC Officer (${hrPlace.name})`}</span>
                  </button>

                  {hrPlace.phc_officer_phone ? (
                    <a
                      href={`tel:${hrPlace.phc_officer_phone}`}
                      className="bg-red-950/40 hover:bg-red-950/60 text-white font-bold px-4 py-3 rounded-2xl transition-all flex items-center justify-center space-x-2 text-sm border border-white/20"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Call PHC ({hrPlace.phc_officer_name || 'Officer'})</span>
                    </a>
                  ) : (
                    <button className="bg-red-950/40 text-white font-bold px-4 py-3 rounded-2xl flex items-center justify-center space-x-2 text-sm border border-white/20 opacity-80">
                      <PhoneCall className="w-4 h-4" />
                      <span>Contact PHC Desk</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden border border-emerald-500">
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <CheckCircle className="w-64 h-64" />
          </div>

          <div className="flex items-center space-x-3 mb-2">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider">
              Field Status: Normal
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-8 h-8 text-white" />
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">ALL ASSIGNED PLACES SECURE</h2>
            </div>
            <p className="text-emerald-50 text-sm font-medium">
              Environmental telemetry parameters across all assigned locations are within safe threshold limits.
            </p>
          </div>
        </div>
      )}

      {/* MULTI-PLACE GRID / CARDS VIEW */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Assigned Places Telemetry Grid</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live status, risk scores, and sensor readings for all field locations.
            </p>
          </div>
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
            {villages.length} Places Live
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {villages.map((v) => {
            const pRisk = v.risk_score || v.risk || 'Low';
            const isSelected = selectedVillage && String(selectedVillage.id) === String(v.id);

            return (
              <div
                key={v.id}
                onClick={() => handleSelectPlace(v)}
                className={`bg-white rounded-2xl border p-5 space-y-4 shadow-sm hover:shadow-md transition-all cursor-pointer relative ${
                  isSelected ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{v.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      #{v.id} • {v.district || 'District'}, {v.state || 'State'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRiskBadgeClass(pRisk)}`}>
                    {pRisk}
                  </span>
                </div>

                {/* Telemetry Metrics Pill Grid */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded-xl text-center">
                    <Thermometer className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                    <span className="text-[10px] text-slate-400 block font-medium">Temp</span>
                    <span className="font-bold text-slate-800">{v.temperature ?? 0}°C</span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-xl text-center">
                    <Droplets className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                    <span className="text-[10px] text-slate-400 block font-medium">Humidity</span>
                    <span className="font-bold text-slate-800">{v.humidity ?? 0}%</span>
                  </div>

                  <div className="bg-slate-50 p-2 rounded-xl text-center">
                    <CloudRain className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                    <span className="text-[10px] text-slate-400 block font-medium">Rainfall</span>
                    <span className="font-bold text-slate-800">{v.rainfall ?? 0}mm</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    PHC: {v.phc_officer_name || 'Assigned Officer'}
                  </span>
                  {v.phc_officer_name || v.phc_officer_phone || v.contact_number ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTriggerEmergencySMSForPlace(v);
                      }}
                      disabled={alertSending}
                      className="inline-flex items-center space-x-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-75"
                    >
                      <Send className={`w-3 h-3 ${alertSending ? 'animate-spin' : ''}`} />
                      <span>{alertSending ? 'Notifying...' : 'Notify PHC'}</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      title="No PHC Medical Officer assigned to this location yet"
                      className="inline-flex items-center space-x-1 bg-slate-100 text-slate-400 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-not-allowed"
                    >
                      <Send className="w-3 h-3" />
                      <span>No PHC</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Emergency SMS Alert Delivery Log Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-slate-800">SMS Emergency Alert Audit Log</h3>
          </div>
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
            {alertLogs.length} Dispatched
          </span>
        </div>

        {alertLogs.length === 0 ? (
          <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
            <Clock className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">No emergency alerts sent in this session.</p>
            <p className="text-[11px] text-slate-400">
              Click &quot;SMS Alert&quot; on any place card to test EWS emergency SMS broadcasting.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alertLogs.map((log) => (
              <div key={log.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  <div>
                    <span className="font-bold text-slate-800">SMS Alert to {log.recipient}</span>
                    <span className="text-slate-400 block text-[11px] mt-0.5">{log.status} • {log.village}</span>
                  </div>
                </div>
                <span className="font-medium text-slate-500">{log.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AshaDashboard;
