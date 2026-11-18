import React from 'react';
import { Navigate } from 'react-router-dom';
import { User, Mail, Shield, CheckCircle2 } from 'lucide-react';

const Profile = () => {
  const userRole = localStorage.getItem('userRole');

  if (!userRole) {
    return <Navigate to="/login" replace />;
  }

  let storedUser = null;
  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      storedUser = JSON.parse(rawUser);
    }
  } catch (e) {
    console.warn('Failed to parse user JSON from localStorage:', e);
  }

  const userName =
    storedUser?.name ||
    localStorage.getItem('userName') ||
    'N/A';

  const userEmail =
    storedUser?.email ||
    localStorage.getItem('userEmail') ||
    'N/A';

  const currentRole =
    storedUser?.role ||
    userRole ||
    'N/A';

  const getRoleBadgeStyle = (role) => {
    switch (String(role || '').toUpperCase()) {
      case 'ADMIN':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30 ring-purple-500/20';
      case 'PHC':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30 ring-blue-500/20';
      case 'ASHA':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-emerald-500/20';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  const getRoleLabel = (role) => {
    switch (String(role || '').toUpperCase()) {
      case 'ADMIN':
        return 'State District Administrator';
      case 'PHC':
        return 'Primary Health Centre Officer';
      case 'ASHA':
        return 'Ground-Level ASHA Worker';
      default:
        return role;
    }
  };

  const getInitials = (name) => {
    if (!name) return 'SH';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-slate-900 min-h-screen text-slate-100">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <User className="w-7 h-7 text-blue-400" />
            <span>User Profile & Session</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Logged-in surveillance credentials and active session overview
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-full w-fit">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">
            Active Session Verified
          </span>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Quick Info */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 text-center shadow-xl space-y-4 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="relative inline-block">
            <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-3xl flex items-center justify-center shadow-lg shadow-blue-500/20 border-2 border-slate-700">
              {getInitials(userName)}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-lg border-2 border-slate-800 text-white">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">{userName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{userEmail}</p>
          </div>

          <div className="pt-1">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeStyle(
                currentRole
              )}`}
            >
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              {currentRole} Role
            </span>
          </div>
        </div>

        {/* Right Column: Detailed Credential Specs Stack */}
        <div className="md:col-span-2 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-6 backdrop-blur-sm">
          <h3 className="text-base font-semibold text-white border-b border-slate-700/60 pb-3 flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span>Account Details & Security Specs</span>
          </h3>

          <div className="flex flex-col space-y-4 w-full">
            <div className="bg-slate-900/60 border border-slate-700/50 p-4.5 rounded-xl space-y-1.5 w-full">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium uppercase tracking-wider">
                <User className="w-4 h-4 text-blue-400" />
                <span>Full Name</span>
              </div>
              <p className="text-base font-bold text-slate-100">{userName}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-700/50 p-4.5 rounded-xl space-y-1.5 w-full">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium uppercase tracking-wider">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>Registered Email</span>
              </div>
              <p className="text-base font-bold text-slate-100 break-all">{userEmail}</p>
            </div>

            <div className="bg-slate-900/60 border border-slate-700/50 p-4.5 rounded-xl space-y-1.5 w-full">
              <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium uppercase tracking-wider">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>Designated Role</span>
              </div>
              <p className="text-base font-bold text-slate-100">{getRoleLabel(currentRole)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
