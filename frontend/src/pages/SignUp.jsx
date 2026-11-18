import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, UserPlus, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck, HeartPulse, Stethoscope } from 'lucide-react';
import apiClient from '../api/client';

const SignUp = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ASHA',
    phone_number: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleSelect = (selectedRole) => {
    setFormData((prev) => ({ ...prev, role: selectedRole }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      setErrorMsg('Please fill in all mandatory fields.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        phone_number: formData.phone_number.trim() || null,
      };

      const res = await apiClient.post('/auth/signup', payload);
      if (res.status === 200 || res.status === 201 || res.data?.status === 'success') {
        const userData = res.data?.user || res.data;
        if (userData && userData.email && userData.role) {
          localStorage.setItem('user', JSON.stringify(userData));
          localStorage.setItem('userRole', String(userData.role).toUpperCase());
          localStorage.setItem('userEmail', userData.email);
          localStorage.setItem('userName', userData.name || formData.name.trim());
          navigate('/dashboard');
        } else {
          alert('Account created successfully! Please sign in.');
          navigate('/login');
        }
      }
    } catch (err) {
      console.error('Signup error:', err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 400 && typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (Array.isArray(detail)) {
        setErrorMsg(detail.map((d) => d.msg).join(', '));
      } else {
        setErrorMsg('Failed to create account. Please check your inputs or network connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-8 backdrop-blur-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-emerald-600/10 rounded-2xl border border-emerald-500/20 text-emerald-400 mb-1">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Join Smart Health EWS</h1>
          <p className="text-slate-400 text-sm">Create an account to join early outbreak surveillance</p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* Sign Up Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <div className="relative">
              <User className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g. Sunita Devi"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                placeholder="worker@smarthealth.gov.in"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password *
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-11 pr-11 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Interactive Role Selection Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select Surveillance Role *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRoleSelect('ASHA')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-1.5 transition-all ${
                  formData.role === 'ASHA'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 ring-1 ring-emerald-500/40 shadow-sm'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <HeartPulse className="w-4 h-4" />
                <span>ASHA Worker</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('PHC')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-1.5 transition-all ${
                  formData.role === 'PHC'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-400 ring-1 ring-blue-500/40 shadow-sm'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>PHC Officer</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('Admin')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center space-y-1.5 transition-all ${
                  formData.role === 'Admin'
                    ? 'bg-purple-500/10 border-purple-500 text-purple-400 ring-1 ring-purple-500/40 shadow-sm'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 mt-4"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              <>
                <UserPlus className="w-5 h-5" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Redirect Link */}
        <div className="text-center pt-2 border-t border-slate-700/60">
          <p className="text-slate-400 text-xs">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:underline font-semibold inline-flex items-center space-x-1">
              <span>Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
