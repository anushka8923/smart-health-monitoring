import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Globe, AlertTriangle, ShieldAlert, X, Phone, Navigation, RefreshCw, Mail } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import apiClient from '../api/client';

const AdminDashboard = () => {
  const [villages, setVillages] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetchingGeo, setIsFetchingGeo] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    state: '',
    district: '',
    asha_worker_name: '',
    asha_worker_phone: '',
    asha_worker_email: '',
    phc_officer_name: '',
    phc_officer_phone: '',
    phc_officer_email: '',
  });

  const fetchVillages = async () => {
    try {
      const response = await apiClient.get('/villages/live-map');
      if (Array.isArray(response.data)) {
        setVillages(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch live map villages:', error);
    }
  };

  useEffect(() => {
    fetchVillages();
    const intervalId = setInterval(() => {
      fetchVillages();
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await apiClient.post('/sensors/sync');
    } catch (error) {
      console.error('Failed to sync environmental data:', error);
    } finally {
      setIsSyncing(false);
      await fetchVillages();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const formatPhoneWithCountryCode = (rawPhone) => {
    if (!rawPhone) return '';
    let cleaned = rawPhone.trim();
    if (!cleaned) return '';
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    return `+91${cleaned.replace(/^0+/, '')}`;
  };

  const fetchCoordinates = async (placeName) => {
    const query = placeName || formData.name;
    if (!query || !query.trim()) return false;

    setIsFetchingGeo(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      let res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=1&language=en&format=json`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      let data = await res.json();

      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        setFormData((prev) => ({
          ...prev,
          latitude: prev.latitude || String(item.latitude),
          longitude: prev.longitude || String(item.longitude),
          state: prev.state || item.admin1 || '',
          district: prev.district || item.admin2 || item.admin3 || '',
        }));
        return true;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching geocode:', err);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsFetchingGeo(false);
    }

    // Default coordinate fallback if geocoding fails or times out
    setFormData((prev) => ({
      ...prev,
      latitude: prev.latitude || '28.6139',
      longitude: prev.longitude || '77.2090',
      state: prev.state || 'Delhi',
      district: prev.district || 'New Delhi',
    }));
    return false;
  };

  const handlePlaceBlur = () => {
    if (formData.name && formData.name.trim() && (!formData.latitude || !formData.longitude)) {
      fetchCoordinates(formData.name); // Non-blocking background call
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Strict mandatory fields check for Village & 3-Tier Personnel Mapping
    if (
      !formData.name.trim() ||
      !formData.state.trim() ||
      !formData.district.trim() ||
      !formData.latitude ||
      !formData.longitude ||
      !formData.asha_worker_name.trim() ||
      !formData.asha_worker_phone.trim() ||
      !formData.asha_worker_email.trim() ||
      !formData.phc_officer_name.trim() ||
      !formData.phc_officer_phone.trim() ||
      !formData.phc_officer_email.trim()
    ) {
      alert("Please fill in ALL mandatory fields, including ASHA Worker & PHC Officer details and email addresses.");
      return;
    }

    let lat = parseFloat(formData.latitude);
    let lng = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid numeric values for Latitude and Longitude.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedAshaPhone = formatPhoneWithCountryCode(formData.asha_worker_phone);
      const formattedPhcPhone = formatPhoneWithCountryCode(formData.phc_officer_phone);

      const payload = {
        name: formData.name.trim(),
        latitude: lat,
        longitude: lng,
        state: formData.state.trim(),
        district: formData.district.trim(),
        contact_number: formattedAshaPhone, // Default alert contact to mapped ASHA worker
        asha_worker_name: formData.asha_worker_name.trim(),
        asha_worker_phone: formattedAshaPhone,
        asha_worker_email: formData.asha_worker_email.trim(),
        phc_officer_name: formData.phc_officer_name.trim(),
        phc_officer_phone: formattedPhcPhone,
        phc_officer_email: formData.phc_officer_email.trim(),
      };

      await apiClient.post('/villages/onboard', payload);
      setShowModal(false);
      setFormData({
        name: '',
        latitude: '',
        longitude: '',
        state: '',
        district: '',
        asha_worker_name: '',
        asha_worker_phone: '',
        asha_worker_email: '',
        phc_officer_name: '',
        phc_officer_phone: '',
        phc_officer_email: '',
      });
      await fetchVillages();
    } catch (error) {
      console.error('Error onboarding village:', error);
      alert('Failed to onboard village. Please check input values and backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getColor = (risk) => {
    switch (risk) {
      case 'Critical':
        return '#ef4444';
      case 'High':
        return '#f97316';
      case 'Medium':
        return '#eab308';
      case 'Low':
        return '#22c55e';
      case 'Pending':
        return '#9ca3af';
      default:
        return '#9ca3af';
    }
  };

  const unsyncedCount = Array.isArray(villages)
    ? villages.filter((v) => {
        const risk = v.risk_score || v.risk || 'Pending';
        return risk === 'Pending';
      }).length
    : 0;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            SYSTEM OVERVIEW
          </span>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight mt-2">
            Admin View - Health Early Warning System
          </h1>
          <p className="text-slate-500 mt-1">Global health metrics, GIS maps, and regional management.</p>
        </div>

        <div className="flex items-center space-x-3">
          {unsyncedCount > 0 ? (
            <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-sm animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>{unsyncedCount} Unsynced Place{unsyncedCount > 1 ? 's' : ''}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
              <span>All Places Synced</span>
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all ${
              unsyncedCount > 0 ? 'animate-pulse ring-2 ring-amber-400 ring-offset-2' : ''
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Live Data'}</span>
          </button>



          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Place</span>
          </button>
        </div>
      </div>

      {/* Leaflet GIS Map Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-800">Spatial Risk Heatmap (GIS View)</h2>
          </div>
          <div className="flex items-center space-x-4 text-xs font-medium">
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-gray-400 inline-block"></span>
              <span className="text-gray-600 font-semibold">Pending</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
              <span>Critical</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span>
              <span>High</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
              <span>Low</span>
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-inner">
          <MapContainer
            center={[28.6139, 77.209]}
            zoom={8}
            style={{ height: '500px', width: '100%', borderRadius: '0.5rem', zIndex: 0 }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            {Array.isArray(villages) &&
              villages.map((v) => {
                const latRaw = v.latitude !== undefined && v.latitude !== null ? v.latitude : v.lat;
                const lngRaw = v.longitude !== undefined && v.longitude !== null ? v.longitude : v.lng;

                if (latRaw === undefined || latRaw === null || lngRaw === undefined || lngRaw === null) return null;

                const lat = parseFloat(latRaw);
                const lng = parseFloat(lngRaw);
                if (isNaN(lat) || isNaN(lng)) return null;

                const risk = v.risk_score || v.risk || 'Pending';

                return (
                  <CircleMarker
                    key={v.id || v.name}
                    center={[parseFloat(lat), parseFloat(lng)]}
                    pathOptions={{ color: getColor(risk), fillColor: getColor(risk), fillOpacity: 0.7 }}
                    radius={10}
                  >
                    <Popup>
                      <div className="p-1 space-y-1">
                        <h3 className="font-bold text-slate-900 text-sm">{v.name}</h3>
                        <p className="text-xs text-slate-500 font-medium">Place Location</p>
                        <p className="text-xs text-slate-600">
                          Risk Level: <strong style={{ color: getColor(risk) }}>{risk}</strong>
                        </p>
                        {v.contact_number && (
                          <p className="text-xs text-slate-500">Contact: {v.contact_number}</p>
                        )}
                        {v.asha_worker_name && (
                          <p className="text-xs text-emerald-700 font-medium">
                            ASHA: {v.asha_worker_name} ({v.asha_worker_phone || 'No Phone'})
                          </p>
                        )}
                        {v.phc_officer_name && (
                          <p className="text-xs text-blue-700 font-medium">
                            PHC: {v.phc_officer_name} ({v.phc_officer_phone || 'No Phone'})
                          </p>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
          </MapContainer>
        </div>
      </div>

      {/* Admin Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">System Outbreak Protocols</h3>
            <p className="text-sm text-slate-500 mt-1">Trigger district-wide medical team dispatches and emergency health broadcasts.</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start space-x-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-200">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Critical Resource Allocation</h3>
            <p className="text-sm text-slate-500 mt-1">Manage state medical supply reserves, water purification kits, and diagnostic test distribution.</p>
          </div>
        </div>
      </div>

      {/* Add New Village Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Onboard New Place</h3>
                  <p className="text-xs text-slate-500 font-normal">Assign location details and staff members</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Location Metadata Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  1. Location Basic Metadata
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Place Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    onBlur={handlePlaceBlur}
                    placeholder="e.g. Modinagar"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      name="state"
                      required
                      value={formData.state}
                      onChange={handleInputChange}
                      placeholder="e.g. UP"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      District *
                    </label>
                    <input
                      type="text"
                      name="district"
                      required
                      value={formData.district}
                      onChange={handleInputChange}
                      placeholder="e.g. Ghaziabad"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Latitude *
                    </label>
                    <div className="relative">
                      <Navigation className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="number"
                        step="any"
                        name="latitude"
                        required
                        value={formData.latitude}
                        onChange={handleInputChange}
                        placeholder="e.g. 28.8318"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Longitude *
                    </label>
                    <div className="relative">
                      <Navigation className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="number"
                        step="any"
                        name="longitude"
                        required
                        value={formData.longitude}
                        onChange={handleInputChange}
                        placeholder="e.g. 77.5828"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ground-Level ASHA Worker Assignment */}
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>ASHA WORKER DETAILS *</span>
                  </h4>
                  <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                    Required Field
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-900 mb-1">
                    ASHA Worker Full Name *
                  </label>
                  <input
                    type="text"
                    name="asha_worker_name"
                    required
                    value={formData.asha_worker_name}
                    onChange={handleInputChange}
                    placeholder="e.g. Sunita Devi"
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-900 mb-1">
                    ASHA Worker Phone Number *
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="w-4 h-4 text-emerald-500 absolute left-3 top-3 z-10" />
                    <span className="absolute left-9 text-sm font-semibold text-emerald-700 select-none z-10">
                      +91
                    </span>
                    <input
                      type="text"
                      name="asha_worker_phone"
                      required
                      value={formData.asha_worker_phone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/^\+91\s?/, '');
                        setFormData((prev) => ({ ...prev, asha_worker_phone: val }));
                      }}
                      placeholder="9876543210"
                      className="w-full bg-white border border-emerald-200 rounded-xl pl-16 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-emerald-900 mb-1">
                    ASHA Worker Email Address *
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-emerald-500 absolute left-3 top-3 z-10" />
                    <input
                      type="email"
                      name="asha_worker_email"
                      required
                      value={formData.asha_worker_email}
                      onChange={handleInputChange}
                      placeholder="asha@smarthealth.gov.in"
                      className="w-full bg-white border border-emerald-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Tier 2: PHC Medical Officer Assignment */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                    <span>PHC OFFICER DETAILS *</span>
                  </h4>
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                    Required Field
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">
                    PHC Officer Full Name *
                  </label>
                  <input
                    type="text"
                    name="phc_officer_name"
                    required
                    value={formData.phc_officer_name}
                    onChange={handleInputChange}
                    placeholder="e.g. Dr. Rajesh Kumar"
                    className="w-full bg-white border border-blue-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">
                    PHC Officer Phone Number *
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="w-4 h-4 text-blue-500 absolute left-3 top-3 z-10" />
                    <span className="absolute left-9 text-sm font-semibold text-blue-700 select-none z-10">
                      +91
                    </span>
                    <input
                      type="text"
                      name="phc_officer_phone"
                      required
                      value={formData.phc_officer_phone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/^\+91\s?/, '');
                        setFormData((prev) => ({ ...prev, phc_officer_phone: val }));
                      }}
                      placeholder="9876543210"
                      className="w-full bg-white border border-blue-200 rounded-xl pl-16 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-blue-900 mb-1">
                    PHC Officer Email Address *
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-blue-500 absolute left-3 top-3 z-10" />
                    <input
                      type="email"
                      name="phc_officer_email"
                      required
                      value={formData.phc_officer_email}
                      onChange={handleInputChange}
                      placeholder="officer@smarthealth.gov.in"
                      className="w-full bg-white border border-blue-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white transition-colors shadow-sm"
                >
                  {isSubmitting ? 'Onboarding...' : 'Onboard Place & Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};

export default AdminDashboard;
