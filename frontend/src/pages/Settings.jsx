import React, { useState } from 'react';
import { Sliders, Bell, RefreshCw, Shield, Smartphone, Lock, Database, Volume2, WifiOff, AlertTriangle } from 'lucide-react';

const Settings = () => {
  // Safe role detection
  let userRole = 'ASHA';
  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed?.role) userRole = parsed.role;
    } else {
      userRole = localStorage.getItem('userRole') || 'ASHA';
    }
  } catch (e) {
    userRole = localStorage.getItem('userRole') || 'ASHA';
  }

  // Role Configurations
  const ROLE_CONFIGS = {
    Admin: {
      label: 'State District Administrator Settings',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      accentColor: 'bg-purple-600',
      settings: [
        {
          id: 'autoSync',
          title: 'Auto-Sync Telemetry',
          description: 'Automatically sync telemetry across all registered district villages and re-calculate risk scores.',
          icon: RefreshCw,
          iconBg: 'bg-purple-500/10 text-purple-400',
          mandatory: true,
          defaultState: true,
        },
        {
          id: 'strictGis',
          title: 'Strict GIS Boundary Validation',
          description: 'Enforce strict latitude/longitude bounding box checks during village onboarding.',
          icon: Shield,
          iconBg: 'bg-blue-500/10 text-blue-400',
          mandatory: true,
          defaultState: true,
        },
        {
          id: 'weeklyBackup',
          title: 'Allow Weekly Database Backups',
          description: 'Schedule automated database snapshots to secure cloud backup buckets every Sunday.',
          icon: Database,
          iconBg: 'bg-emerald-500/10 text-emerald-400',
          mandatory: false,
          defaultState: false,
        },
      ],
    },
    PHC: {
      label: 'PHC Medical Officer Settings',
      badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      accentColor: 'bg-blue-600',
      settings: [
        {
          id: 'jurisdictionSms',
          title: 'Jurisdiction Emergency SMS Alerts',
          description: 'Dispatch immediate SMS EWS alerts to assigned ASHA field officers when risk escalates to Critical.',
          icon: Smartphone,
          iconBg: 'bg-blue-500/10 text-blue-400',
          mandatory: true,
          defaultState: true,
        },
        {
          id: 'dailyEmailDigest',
          title: 'Daily Health Digest Email',
          description: 'Receive an aggregated daily report sent to the PHC Officer email address every evening.',
          icon: Bell,
          iconBg: 'bg-purple-500/10 text-purple-400',
          mandatory: false,
          defaultState: true,
        },
        {
          id: 'autoEscalate',
          title: 'Auto-escalate Critical Cases',
          description: 'Automatically trigger district medical team dispatch protocols upon 48 hours of sustained High risk.',
          icon: AlertTriangle,
          iconBg: 'bg-amber-500/10 text-amber-400',
          mandatory: false,
          defaultState: false,
        },
      ],
    },
    ASHA: {
      label: 'ASHA Field Worker Settings',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      accentColor: 'bg-emerald-600',
      settings: [
        {
          id: 'receiveEmergencySms',
          title: 'Receive Emergency SMS Alerts',
          description: 'Receive direct SMS notifications on your registered phone for instant field outbreak warnings.',
          icon: Smartphone,
          iconBg: 'bg-emerald-500/10 text-emerald-400',
          mandatory: true,
          defaultState: true,
        },
        {
          id: 'offlineSyncMode',
          title: 'Offline Data Sync Mode',
          description: 'Cache field observations locally when mobile connectivity is low and auto-upload when back online.',
          icon: WifiOff,
          iconBg: 'bg-blue-500/10 text-blue-400',
          mandatory: false,
          defaultState: true,
        },
        {
          id: 'notificationSounds',
          title: 'In-App Notification Sounds',
          description: 'Play loud audio alerts when a new emergency dispatch warning appears on your dashboard.',
          icon: Volume2,
          iconBg: 'bg-amber-500/10 text-amber-400',
          mandatory: false,
          defaultState: false,
        },
      ],
    },
  };
  ROLE_CONFIGS.ADMIN = ROLE_CONFIGS.Admin;

  const normRole = String(userRole || 'ASHA').toUpperCase();
  const currentConfig = ROLE_CONFIGS[normRole] || ROLE_CONFIGS[userRole] || ROLE_CONFIGS.ASHA;

  // Initialize toggle states
  const [toggleState, setToggleState] = useState(() => {
    const initialState = {};
    currentConfig.settings.forEach((s) => {
      initialState[s.id] = s.defaultState;
    });
    return initialState;
  });

  const handleToggle = (id, mandatory) => {
    if (mandatory) return; // Prevent toggle for mandatory settings
    setToggleState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto bg-slate-900 min-h-screen text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${currentConfig.badgeClass}`}
          >
            <Sliders className="w-3.5 h-3.5 mr-1.5" />
            {currentConfig.label}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-2">
            Surveillance & System Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure automated surveillance alerts, sync frequencies, and system preferences for {userRole} role.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700/80 px-3.5 py-2 rounded-xl text-xs text-slate-300">
          <Lock className="w-4 h-4 text-amber-400" />
          <span>System Policies Applied</span>
        </div>
      </div>

      {/* Role Settings List */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl shadow-xl divide-y divide-slate-700/60 overflow-hidden backdrop-blur-sm">
        {currentConfig.settings.map((setting) => {
          const Icon = setting.icon;
          const isChecked = toggleState[setting.id];
          const isMandatory = setting.mandatory;

          return (
            <div
              key={setting.id}
              className="p-6 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-start space-x-4 pr-4">
                <div className={`p-3 rounded-xl border border-slate-700/50 ${setting.iconBg}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-white text-base">{setting.title}</h3>
                    {isMandatory && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                        <Lock className="w-3 h-3 mr-1" />
                        Mandatory / Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{setting.description}</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  disabled={isMandatory}
                  onClick={() => handleToggle(setting.id, isMandatory)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
                    isChecked
                      ? `${currentConfig.accentColor} justify-end shadow-sm`
                      : 'bg-slate-700 justify-start'
                  } ${isMandatory ? 'opacity-70 cursor-not-allowed border border-slate-600' : 'cursor-pointer hover:opacity-90'}`}
                  title={isMandatory ? 'This setting is mandatory and locked by system policy.' : 'Toggle setting'}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform"></div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Settings;

