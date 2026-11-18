import React, { useState, useEffect } from 'react';
import { MapPin, Search, RefreshCw, Trash2 } from 'lucide-react';
import axios from 'axios';
import apiClient from '../api/client';

const VillagesList = () => {
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const userRole = (localStorage.getItem('userRole') || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN';

  const fetchVillages = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/villages/live-map');
      if (Array.isArray(res.data)) {
        setVillages(res.data);
      }
    } catch (error) {
      console.error('Error fetching villages list:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVillages();
    const intervalId = setInterval(() => {
      fetchVillages();
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this place?')) {
      return;
    }

    try {
      await apiClient.delete(`/villages/${id}`);
      setVillages((prevVillages) => prevVillages.filter((v) => v.id !== id));
    } catch (error) {
      console.error('Error deleting place:', error);
      alert('Failed to delete place. Please try again.');
    }
  };

  const getRiskBadgeClass = (risk) => {
    switch (risk) {
      case 'Critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'High':
        return 'text-orange-500 bg-orange-50 border-orange-200';
      case 'Medium':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const filteredVillages = villages.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Place Directory
          </h1>
          <p className="text-slate-500 mt-1">Complete registered place listing, coordinates, and health status.</p>
        </div>

        <button
          onClick={fetchVillages}
          className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl shadow-sm transition-all font-medium text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search place by name..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>
        <div className="text-xs font-medium text-slate-500">
          Showing <span className="text-slate-900 font-bold">{filteredVillages.length}</span> of {villages.length} Places
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">PLACE NAME</th>
                <th className="px-6 py-4">STATE</th>
                <th className="px-6 py-4">DISTRICT</th>
                <th className="px-6 py-4">Latitude</th>
                <th className="px-6 py-4">Longitude</th>
                <th className="px-6 py-4">Risk Score</th>
                {isAdmin && <th className="px-6 py-4 text-right">ACTIONS</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredVillages.map((village, idx) => {
                const lat = village.latitude || village.lat || 'N/A';
                const lng = village.longitude || village.lng || 'N/A';
                const risk = village.risk_score || village.risk || 'Low';
                const stateVal = village.state || 'N/A';
                const districtVal = village.district || 'N/A';

                return (
                  <tr key={village.id || idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">#{village.id || idx + 1}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900 flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{village.name}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-medium">{stateVal}</td>
                    <td className="px-6 py-4 text-slate-700 font-medium">{districtVal}</td>
                    <td className="px-6 py-4 font-mono text-slate-600">{lat}</td>
                    <td className="px-6 py-4 font-mono text-slate-600">{lng}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getRiskBadgeClass(
                          risk
                        )}`}
                      >
                        {risk}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(village.id)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold transition-all shadow-sm"
                          title="Delete Place"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredVillages.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-12 text-center text-slate-400">
                    {loading ? 'Loading place directory...' : 'No matching places found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VillagesList;
