import React, { useState } from 'react';
import { 
  LogIn, ShieldAlert, GraduationCap, Monitor, ArrowRight, ShieldCheck, 
  Eye, EyeOff, Sparkles, Building2, UserCheck, KeyRound, CheckCircle2, Lock, User
} from 'lucide-react';
import { authApi } from '../api';

export default function UnifiedLogin({ onLoginSuccess, onLaunchTerminal }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const quickRoles = [
    { label: 'Admin', user: 'admin', pass: 'admin123', icon: ShieldCheck, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { label: 'Staff Demo', user: 'prof_smith', pass: 'staff123', icon: UserCheck, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'Dept Demo', user: 'cs_dept', pass: 'dept123', icon: Building2, color: 'text-purple-700 bg-purple-50 border-purple-200' }
  ];

  const handleQuickRole = (role) => {
    setUsername(role.user);
    setPassword(role.pass);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await authApi.login(username, password);
      const data = res.data;
      localStorage.setItem('active_jwt_token', data.access_token);
      localStorage.setItem('kiosk_jwt_token', data.access_token);
      onLoginSuccess(data);
    } catch (err) {
      console.error('Login error:', err);
      let detail = 'Invalid username or password.';
      if (err.response?.data?.detail) {
        detail = err.response.data.detail;
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        detail = 'Unable to reach backend server. Please check that the server is running on http://localhost:8001.';
      }
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50/70 bg-grid-subtle text-slate-900 flex flex-col items-center justify-center py-8 px-4 sm:px-6 font-sans relative overflow-hidden selection:bg-blue-900 selection:text-white">
      {/* Ambient background glow orbs */}
      <div className="absolute -top-36 -left-36 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-36 -right-36 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-4xl space-y-8 relative z-10">
        
        {/* Top University Branding Header */}
        <div className="text-center space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-500 font-semibold">{todayFormatted}</span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-900 font-extrabold uppercase tracking-wider text-[11px]">Academic Portal</span>
          </div>

          <div className="flex justify-center">
            <div className="p-2.5 rounded-3xl bg-white shadow-xl shadow-blue-950/10 ring-4 ring-blue-50 border border-blue-100 transition-transform duration-200 hover:scale-105">
              <img 
                src="/logo.png" 
                alt="ARIGNAR ANNA COLLEGE" 
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-2xl" 
              />
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase leading-tight">
              ARIGNAR ANNA COLLEGE
            </h1>
            <p className="text-xs sm:text-sm text-blue-900 font-extrabold tracking-wide uppercase mt-1">
              Attendance Kiosk & Academic Management Suite
            </p>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm font-medium flex items-center gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dual Cards Section: Sign In on Left, Attendance Kiosk on Right (or stacked on mobile) */}
        <div className="max-w-md mx-auto w-full space-y-4">
          
          {/* Main Sign In Card */}
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/70 space-y-6 transition-all hover:border-blue-300/80">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-900 border border-blue-200/80 shadow-2xs">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">Portal Sign In</h2>
                  <p className="text-xs text-slate-500 font-medium">Administrator, Department, or Faculty</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-black bg-blue-50 text-blue-900 border border-blue-200">
                Secure
              </span>
            </div>

            {/* Quick Demo Credentials Autofill Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Quick Fill Demo:</span>
              <div className="grid grid-cols-3 gap-2">
                {quickRoles.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => handleQuickRole(r)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 hover:shadow-xs active:scale-95 ${r.color}`}
                      title={`Fill ${r.label} credentials (${r.user})`}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Username / Staff ID
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. admin, cs_department, prof_smith"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full bg-slate-50/90 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:border-blue-800 focus:outline-none transition-all shadow-2xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full bg-slate-50/90 border border-slate-300 rounded-xl pl-10 pr-11 py-3 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:border-blue-800 focus:outline-none transition-all shadow-2xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Main Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-blue-700" /> RBAC Level 1-3</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 font-semibold font-mono text-[10px]">JWT OAuth2</span>
            </div>
          </div>

          {/* Dedicated Classroom Attendance Terminal Launcher Card */}
          <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 border border-emerald-200/90 rounded-3xl p-5 shadow-lg shadow-emerald-950/5 flex items-center justify-between gap-4 transition-all hover:border-emerald-300">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-xs">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <span>Classroom Terminal</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Kiosk
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Faculty instant unlock with Initials & 4-digit PIN
                </p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={onLaunchTerminal}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Launch</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 font-medium space-y-1">
          <p>ARIGNAR ANNA COLLEGE • Official Academic Portal</p>
          <p className="text-[11px] text-slate-400">All rights reserved &copy; {new Date().getFullYear()}</p>
        </div>

      </div>
    </div>
  );
}

