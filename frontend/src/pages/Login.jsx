import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, ShieldCheck, Mail, Lock, ArrowRight, KeyRound, Loader2, X, Send, Eye, EyeOff } from 'lucide-react';
import apiClient from '../api/client';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;




const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1); // 1: Send OTP, 2: Reset Password
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');

  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', {
        email: email.trim(),
        password: password,
      });

      if (response.data) {
        const userData = response.data.user || response.data;
        const token = response.data.token || response.data.access_token || userData.token || String(userData.id || '');
        const userId = String(userData.id || response.data.userId || '');

        localStorage.setItem('user', JSON.stringify(userData));
        if (token) localStorage.setItem('authToken', token);
        if (userId) localStorage.setItem('userId', userId);
        if (userData.role) {
          localStorage.setItem('userRole', String(userData.role).toUpperCase());
        }
        if (userData.email) {
          localStorage.setItem('userEmail', userData.email);
        }
        if (userData.name) {
          localStorage.setItem('userName', userData.name);
        }
        if (userData.assigned_village_id) {
          localStorage.setItem('assigned_village_id', String(userData.assigned_village_id));
        }

        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Login failure:', err);
      const detail = err.response?.data?.detail;
      if (err.response?.status === 401) {
        setErrorMsg('Invalid email or password.');
      } else {
        setErrorMsg(typeof detail === 'string' ? detail : 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setErrorMsg('Google login failed. No credential received.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/google', {
        token: credentialResponse.credential,
      });

      if (response.data) {
        const userData = response.data.user || response.data;
        const token = response.data.token || response.data.access_token || credentialResponse.credential || String(userData.id || '');
        const userId = String(userData.id || response.data.userId || '');

        localStorage.setItem('user', JSON.stringify(userData));
        if (token) localStorage.setItem('authToken', token);
        if (userId) localStorage.setItem('userId', userId);
        if (userData.role) {
          localStorage.setItem('userRole', String(userData.role).toUpperCase());
        }
        if (userData.email) {
          localStorage.setItem('userEmail', userData.email);
        }
        if (userData.name) {
          localStorage.setItem('userName', userData.name);
        }
        if (userData.assigned_village_id) {
          localStorage.setItem('assigned_village_id', String(userData.assigned_village_id));
        }

        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Google Auth failure:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(typeof detail === 'string' ? detail : 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setErrorMsg('Google Single Sign-On was cancelled or failed.');
  };

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSuccess,
            auto_select: false,
            itp_support: false,
            use_fedcm_for_prompt: false,
          });

          const btnTarget = document.getElementById('googleSignInDiv');
          if (btnTarget) {
            btnTarget.innerHTML = '';
            window.google.accounts.id.renderButton(btnTarget, {
              type: 'standard',
              theme: 'filled_black',
              size: 'large',
              shape: 'pill',
              text: 'signin_with',
              width: 350,
              logo_alignment: 'left',
            });
          }
        } catch (e) {
          console.error('Failed to initialize Google Sign-In button:', e);
        }
      }
    };

    initializeGoogleSignIn();
    const timer = setTimeout(initializeGoogleSignIn, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setForgotMsg('');
    setForgotLoading(true);

    try {
      const res = await apiClient.post('/auth/forgot-password', { email: forgotEmail.trim() });
      if (res.data && res.data.status === 'success') {
        setForgotMsg(res.data.message || 'OTP code sent to your email address.');
        setStep(2);
      }
    } catch (err) {
      setForgotMsg(err.response?.data?.detail || 'Failed to request OTP code. Please check email address.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotMsg('');
    setForgotLoading(true);

    try {
      const res = await apiClient.post('/auth/reset-password', {
        email: forgotEmail.trim(),
        otp: otpCode.trim(),
        new_password: newPassword,
      });

      if (res.data && res.data.status === 'success') {
        setEmail(forgotEmail.trim());
        setPassword('');
        setErrorMsg('');
        alert('Password reset successfully! Please sign in using your new credentials.');
        setShowForgotModal(false);
        setStep(1);
        setForgotEmail('');
        setOtpCode('');
        setNewPassword('');
      }
    } catch (err) {
      setForgotMsg(err.response?.data?.detail || 'Failed to reset password. Verify OTP code and try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-8 backdrop-blur-sm space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20 text-blue-400 mb-1">
              <Activity className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Smart Health EWS</h1>
            <p className="text-slate-400 text-sm">Sign in to your surveillance monitoring account</p>
          </div>

          {/* Error Notification Banner */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium text-center">
              {errorMsg}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@smarthealth.gov.in"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotEmail(email);
                  }}
                  className="text-xs text-blue-400 hover:underline font-medium"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-11 pr-11 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center space-x-2 mt-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Sign In to Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* SSO Visual Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-slate-700/80"></div>
            <span className="absolute bg-slate-800 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Or continue with
            </span>
          </div>

          {/* Google SSO Button Container */}
          <div className="flex justify-center w-full min-h-[44px]">
            <div id="googleSignInDiv"></div>
       </div>

          {/* Create Account Link */}
          <div className="text-center pt-2 border-t border-slate-700/60">
            <p className="text-slate-400 text-xs">
              Don&apos;t have an account yet?{' '}
              <Link to="/signup" className="text-blue-400 hover:underline font-semibold inline-flex items-center space-x-1">
                <span>Create Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center space-x-2 text-blue-400">
                <KeyRound className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">Reset Password</h3>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {forgotMsg && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 text-xs font-medium">
                {forgotMsg}
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Enter your registered email address below to receive a 6-digit password reset OTP code.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="user@smarthealth.gov.in"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-slate-400">
                  An OTP code was sent to <strong className="text-slate-200">{forgotEmail}</strong>. Enter the OTP code and your new password.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="e.g. 123456"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 tracking-widest font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5"
                  >
                    {forgotLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Update Password</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Login;

